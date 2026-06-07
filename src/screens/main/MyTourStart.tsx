import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ImageBackground,
} from 'react-native';
import { CustomAlert } from '../../utils/CustomAlert';
import Mapbox, {
  type LineLayerStyle,
  type SymbolLayerStyle,
} from '@rnmapbox/maps';
import Geolocation from '@react-native-community/geolocation';
import Config from 'react-native-config';
import axios from 'axios';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useFavorites } from '../../context/FavoritesContext';
import { showError, showSuccess, showInfo } from '../../components/common/AppToast';
import {
  StarIcon,
  LocationIcon,
  HeartIcon,
  TimeIcon,
  ForkIcon,
  DeleteWhiteIcon,
  RedHeartIcon,
  BlueMapIcon,
  GrayMapIcon,
  WhiteHeart,
  WhiteFork,
  PrideEvent,
  PodcastEvent,
} from '../../constants/icons';
import { isPodcastEvent } from '../../utils/eventHelpers';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';
import ScanVerifyModal from '../../components/modals/ScanVerifyModal';
import TopHeader from '../../components/Home/TopHeader';
import EventDetailModal from '../../components/modals/EventDetailModal';
import {
  addUserVisitPoints,
  deleteUserTour,
  fetchEventsByIds,
  fetchPlacesByIds,
  fetchRouteDetails,
  FirebaseEvent,
  FirebasePlace,
  FirebaseRoute,
  fetchUserTourById,
  recordTourFavoritedPlace,
  saveUserTour,
  sortPlacesByIdOrder,
  buildNavigableRouteFromStops,
  removeTourPlaceFromUserAndRecord,
} from '../../services/myTourService';
import { scheduleStopsWithEventTiming } from '../../utils/tourRouteScheduling';
import {
  distanceMetersBetween,
  projectPointOnPolyline,
  splitPolylineAt,
  type Coord,
} from '../../utils/routeProgress';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../Redux/store';
import { setUserPoints } from '../../Redux/slices/authSlice';
import NextStopBanner from '../../components/MyTourStart/NextStopBanner';
import RecenterButton from '../../components/MyTourStart/RecenterButton';
import ZoomControls from '../../components/MyTourStart/ZoomControls';

type TourStop = {
  id: string;
  title: string;
  coordinate: [number, number];
  place?: FirebasePlace;
  event?: FirebaseEvent;
  kind?: 'place' | 'event';
  eventStatus?: 'active' | 'expired';
  sortTime?: number;
};

type DirectionsResponse = {
  routes?: Array<{
    geometry?: {
      coordinates?: [number, number][];
    };
  }>;
};

const routeLineLayerStyle: LineLayerStyle = {
  lineColor: COLORS.LOGOUT_TEXT,
  lineWidth: 4,
  lineOpacity: 0.95,
  lineDasharray: [1.4, 1.6],
  lineCap: 'round',
  lineJoin: 'round',
};

const completedRouteLineLayerStyle: LineLayerStyle = {
  lineColor: '#9AA3AF',
  lineWidth: 4,
  lineOpacity: 0.95,
  lineCap: 'round',
  lineJoin: 'round',
};

const NEAREST_STOP_TOLERANCE_METERS = 1;


const distanceLabelStyle: SymbolLayerStyle = {
  textField: ['get', 'label'],
  textSize: 11,
  textColor: '#FFFFFF',
  textHaloColor: COLORS.BUTTON_COLOR,
  textHaloWidth: 2.5,
  textAnchor: 'center',
  textFont: ['DIN Pro Medium', 'Arial Unicode MS Regular'],
  textAllowOverlap: true,
  textIgnorePlacement: true,
};

// Stop name labels rendered as native Mapbox SymbolLayer (always visible at any zoom)
const stopNameLabelStyle: SymbolLayerStyle = {
  textField: ['get', 'name'],
  textSize: 12,
  textColor: '#FFFFFF',
  textHaloColor: COLORS.BUTTON_COLOR,
  textHaloWidth: 2.5,
  textAnchor: 'top',
  textOffset: [0, 1.0],
  textFont: ['DIN Pro Medium', 'Arial Unicode MS Regular'],
  textAllowOverlap: false,
  textMaxWidth: 10,
};

const visitedStopNameLabelStyle: SymbolLayerStyle = {
  ...stopNameLabelStyle,
  textHaloColor: '#9AA3AF',
};

const VISIT_DISTANCE_THRESHOLD_METERS = 300;
const ALLOW_ANY_IMAGE_FOR_TESTING = true;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DETAIL_CARD_WIDTH = 260;
const DETAIL_CARD_HEIGHT = 255;

const getCurrentPositionAsync = async () =>
  new Promise<[number, number]>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
      reject,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

// Beyond this straight-line distance, skip road routing and use a great circle arc
const ROAD_ROUTE_MAX_METERS = 200_000; // 200 km

// Spherical interpolation along the great circle — produces a curved arc on Mercator maps
const greatCircleArc = (
  from: [number, number],
  to: [number, number],
  numPoints = 60
): [number, number][] => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(from[1]); const lon1 = toRad(from[0]);
  const lat2 = toRad(to[1]); const lon2 = toRad(to[0]);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat1 - lat2) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon1 - lon2) / 2) ** 2
  ));
  if (d === 0) return [from, to];
  const pts: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    pts.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  return pts;
};

const startOfCalendarDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfCalendarDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const isSameCalendarDay = (a: Date, b: Date) =>
  startOfCalendarDay(a).getTime() === startOfCalendarDay(b).getTime();

/** True when the event occurs on the given calendar day (supports multi-day events). */
const isEventScheduledOnDay = (event: FirebaseEvent, day: Date): boolean => {
  if (!event.startDate) {
    return false;
  }

  const dayStart = startOfCalendarDay(day);
  const dayEnd = endOfCalendarDay(day);
  const eventStart = startOfCalendarDay(new Date(event.startDate));
  const eventEnd = event.endDate
    ? endOfCalendarDay(new Date(event.endDate))
    : endOfCalendarDay(new Date(event.startDate));

  return eventStart <= dayEnd && eventEnd >= dayStart;
};

const isEventInPast = (event: FirebaseEvent, today: Date): boolean => {
  if (event.endDate) {
    return endOfCalendarDay(new Date(event.endDate)) < startOfCalendarDay(today);
  }
  if (event.startDate) {
    return endOfCalendarDay(new Date(event.startDate)) < startOfCalendarDay(today);
  }
  return false;
};

const parseEventSortTime = (event: FirebaseEvent): number => {
  if (!event.startDate) {
    return Number.MAX_SAFE_INTEGER;
  }
  const dateTime = `${event.startDate}T${event.startTime || '00:00'}`;
  const parsed = new Date(dateTime).getTime();
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
};

const getEventEndDateTime = (event: FirebaseEvent): Date | null => {
  if (event.endDate) {
    const parsed = new Date(`${event.endDate}T${event.endTime || '23:59'}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (event.startDate && event.startTime) {
    const start = new Date(`${event.startDate}T${event.startTime}`);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start);
      end.setHours(end.getHours() + 2);
      return end;
    }
  }
  if (event.startDate) {
    return endOfCalendarDay(new Date(event.startDate));
  }
  return null;
};

const isEventTimeExpired = (event: FirebaseEvent, now = new Date()): boolean => {
  if (!isEventScheduledOnDay(event, now)) {
    return false;
  }
  const end = getEventEndDateTime(event);
  return Boolean(end && now > end);
};

const eventToTourStop = (
  event: FirebaseEvent,
  status: 'active' | 'expired'
): TourStop => ({
  id: event.id,
  title: event.title,
  coordinate: [
    Number(event.coordinates?.longitude || 0),
    Number(event.coordinates?.latitude || 0),
  ] as [number, number],
  event,
  kind: 'event',
  eventStatus: status,
  sortTime: parseEventSortTime(event),
});

const orderStopsByNearest = (
  stops: TourStop[],
  startCoordinate: [number, number] | null
) => {
  if (stops.length <= 1) {
    return stops;
  }

  const remaining = [...stops];
  const ordered: TourStop[] = [];
  let cursor = startCoordinate || remaining[0].coordinate;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = distanceMetersBetween(cursor, remaining[0].coordinate);

    for (let index = 1; index < remaining.length; index += 1) {
      const candidateDistance = distanceMetersBetween(cursor, remaining[index].coordinate);
      if (candidateDistance < nearestDistance) {
        nearestDistance = candidateDistance;
        nearestIndex = index;
      }
    }

    const [nextStop] = remaining.splice(nearestIndex, 1);
    ordered.push(nextStop);
    cursor = nextStop.coordinate;
  }

  return ordered;
};

const EventMarkerIcon = ({
  event,
  size = 28,
}: {
  event: FirebaseEvent;
  size?: number;
}) =>
  isPodcastEvent(event) ? (
    <PodcastEvent width={size} height={size} />
  ) : (
    <PrideEvent width={size} height={size} />
  );

const eventMarkerColors = (event: FirebaseEvent) =>
  isPodcastEvent(event)
    ? { backgroundColor: '#1B84FF', shadowColor: '#0B5ED7' }
    : { backgroundColor: '#7C3AED', shadowColor: '#5B21B6' };

const PulsingPin = () => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.55,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, scale]);

  const haloScale = scale.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 2.2],
  });

  return (
    <View style={pulseStyles.wrapper} pointerEvents="none">
      <Animated.View
        style={[
          pulseStyles.halo,
          { opacity, transform: [{ scale: haloScale }] },
        ]}
      />
      <View style={pulseStyles.iconLayer}>
        <BlueMapIcon width={35} height={46} />
      </View>
    </View>
  );
};

const pulseStyles = StyleSheet.create({
  wrapper: {
    width: 46,
    height: 56,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  halo: {
    position: 'absolute',
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E11D48',
  },
  iconLayer: {
    width: 35,
    height: 46,
  },
});

// Google-Maps-style user pin: white outer ring + blue inner dot + a small
// rotating chevron that always points in the user's direction of travel.
const userPinStyles = StyleSheet.create({
  outer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  inner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1D82DD',
  },
  // arrowWrap sits 'above' the dot and rotates with the user's heading;
  // its size is the rotation pivot box.
  arrowWrap: {
    position: 'absolute',
    width: 30,
    height: 38,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  // The arrow itself: a small upward-pointing triangle created with borders.
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#1D82DD',
  },
});

const MyTourStart = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();
  const cameraRef = useRef<Mapbox.Camera>(null);
  const mapRef = useRef<Mapbox.MapView>(null);
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const [expanded, setExpanded] = useState(false);

  const [scanVisible, setScanVisible] = useState(false);
  const [tourStarted, setTourStarted] = useState(Boolean(route.params?.autoStart));
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roadSegments, setRoadSegments] = useState<[number, number][][]>([]);
  const [airSegments, setAirSegments] = useState<[number, number][][]>([]);
  const [completedRoadSegments, setCompletedRoadSegments] = useState<[number, number][][]>([]);
  const [completedAirSegments, setCompletedAirSegments] = useState<[number, number][][]>([]);
  const [completedApproachRoadSegments, setCompletedApproachRoadSegments] = useState<[number, number][][]>([]);
  const [completedApproachAirSegments, setCompletedApproachAirSegments] = useState<[number, number][][]>([]);
  const [tourStops, setTourStops] = useState<TourStop[]>([]);
  const [tourId, setTourId] = useState<string | null>(route.params?.tourId || null);
  const tourIdRef = useRef<string | null>(route.params?.tourId || null);
  useEffect(() => {
    tourIdRef.current = tourId;
  }, [tourId]);
  const [isEdited, setIsEdited] = useState(Boolean(route.params?.isEdited));
  const [extraPlaceIds, setExtraPlaceIds] = useState<string[]>(
    route.params?.extraPlaceIds || []
  );
  const [removedPlaceIds, setRemovedPlaceIds] = useState<string[]>(
    route.params?.removedPlaceIds || []
  );
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(
    null
  );
  const currentLocationRef = useRef<[number, number] | null>(null);
  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);
  const [tourOrigin, setTourOrigin] = useState<[number, number] | null>(null);
  const tourOriginRef = useRef<[number, number] | null>(null);
  useEffect(() => {
    tourOriginRef.current = tourOrigin;
  }, [tourOrigin]);
  const [savedTourOrder, setSavedTourOrder] = useState<string[] | null>(null);
  const [placeProgress, setPlaceProgress] = useState<
    Record<
      string,
      {
        visited: boolean;
        visitedAt?: string | null;
        proofImageUri?: string | null;
        pointsEarned?: number;
        addedByUser?: boolean;
      }
    >
  >({});
  const [eventProgress, setEventProgress] = useState<
    Record<
      string,
      {
        attended?: boolean;
        dismissed?: boolean;
        expired?: boolean;
        visitedAt?: string | null;
        proofImageUri?: string | null;
      }
    >
  >({});
  const [scanForEvent, setScanForEvent] = useState(false);
  const [routeDetails, setRouteDetails] = useState<{
    route: FirebaseRoute;
    places: FirebasePlace[];
    events: FirebaseEvent[];
    favoritePlace: FirebasePlace | null;
    favoritePlaces: FirebasePlace[];
  } | null>(null);
  const [selectedStop, setSelectedStop] = useState<TourStop | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<FirebaseEvent | null>(null);
  const [tourCompletedVisible, setTourCompletedVisible] = useState(false);
  const [isCompletedTour, setIsCompletedTour] = useState(false);
  const [cardPosition, setCardPosition] = useState({ x: 24, y: 260 });
  const [, setTourActionVisible] = useState(false);
  const [isPausedTour, setIsPausedTour] = useState(false);
  const leavingRef = useRef(false);

  // Walking polyline cache keyed by `${fromStopId}->${toStopId}`.
  const [legPolylines, setLegPolylines] = useState<Record<string, [number, number][]>>({});

  // Active leg = last visited stop (or tour origin) → next pending stop.
  type ActiveLeg = { key: string; from: [number, number]; to: [number, number]; toStopId: string } | null;
  const [activeLeg, setActiveLeg] = useState<ActiveLeg>(null);

  const [followMode, setFollowMode] = useState<'follow' | 'free'>('follow');
  const [zoomLevel, setZoomLevel] = useState(12.6);

  const handleZoom = useCallback((direction: 'in' | 'out') => {
    const nextZoom =
      direction === 'in'
        ? Math.min(zoomLevel + 0.8, 18)
        : Math.max(zoomLevel - 0.8, 0.8);
    cameraRef.current?.setCamera({ zoomLevel: nextZoom, animationDuration: 450 });
    setZoomLevel(nextZoom);
    // Exit follow mode so the GPS-tracking effect doesn't snap zoom back to 16.
    setFollowMode('free');
  }, [zoomLevel]);
  // userHeading is the GPS-reported direction (degrees, 0 = north) used to
  // rotate the on-map user pin like Google Maps' blue arrow.
  const [userHeading, setUserHeading] = useState<number>(0);

  const pendingEditSaveRef = useRef(false);
  const introPlayedRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const fetchRoadSegment = useCallback(
    async (from: [number, number], to: [number, number]): Promise<[number, number][] | null> => {
      const dist = distanceMetersBetween(from, to);
      if (dist > ROAD_ROUTE_MAX_METERS) {
        return greatCircleArc(from, to);
      }

      if (!Config.MAPBOX_TOKEN) {
        return null;
      }

      // Intra-city legs (< 50 km straight-line) avoid motorways — Lahore
      // tour stops shouldn't route via M2/M3 when normal city roads work.
      // Longer legs allow motorways because they're between cities.
      const INTRACITY_THRESHOLD_METERS = 50_000;
      const excludeMotorway = dist < INTRACITY_THRESHOLD_METERS;

      try {
        const { data } = await axios.get<DirectionsResponse>(
          // driving-traffic profile follows actual roads with live traffic awareness —
          // prefers city streets over motorways for short urban legs
          `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${from[0]},${from[1]};${to[0]},${to[1]}`,
          {
            params: {
              access_token: Config.MAPBOX_TOKEN,
              geometries: 'geojson',
              overview: 'full',
              steps: false,
              ...(excludeMotorway ? { exclude: 'motorway' } : {}),
            },
          }
        );

        const routedCoordinates = data.routes?.[0]?.geometry?.coordinates;
        if (routedCoordinates && routedCoordinates.length >= 2) {
          // Mapbox snaps the route to the nearest road, so the first/last
          // coordinates aren't exactly `from`/`to`. Force the segment to begin
          // at `from` and end at `to` so the line meets the pin tips precisely.
          return [from, ...(routedCoordinates as [number, number][]), to];
        }
        return null;
      } catch (error) {
        showError('Route Unavailable', 'Could not find a route between two stops.');
        return null;
      }
    },
    []
  );

  const buildRouteSegments = useCallback(
    async (lineStops: [number, number][]) => {
      if (lineStops.length < 2) {
        return {
          road: lineStops.length >= 2 ? [lineStops] : [],
          air: [] as [number, number][][],
        };
      }

      const results = await Promise.all(
        lineStops.slice(0, -1).map(async (from, i) => {
          const to = lineStops[i + 1] as [number, number];
          const isAir = distanceMetersBetween(from as [number, number], to) > ROAD_ROUTE_MAX_METERS;
          const pts = isAir
            ? greatCircleArc(from as [number, number], to)
            : await fetchRoadSegment(from as [number, number], to);
          return { pts, isAir };
        })
      );

      const road: [number, number][][] = [];
      const air: [number, number][][] = [];
      let currentRoad: [number, number][] = [];

      for (const { pts, isAir } of results) {
        if (!pts) {
          // Routing failed for this leg — break the running road chain
          // so we don't connect across a gap with a straight line.
          if (currentRoad.length >= 2) road.push(currentRoad);
          currentRoad = [];
          continue;
        }
        if (isAir) {
          if (currentRoad.length >= 2) road.push(currentRoad);
          currentRoad = [];
          air.push(pts);
        } else {
          currentRoad =
            currentRoad.length === 0 ? [...pts] : [...currentRoad, ...pts.slice(1)];
        }
      }

      if (currentRoad.length >= 2) road.push(currentRoad);

      return {
        road: road.length > 0 ? road : air.length > 0 ? [] : [lineStops],
        air,
      };
    },
    [fetchRoadSegment]
  );

  const routeId = route.params?.routeId;
  const routeName = route.params?.routeName;
  const cityLabel = route.params?.cityLabel || '';

  const currentRoute = {
    id: routeId ?? 'route-1',
    title: routeName || routeDetails?.route.name || 'Tour Route',
    description: `Beautiful travel path across ${cityLabel || routeDetails?.route.city_name || 'the city'}`,
    rating: '4.8',
    image:
      routeDetails?.places[0]?.imageUrl ||
      routeDetails?.favoritePlaces?.[0]?.imageUrl ||
      routeDetails?.favoritePlace?.imageUrl ||
      routeDetails?.events[0]?.coverImage ||
      '',
    category: 'Route' as const,
  };

  useEffect(() => {
    let isMounted = true;
    if (!Config.MAPBOX_TOKEN) return undefined;

    Mapbox.setAccessToken(Config.MAPBOX_TOKEN)
      .then(() => {
        if (isMounted) setMapReady(true);
      })
      .catch(() => {
        if (isMounted) setMapReady(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!routeId) {
      return;
    }

    setLoading(true);

    Promise.all([
      fetchRouteDetails({
        routeId,
        userId: user?.id,
        extraPlaceIds,
        removedPlaceIds,
      }),
      fetchUserTourById(route.params?.tourId || tourId || null),
    ])
      .then(async ([data, savedTour]) => {
        if (!data) {
          return;
        }

        let nextDetails = data;
        let nextProgress: Record<
          string,
          {
            visited: boolean;
            visitedAt?: string | null;
            proofImageUri?: string | null;
            pointsEarned?: number;
            addedByUser?: boolean;
          }
        > = {};

        if (savedTour) {
          const placeIdsInOrder = [...savedTour.all_places]
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((item) => item.place_id)
            .filter(Boolean);
          const savedPlaces = sortPlacesByIdOrder(
            await fetchPlacesByIds(placeIdsInOrder),
            placeIdsInOrder
          );

          // Extract events from all_places (new merged structure)
          const eventEntries = savedTour.all_places
            .filter((item: any) => item.event_id)
            .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

          // If no events in all_places (legacy data), try to fetch from top-level event_ids field
          let savedEvents: FirebaseEvent[] = [];
          const eventIdsFromEntries = eventEntries.map((entry: any) => entry.event_id);
          const remainingEventIds = (savedTour.event_ids || []).filter(
            (id) => !eventIdsFromEntries.includes(id)
          );
          const allEventIds = [...eventIdsFromEntries, ...remainingEventIds];
          if (allEventIds.length > 0) {
            savedEvents = await fetchEventsByIds(allEventIds);
          }

          nextDetails = {
            ...data,
            // Saved tour is authoritative. Do NOT re-merge with route template
            // places — that would resurrect places the user deliberately removed.
            places: savedPlaces,
            events: savedEvents,
          };
          nextProgress = savedTour.all_places
            .filter((item: any) => item.place_id)
            .reduce(
              (
                acc: Record<
                  string,
                  {
                    visited: boolean;
                    visitedAt?: string | null;
                    proofImageUri?: string | null;
                    pointsEarned?: number;
                    addedByUser?: boolean;
                  }
                >,
                item: any
              ) => {
                acc[item.place_id] = {
                  visited: item.visited,
                  visitedAt: item.visitedAt,
                  proofImageUri: item.proofImageUri,
                  pointsEarned: item.pointsEarned,
                  addedByUser: item.addedByUser,
                };
                return acc;
              },
              {} as Record<
                string,
                {
                  visited: boolean;
                  visitedAt?: string | null;
                  proofImageUri?: string | null;
                  pointsEarned?: number;
                  addedByUser?: boolean;
                }
              >
            );
          const wasPaused = savedTour.status === 'paused';
          const wasCompleted = savedTour.status === 'completed';
          const shouldAutoStart = Boolean(route.params?.autoStart) && !wasCompleted;
          setTourStarted(
            shouldAutoStart || savedTour.status === 'active'
          );
          setIsPausedTour(wasPaused && !shouldAutoStart);
          setIsCompletedTour(wasCompleted);
          setTourId(savedTour.id);
          setStartedAt(savedTour.startedAt || null);
          setIsEdited(savedTour.isEdited || isEdited);
          // Restore the GPS anchor so the optimized stop order remains
          // identical to the previous session.
          if (savedTour.tourOrigin) {
            setTourOrigin(savedTour.tourOrigin);
          }
        }

        setPlaceProgress(nextProgress);
        // Restore persisted per-event progress (attended/dismissed) if present
        // Extract from all_places entries that have event_progress field (new structure)
        let nextEventProgress: Record<string, {
          attended?: boolean;
          dismissed?: boolean;
          visitedAt?: string | null;
          proofImageUri?: string | null;
        }> = {};
        
        const persistedEventProgress = savedTour?.event_progress || {};
        nextEventProgress = {
          ...persistedEventProgress,
          ...((savedTour?.all_places || [])
            .filter((item: any) => item.event_id && item.event_progress)
            .reduce((acc: any, item: any) => {
              acc[item.event_id] = item.event_progress;
              return acc;
            }, {} as Record<string, any>)),
        };
        
        setEventProgress(nextEventProgress);
        setRouteDetails(nextDetails);

        // Strictly exclude any place whose ID also exists as an event
        // This prevents dirty Firebase data (event IDs in selected_places) from
        // entering the navigational route
        const eventIdSet = new Set((nextDetails.events || []).map((e) => e.id));

        const stops: TourStop[] = nextDetails.places
          .filter((place) => !eventIdSet.has(place.id))
          .filter(
            (place) =>
              place.coordinates?.longitude !== undefined &&
              place.coordinates?.latitude !== undefined
          )
          .map((place) => ({
            id: place.id,
            title: place.name,
            coordinate: [
              Number(place.coordinates?.longitude || 0),
              Number(place.coordinates?.latitude || 0),
            ] as [number, number],
            place,
          }));

        setTourStops(stops);
        if (savedTour) {
          setSavedTourOrder(stops.map((stop) => stop.id));
        }
      })
      .finally(() => setLoading(false));
  }, [route.params?.autoStart, route.params?.tourId, routeId, tourId, user?.id]);

  useEffect(() => {
    const addedPlaceId = route.params?.addedPlaceId;
    if (!addedPlaceId) {
      return;
    }

    fetchPlacesByIds([addedPlaceId]).then((places) => {
      const addedPlace = places[0];
      const lng = Number(addedPlace?.coordinates?.longitude ?? 0);
      const lat = Number(addedPlace?.coordinates?.latitude ?? 0);

      if (!addedPlace || (!lng && !lat)) {
        showError('Invalid Location', 'This location does not have valid map coordinates.');
        return;
      }

      // Pure updater — no side effects inside
      setTourStops((prev) => {
        if (prev.some((s) => s.id === addedPlace.id)) return prev;
        return [
          ...prev,
          { id: addedPlace.id, title: addedPlace.name, coordinate: [lng, lat] as [number, number], place: addedPlace },
        ];
      });

      // All side-effect setters outside the updater (React 18 safe)
      setRouteDetails((prev) =>
        prev
          ? { ...prev, places: prev.places.some((p) => p.id === addedPlace.id) ? prev.places : [...prev.places, addedPlace] }
          : prev
      );
      setExtraPlaceIds((cur) => cur.includes(addedPlace.id) ? cur : [...cur, addedPlace.id]);
      setPlaceProgress((prev) => ({
        ...prev,
        [addedPlace.id]: { ...prev[addedPlace.id], visited: Boolean(prev[addedPlace.id]?.visited), addedByUser: true },
      }));
      setIsEdited(true);
      setSavedTourOrder(null);
      setOptimizedOrder(null);
      pendingEditSaveRef.current = true;
    });
  }, [route.params?.addedPlaceId]);

  const placeStops = useMemo(() => tourStops, [tourStops]);

  const hasVisitedProgress = useMemo(
    () => Object.values(placeProgress).some((item) => item.visited),
    [placeProgress]
  );

  const isStopComplete = useCallback(
    (stop: TourStop) => {
      if (stop.kind === 'event' || stop.event) {
        const progress = eventProgress[stop.id];
        return Boolean(progress?.attended || progress?.expired);
      }
      return Boolean(placeProgress[stop.id]?.visited);
    },
    [eventProgress, placeProgress]
  );

  const { activeTodayEventStops, expiredTodayEventStops } = useMemo(() => {
    const today = new Date();
    const active: TourStop[] = [];
    const expired: TourStop[] = [];

    (routeDetails?.events || [])
      .filter((event) => !isEventInPast(event, today))
      .filter((event) => isEventScheduledOnDay(event, today))
      .filter(
        (event) =>
          event.coordinates?.longitude !== undefined &&
          event.coordinates?.latitude !== undefined
      )
      .forEach((event) => {
        const progress = eventProgress[event.id];
        if (progress?.attended) {
          return;
        }
        if (progress?.dismissed && progress.visitedAt) {
          if (isSameCalendarDay(new Date(progress.visitedAt), today)) {
            return;
          }
        }

        const timedOut = Boolean(progress?.expired || isEventTimeExpired(event, today));
        if (timedOut) {
          expired.push(eventToTourStop(event, 'expired'));
        } else {
          active.push(eventToTourStop(event, 'active'));
        }
      });

    const byTime = (a: TourStop, b: TourStop) =>
      (a.sortTime || 0) - (b.sortTime || 0);

    return {
      activeTodayEventStops: active.sort(byTime),
      expiredTodayEventStops: expired.sort(byTime),
    };
  }, [eventProgress, routeDetails?.events]);

  /** Places only — Mapbox optimizes driving order without pulling events forward. */
  const routePlaceStops = useMemo(() => placeStops, [placeStops]);

  const allRouteStops = useMemo(() => {
    if (!tourStarted) {
      return routePlaceStops;
    }
    return [...activeTodayEventStops, ...routePlaceStops];
  }, [activeTodayEventStops, routePlaceStops, tourStarted]);

  useEffect(() => {
    if (!tourStarted || !routeDetails?.events?.length) {
      return;
    }

    const markExpired = () => {
      const now = new Date();
      setEventProgress((prev) => {
        let changed = false;
        const next = { ...prev };

        routeDetails.events.forEach((event) => {
          if (!isEventScheduledOnDay(event, now)) {
            return;
          }
          if (
            isEventTimeExpired(event, now) &&
            !next[event.id]?.attended &&
            !next[event.id]?.expired
          ) {
            next[event.id] = {
              ...next[event.id],
              expired: true,
              visitedAt: now.toISOString(),
            };
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    };

    markExpired();
    const timer = setInterval(markExpired, 60_000);
    return () => clearInterval(timer);
  }, [routeDetails?.events, tourStarted]);

  const visitedStopsInVisitOrder = useMemo(() => {
    const eventStops = [...activeTodayEventStops, ...expiredTodayEventStops];
    const visitedPlaces = tourStops
        .filter((stop) => Boolean(placeProgress[stop.id]?.visited))
      .map((stop) => ({
        stop,
        visitedAt: placeProgress[stop.id]?.visitedAt || '',
      }));
    const visitedEvents = eventStops
      .filter((stop) => isStopComplete(stop))
      .map((stop) => ({
        stop,
        visitedAt: eventProgress[stop.id]?.visitedAt || '',
      }));

    return [...visitedPlaces, ...visitedEvents]
      .sort((a, b) => a.visitedAt.localeCompare(b.visitedAt))
      .map((item) => item.stop);
  }, [
    activeTodayEventStops,
    eventProgress,
    expiredTodayEventStops,
    isStopComplete,
    placeProgress,
    tourStops,
  ]);

  // Prefer the locked-in tour origin so the optimized stop order stays
  // identical across pause/resume and restarts. Fall back to currentLocation
  // only while waiting for the origin to be set (Step 3 effect).
  const orderingAnchor = useMemo<[number, number] | null>(
    () => tourOrigin ?? currentLocation,
    [currentLocation, tourOrigin]
  );

  // Cached "true" road-distance order from Mapbox Optimization API.
  // Keyed by stop ids in current set so we don't refetch needlessly.
  const [optimizedOrder, setOptimizedOrder] = useState<{
    key: string;
    ids: string[];
  } | null>(null);

  useEffect(() => {
    if (savedTourOrder) {
      return;
    }
    if (!orderingAnchor || routePlaceStops.length < 2) {
      return;
    }
    if (!Config.MAPBOX_TOKEN) {
      return;
    }

    const ids = routePlaceStops.map((s) => s.id).join(',');
    const key = `${orderingAnchor[0].toFixed(4)},${orderingAnchor[1].toFixed(4)}|${ids}`;
    if (optimizedOrder?.key === key) {
      return;
    }

    const coords = [orderingAnchor, ...routePlaceStops.map((s) => s.coordinate)]
      .map((c) => `${c[0]},${c[1]}`)
      .join(';');

    let cancelled = false;
    axios
      .get<{ waypoints?: Array<{ waypoint_index: number }> }>(
        `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coords}`,
        {
          params: {
            access_token: Config.MAPBOX_TOKEN,
            source: 'first',
            roundtrip: false,
            overview: 'false',
          },
        }
      )
      .then(({ data }) => {
        if (cancelled || !data.waypoints) return;
        const orderedIds = data.waypoints
          .map((wp, originalIndex) => ({ originalIndex, order: wp.waypoint_index }))
          .filter((entry) => entry.originalIndex > 0)
          .sort((a, b) => a.order - b.order)
          .map((entry) => routePlaceStops[entry.originalIndex - 1].id);
        setOptimizedOrder({ key, ids: orderedIds });
      })
      .catch(() => {
        // Fall back silently to straight-line ordering on API failure.
      });

    return () => {
      cancelled = true;
    };
  }, [routePlaceStops, orderingAnchor, optimizedOrder]);

  const mapOptimizedPlaceStops = useMemo(() => {
    if (savedTourOrder) {
      return routePlaceStops;
    }

    if (!optimizedOrder && !orderingAnchor) {
      return routePlaceStops;
    }

    let ordered: TourStop[];

    if (optimizedOrder) {
      const byId = new Map(routePlaceStops.map((s) => [s.id, s]));
      ordered = optimizedOrder.ids
        .map((id) => byId.get(id))
        .filter((s): s is TourStop => Boolean(s));
      const missing = routePlaceStops.filter((s) => !optimizedOrder.ids.includes(s.id));
      if (missing.length > 0) {
        ordered = [...ordered, ...orderStopsByNearest(missing, orderingAnchor)];
      }
    } else {
      ordered = orderStopsByNearest(routePlaceStops, orderingAnchor);
    }

    return ordered;
  }, [routePlaceStops, optimizedOrder, orderingAnchor, savedTourOrder]);

  const orderedNavigableStops = useMemo(() => {
    if (!tourStarted) {
      return mapOptimizedPlaceStops;
    }

    const anchor =
      visitedStopsInVisitOrder[visitedStopsInVisitOrder.length - 1]?.coordinate ||
      orderingAnchor;

    return scheduleStopsWithEventTiming(
      [...mapOptimizedPlaceStops, ...activeTodayEventStops],
      isStopComplete,
      anchor,
      Date.now()
    );
  }, [
    activeTodayEventStops,
    isStopComplete,
    mapOptimizedPlaceStops,
    orderingAnchor,
    tourStarted,
    visitedStopsInVisitOrder,
  ]);

  const orderedPlaceStops = orderedNavigableStops;

  const orderedPlacesForSave = useMemo(
    () =>
      orderedNavigableStops
        .filter((stop) => Boolean(stop.place))
        .map((stop) => stop.place!),
    [orderedNavigableStops]
  );

  const lastSavedOptimizedOrderKeyRef = useRef<string | null>(null);

  useEffect(() => {
    lastSavedOptimizedOrderKeyRef.current = null;
  }, [tourId]);

  // Persist to Firestore after tourStops updates from AddLocations
  useEffect(() => {
    if (!pendingEditSaveRef.current || !routeDetails || !user?.id) return;
    pendingEditSaveRef.current = false;

    const placesToSave =
      orderedPlacesForSave.length > 0
        ? orderedPlacesForSave
        : tourStops.map((s) => s.place!).filter(Boolean);
    if (placesToSave.length === 0) return;

    saveUserTour({
      tourId,
      userId: user.id,
      userName: user.name || '',
      userEmail: user.email || '',
      route: routeDetails.route,
      title: route.params?.tourName || routeDetails.route.name,
      places: placesToSave,
      events: routeDetails.events,
      placeProgress,
      eventProgress,
      currentStopIndex: 0,
      isEdited: true,
      status: 'active',
      startedAt: startedAt || new Date().toISOString(),
      completedAt: null,
      tourOrigin: tourOriginRef.current,
      navigableRoute: buildNavigableRouteFromStops(orderedNavigableStops),
    })
      .then((savedId) => { if (savedId !== tourId) setTourId(savedId); })
      .catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourStops, orderedPlacesForSave]);

  // Keep Firebase all_places order aligned with the optimized map route.
  useEffect(() => {
    if (!optimizedOrder || !tourId || !routeDetails || !user?.id) {
      return;
    }
    if (lastSavedOptimizedOrderKeyRef.current === optimizedOrder.key) {
      return;
    }
    if (orderedPlacesForSave.length < 2) {
      return;
    }

    lastSavedOptimizedOrderKeyRef.current = optimizedOrder.key;
    const nextCurrentStopIndex = orderedPlacesForSave.findIndex(
      (place) => !placeProgress[place.id]?.visited
    );

    saveUserTour({
      tourId,
      userId: user.id,
      userName: user.name || '',
      userEmail: user.email || '',
      route: routeDetails.route,
      title: route.params?.tourName || routeDetails.route.name,
      places: orderedPlacesForSave,
      events: routeDetails.events,
      placeProgress,
      eventProgress,
      currentStopIndex:
        nextCurrentStopIndex < 0 ? orderedPlacesForSave.length : nextCurrentStopIndex,
      isEdited,
      status: isCompletedTour
        ? 'completed'
        : isPausedTour
          ? 'paused'
          : tourStarted
            ? 'active'
            : 'saved',
      startedAt: startedAt || new Date().toISOString(),
      completedAt: isCompletedTour ? new Date().toISOString() : null,
      tourOrigin: tourOriginRef.current,
      navigableRoute: buildNavigableRouteFromStops(orderedNavigableStops),
    }).catch(() => { });
  }, [
    isCompletedTour,
    isEdited,
    isPausedTour,
    optimizedOrder?.key,
    orderedPlacesForSave,
    route.params?.tourName,
    routeDetails,
    startedAt,
    tourId,
    tourStarted,
    user?.email,
    user?.id,
    user?.name,
  ]);

  const routeAnchor = useMemo<[number, number] | null>(() => {
    return (
      visitedStopsInVisitOrder[visitedStopsInVisitOrder.length - 1]?.coordinate ||
      currentLocation ||
      null
    );
  }, [currentLocation, visitedStopsInVisitOrder]);

  const orderedRemainingStops = useMemo(
    () => orderedNavigableStops.filter((stop) => !isStopComplete(stop)),
    [isStopComplete, orderedNavigableStops]
  );

  // The active "next" stop is the first unvisited stop in the optimized
  // tour order — NOT the straight-line closest one. Straight-line distance
  // misleads in dense cities (e.g. Mall Road appears closer than Urdu Bazar
  // in km even though Urdu Bazar lies along the actual driving route).
  const nearestPendingStop = useMemo<TourStop | null>(() => {
    if (tourStarted && !optimizedOrder && !orderingAnchor) {
      return null;
    }
    return orderedRemainingStops[0] || null;
  }, [optimizedOrder, orderingAnchor, orderedRemainingStops, tourStarted]);

  const selectedStopIsNearestPending = useMemo(() => {
    if (!selectedStop || isStopComplete(selectedStop)) {
      return false;
    }

    if (!nearestPendingStop) {
      return true;
    }

    return (
      nearestPendingStop.id === selectedStop.id ||
      distanceMetersBetween(nearestPendingStop.coordinate, selectedStop.coordinate) <=
      NEAREST_STOP_TOLERANCE_METERS
    );
  }, [isStopComplete, nearestPendingStop, selectedStop]);

  useEffect(() => {
    if (!nearestPendingStop) {
      setActiveLeg(null);
      return;
    }
    const lastVisited = visitedStopsInVisitOrder[visitedStopsInVisitOrder.length - 1];
    const fromCoord: [number, number] | null =
      lastVisited?.coordinate || tourOrigin || currentLocation;
    if (!fromCoord) {
      setActiveLeg(null);
      return;
    }
    const fromId = lastVisited?.id || 'origin';
    setActiveLeg({
      key: `${fromId}->${nearestPendingStop.id}`,
      from: fromCoord,
      to: nearestPendingStop.coordinate,
      toStopId: nearestPendingStop.id,
    });
  }, [visitedStopsInVisitOrder, nearestPendingStop, tourOrigin, currentLocation]);

  const fetchedLegKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!activeLeg) return;
    if (fetchedLegKeysRef.current.has(activeLeg.key)) return;
    fetchedLegKeysRef.current.add(activeLeg.key);
    let cancelled = false;
    fetchRoadSegment(activeLeg.from, activeLeg.to).then((pts) => {
      if (cancelled || !pts) return;
      setLegPolylines((prev) => ({ ...prev, [activeLeg.key]: pts }));
    });
    return () => {
      cancelled = true;
    };
  }, [activeLeg, fetchRoadSegment]);

  // Continuous GPS tracking — runs while the screen is mounted.
  useEffect(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    watchIdRef.current = Geolocation.watchPosition(
      (position) => {
        const next: [number, number] = [
          position.coords.longitude,
          position.coords.latitude,
        ];
        setCurrentLocation(next);

        const heading = position.coords.heading;
        if (typeof heading === 'number' && heading >= 0 && heading <= 360) {
          setUserHeading(heading);
        }
      },
      () => {
        // Silently ignore transient GPS errors; keep last known location.
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 1,
        maximumAge: 1000,
        timeout: 5000,
        interval: 500,
        fastestInterval: 250,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // Lock in the tour's GPS origin as soon as the tour is running and we
  // have a GPS fix. The origin anchors the Mapbox Optimization API call
  // for the entire tour lifetime (persisted to Firestore for restart).
  useEffect(() => {
    if (!tourStarted) return;
    if (tourOrigin) return;
    if (!currentLocation) return;
    setTourOrigin(currentLocation);
  }, [tourStarted, tourOrigin, currentLocation]);

  // Follow-mode camera tracking — smoothly pan to user while tour is active.
  // Camera stays north-up; the user pin itself rotates with GPS heading.
  useEffect(() => {
    if (!tourStarted || followMode !== 'follow' || !currentLocation) return;
    const heading =
      typeof userHeading === 'number' && userHeading >= 0 && userHeading <= 360
        ? userHeading
        : 0;
    cameraRef.current?.setCamera({
      centerCoordinate: currentLocation,
      zoomLevel: 16,
      heading,
      animationDuration: 800,
      animationMode: 'easeTo',
    });
  }, [currentLocation, followMode, tourStarted, userHeading]);

  // On next-stop transition, briefly frame both user and the new pending stop
  // before resuming follow mode.
  const previousPendingStopIdRef = useRef<string | null>(null);
  useEffect(() => {
    const nextId = nearestPendingStop?.id || null;
    const prevId = previousPendingStopIdRef.current;
    previousPendingStopIdRef.current = nextId;

    if (!nextId || !prevId || nextId === prevId) return;
    if (!currentLocation || !nearestPendingStop) return;

    const lngs = [currentLocation[0], nearestPendingStop.coordinate[0]];
    const lats = [currentLocation[1], nearestPendingStop.coordinate[1]];
    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
    cameraRef.current?.fitBounds(ne, sw, [200, 60, 300, 60], 1400);

    const timer = setTimeout(() => setFollowMode('follow'), 1600);
    return () => clearTimeout(timer);
  }, [nearestPendingStop, currentLocation]);

useEffect(() => {
  // Guard: Don't run if map isn't ready or we don't have location yet
  if (!mapReady || !currentLocation || !nearestPendingStop || introPlayedRef.current) {
    return;
  }

  // Two-phase intro:
  // Phase 1 — frame the whole route (user + all remaining stops) so the
  // user sees where they're going. Held for ~2.5s.
  // Phase 2 — zoom in on the user's current location and hand off to
  // follow mode for live navigation.
  const startTimer = setTimeout(() => {
    introPlayedRef.current = true;

    const stopCoords = orderedRemainingStops.map((s) => s.coordinate);
    const allCoords: [number, number][] = [currentLocation, ...stopCoords];
    const lngs = allCoords.map((c) => c[0]);
    const lats = allCoords.map((c) => c[1]);
    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];

    cameraRef.current?.fitBounds(ne, sw, [180, 60, 220, 60], 1400);

    // Phase 2 — after the user has seen the full route, zoom in on them.
    setTimeout(() => {
      cameraRef.current?.setCamera({
        centerCoordinate: currentLocation,
        zoomLevel: 16,
        heading: 0,
        animationDuration: 1400,
        animationMode: 'flyTo',
      });
    }, 2500);
  }, 500);

  return () => clearTimeout(startTimer);
}, [currentLocation, mapReady, nearestPendingStop, orderedRemainingStops]);
  useEffect(() => {
    if (!cameraRef.current || !mapReady) {
      return;
    }

    // Skip the auto-fit to full-route bounds when the intro sequence is
    // responsible for framing the camera on the next destination. Without
    // this guard, the bounds-fit immediately overrides the intro's zoom.
    if (nearestPendingStop) {
      return;
    }

    const allSegmentCoords = [
      ...completedRoadSegments.flat(),
      ...completedAirSegments.flat(),
      ...roadSegments.flat(),
      ...airSegments.flat(),
    ];
    const coordinates: [number, number][] =
      allSegmentCoords.length >= 2
        ? allSegmentCoords
        : orderedPlaceStops.map((stop) => stop.coordinate);

    if (coordinates.length === 0) {
      return;
    }

    if (coordinates.length === 1) {
      cameraRef.current.setCamera({
        centerCoordinate: coordinates[0],
        zoomLevel: 13,
        animationDuration: 900,
        animationMode: 'easeTo',
      });
      return;
    }

    const longitudes = coordinates.map((c) => c[0]);
    const latitudes = coordinates.map((c) => c[1]);
    const ne: [number, number] = [Math.max(...longitudes), Math.max(...latitudes)];
    const sw: [number, number] = [Math.min(...longitudes), Math.min(...latitudes)];

    cameraRef.current.fitBounds(ne, sw, [170, 36, 180, 36], 900);
  }, [airSegments, completedAirSegments, completedRoadSegments, mapReady, nearestPendingStop, orderedPlaceStops, roadSegments]);

  useEffect(() => {
    const hasCompletedTour = orderedPlaceStops.length > 0 && orderedRemainingStops.length === 0;

    if (hasCompletedTour) {
      setRoadSegments([]);
      setAirSegments([]);
      return;
    }

    // Route line connects today's events and locations in optimized order.
    const navigablePlaceStops =
      (tourStarted || hasVisitedProgress) && orderedRemainingStops.length > 0
        ? orderedRemainingStops
        : orderedPlaceStops;

    const routeStartCoordinate =
      ((tourStarted || hasVisitedProgress) ? routeAnchor : currentLocation) || null;

    const lineStops = [
      ...(routeStartCoordinate ? [routeStartCoordinate] : []),
      ...navigablePlaceStops.map((stop) => stop.coordinate),
    ];

    if (lineStops.length < 2) {
      setRoadSegments([]);
      setAirSegments([]);
      return;
    }

    let isMounted = true;
    setRoadSegments([]);
    setAirSegments([]);

    const fetchRoadRoute = async () => {
      try {
        if (!isMounted) return;
        const next = await buildRouteSegments(lineStops as [number, number][]);
        if (!isMounted) return;
        setRoadSegments(next.road);
        setAirSegments(next.air);
      } catch {
        if (isMounted) {
          setRoadSegments([lineStops as [number, number][]]);
          setAirSegments([]);
        }
      }
    };

    fetchRoadRoute();

    return () => {
      isMounted = false;
    };
  }, [buildRouteSegments, currentLocation, hasVisitedProgress, orderedPlaceStops, orderedRemainingStops, routeAnchor, tourStarted]);

  useEffect(() => {
    const completedStops = [
      ...(tourOrigin && visitedStopsInVisitOrder.length > 0
        ? [tourOrigin]
        : []),
      ...visitedStopsInVisitOrder.map((stop) => stop.coordinate),
    ];

    if (completedStops.length < 2) {
      setCompletedRoadSegments([]);
      setCompletedAirSegments([]);
      return;
    }

    let isMounted = true;
    setCompletedRoadSegments([]);
    setCompletedAirSegments([]);

    const fetchCompletedRoute = async () => {
      try {
        const next = await buildRouteSegments(completedStops as [number, number][]);
        if (!isMounted) return;
        setCompletedRoadSegments(next.road);
        setCompletedAirSegments(next.air);
      } catch {
        if (isMounted) {
          setCompletedRoadSegments([completedStops as [number, number][]]);
          setCompletedAirSegments([]);
        }
      }
    };

    fetchCompletedRoute();

    return () => {
      isMounted = false;
    };
  }, [buildRouteSegments, tourOrigin, visitedStopsInVisitOrder]);

  useEffect(() => {
    if (!isCompletedTour || !currentLocation) {
      setCompletedApproachRoadSegments([]);
      setCompletedApproachAirSegments([]);
      return;
    }

    const firstCompletedStop =
      visitedStopsInVisitOrder[0]?.coordinate || orderedPlaceStops[0]?.coordinate;

    if (!firstCompletedStop) {
      setCompletedApproachRoadSegments([]);
      setCompletedApproachAirSegments([]);
      return;
    }

    const sameSpot =
      Math.abs(firstCompletedStop[0] - currentLocation[0]) < 0.000001 &&
      Math.abs(firstCompletedStop[1] - currentLocation[1]) < 0.000001;

    if (sameSpot) {
      setCompletedApproachRoadSegments([]);
      setCompletedApproachAirSegments([]);
      return;
    }

    let isMounted = true;
    const lineStops: [number, number][] = [currentLocation, firstCompletedStop];
    setCompletedApproachRoadSegments([]);
    setCompletedApproachAirSegments([]);

    const fetchApproachRoute = async () => {
      try {
        const next = await buildRouteSegments(lineStops);
        if (!isMounted) return;
        setCompletedApproachRoadSegments(next.road);
        setCompletedApproachAirSegments(next.air);
      } catch {
        if (isMounted) {
          setCompletedApproachRoadSegments([lineStops]);
          setCompletedApproachAirSegments([]);
        }
      }
    };

    fetchApproachRoute();

    return () => {
      isMounted = false;
    };
  }, [buildRouteSegments, currentLocation, isCompletedTour, orderedPlaceStops, visitedStopsInVisitOrder]);

  useEffect(() => {
    if (!cameraRef.current || !mapReady || !isCompletedTour) {
      return;
    }

    const completedCoords = [
      ...completedRoadSegments.flat(),
      ...completedAirSegments.flat(),
    ];
    const fallbackCoords = orderedPlaceStops.map((stop) => stop.coordinate);
    const coordinates =
      completedCoords.length >= 2 ? completedCoords : fallbackCoords;

    if (coordinates.length === 0) {
      return;
    }

    if (coordinates.length === 1) {
      cameraRef.current.setCamera({
        centerCoordinate: coordinates[0],
        zoomLevel: 13,
        animationDuration: 900,
        animationMode: 'easeTo',
      });
      return;
    }

    const longitudes = coordinates.map((c) => c[0]);
    const latitudes = coordinates.map((c) => c[1]);
    const ne: [number, number] = [Math.max(...longitudes), Math.max(...latitudes)];
    const sw: [number, number] = [Math.min(...longitudes), Math.min(...latitudes)];

    cameraRef.current.fitBounds(ne, sw, [170, 36, 180, 36], 900);
  }, [
    completedAirSegments,
    completedRoadSegments,
    isCompletedTour,
    mapReady,
    orderedPlaceStops,
  ]);

  const routeLine = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: [...roadSegments, ...airSegments]
        .filter((seg) => seg.length >= 2)
        .map((seg) => ({
          type: 'Feature' as const,
          properties: {},
          geometry: { type: 'LineString' as const, coordinates: seg },
        })),
    }),
    [roadSegments, airSegments]
  );

  const completedRouteLine = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: [...completedRoadSegments, ...completedAirSegments]
        .filter((seg) => seg.length >= 2)
        .map((seg) => ({
          type: 'Feature' as const,
          properties: {},
          geometry: { type: 'LineString' as const, coordinates: seg },
        })),
    }),
    [completedAirSegments, completedRoadSegments]
  );

  const completedApproachRouteLine = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: [...completedApproachRoadSegments, ...completedApproachAirSegments]
        .filter((seg) => seg.length >= 2)
        .map((seg) => ({
          type: 'Feature' as const,
          properties: {},
          geometry: { type: 'LineString' as const, coordinates: seg },
        })),
    }),
    [completedApproachAirSegments, completedApproachRoadSegments]
  );
  const activeLegPolyline = useMemo<Coord[] | null>(() => {
    if (!activeLeg) return null;
    return legPolylines[activeLeg.key] || null;
  }, [activeLeg, legPolylines]);

  const activeLegCompletedShape = useMemo<FeatureCollection<LineString>>(() => {
    if (!activeLegPolyline || !currentLocation) {
      return { type: 'FeatureCollection', features: [] };
    }
    const projection = projectPointOnPolyline(currentLocation, activeLegPolyline);
    const { completed } = splitPolylineAt(activeLegPolyline, projection);
    if (completed.length < 2) {
      return { type: 'FeatureCollection', features: [] };
    }
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: completed },
      }],
    };
  }, [activeLegPolyline, currentLocation]);

  // Stop name labels (native SymbolLayer — renders at every zoom level reliably)
  const unvisitedStopLabels = useMemo<FeatureCollection<Point>>(() => ({
    type: 'FeatureCollection',
    features: tourStops
      .filter((s) => !placeProgress[s.id]?.visited)
      .map((s) => ({
        type: 'Feature' as const,
        properties: { name: s.title },
        geometry: { type: 'Point' as const, coordinates: [...s.coordinate] },
      })),
  }), [tourStops, placeProgress]);

  const visitedStopLabels = useMemo<FeatureCollection<Point>>(() => ({
    type: 'FeatureCollection',
    features: tourStops
      .filter((s) => Boolean(placeProgress[s.id]?.visited))
      .map((s) => ({
        type: 'Feature' as const,
        properties: { name: s.title },
        geometry: { type: 'Point' as const, coordinates: [...s.coordinate] },
      })),
  }), [tourStops, placeProgress]);

  // Midpoint distance labels between each consecutive ordered stop
  const distanceLabels = useMemo<FeatureCollection<Point>>(() => {
    const stops = (tourStarted || hasVisitedProgress) && orderedRemainingStops.length > 0
      ? orderedRemainingStops
      : orderedPlaceStops;
    const features = stops.slice(0, -1).map((stop, index) => {
      const next = stops[index + 1];
      const dist = distanceMetersBetween(stop.coordinate, next.coordinate);
      const label = dist >= 1000
        ? `${(dist / 1000).toFixed(1)} km`
        : `${Math.round(dist)} m`;
      return {
        type: 'Feature' as const,
        properties: { label },
        geometry: {
          type: 'Point' as const,
          coordinates: [
            (stop.coordinate[0] + next.coordinate[0]) / 2,
            (stop.coordinate[1] + next.coordinate[1]) / 2,
          ],
        },
      };
    });
    return { type: 'FeatureCollection', features };
  }, [hasVisitedProgress, orderedPlaceStops, orderedRemainingStops, tourStarted]);

  const totalEarnedPoints = useMemo(
    () =>
      Object.values(placeProgress).reduce(
        (sum, item) => sum + Number(item.pointsEarned || 0),
        0
      ),
    [placeProgress]
  );

  const routeDistanceKm = useMemo(() => {
    const allCoords: [number, number][] = [
      ...completedRoadSegments.flat(),
      ...completedAirSegments.flat(),
      ...roadSegments.flat(),
      ...airSegments.flat(),
    ];
    if (allCoords.length < 2) return 0;
    const meters = allCoords
      .slice(1)
      .reduce((sum: number, coord: [number, number], i: number) =>
        sum + distanceMetersBetween(allCoords[i], coord), 0);
    return meters / 1000;
  }, [airSegments, completedAirSegments, completedRoadSegments, roadSegments]);

  const currentMarkerNeedsStandalonePin = useMemo(
    () => Boolean(currentLocation),
    [currentLocation]
  );

  const updateSelectedStopPosition = useCallback(async (stop: TourStop) => {
    if (!mapRef.current) {
      return;
    }

    try {
      const point = await (mapRef.current as any).getPointInView(stop.coordinate);
      let x = Number(point?.[0] || 24) - DETAIL_CARD_WIDTH / 2;
      let y = Number(point?.[1] || 260) - DETAIL_CARD_HEIGHT - 42;

      x = Math.max(16, Math.min(SCREEN_WIDTH - DETAIL_CARD_WIDTH - 16, x));
      if (y < 92) {
        y = Number(point?.[1] || 260) + 40;
      }
      y = Math.min(SCREEN_HEIGHT - DETAIL_CARD_HEIGHT - 120, y);

      setCardPosition({ x, y });
    } catch {
      setCardPosition({ x: 24, y: 260 });
    }
  }, []);

  const handleMarkerPress = useCallback(
    async (stop: TourStop) => {
      cameraRef.current?.setCamera({
        centerCoordinate: stop.coordinate,
        zoomLevel: 16.1,
        pitch: 0,
        heading: 0,
        animationDuration: 900,
        animationMode: 'flyTo',
      });

      if (stop.event) {
        setSelectedStop(null);
        setSelectedEvent(stop.event);
        return;
      }

      setSelectedEvent(null);
      setSelectedStop(stop);
      await updateSelectedStopPosition(stop);
    },
    [updateSelectedStopPosition]
  );

  const handleEventMarkerPress = useCallback(
    (event: FirebaseEvent) => {
    if (
      event.coordinates?.longitude === undefined ||
      event.coordinates?.latitude === undefined
    ) {
      return;
    }

      const stop =
        activeTodayEventStops.find((item) => item.id === event.id) ||
        expiredTodayEventStops.find((item) => item.id === event.id) ||
        eventToTourStop(
          event,
          isEventTimeExpired(event) ? 'expired' : 'active'
        );

      handleMarkerPress(stop);
    },
    [activeTodayEventStops, expiredTodayEventStops, handleMarkerPress]
  );

  const handleDismissTodayEvent = useCallback((eventId: string) => {
    const now = new Date().toISOString();
    setEventProgress((prev) => ({
      ...prev,
      [eventId]: {
        ...prev[eventId],
        dismissed: true,
        visitedAt: now,
      },
    }));
    setSelectedEvent(null);
    showInfo('Event Skipped', 'This event is hidden for today. It will appear again on its scheduled day.');
  }, []);

  const handleRemoveEventFromTour = useCallback(
    async (eventId: string) => {
      if (!routeDetails) {
        return;
      }

      const nextEvents = routeDetails.events.filter((event) => event.id !== eventId);
      setRouteDetails((prev) =>
        prev
          ? {
              ...prev,
              events: nextEvents,
            }
          : prev
      );
      setEventProgress((prev) => {
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
      setSelectedEvent(null);
      setIsEdited(true);

      if (user?.id) {
        try {
          await saveUserTour({
            tourId: tourIdRef.current,
            userId: user.id,
            userName: user.name || '',
            userEmail: user.email || '',
            route: routeDetails.route,
            title: route.params?.tourName || routeDetails.route.name,
            places:
              orderedPlacesForSave.length > 0
                ? orderedPlacesForSave
                : tourStops.map((stop) => stop.place!).filter(Boolean),
            events: nextEvents,
            placeProgress,
            eventProgress,
            currentStopIndex: 0,
            isEdited: true,
            status: tourStarted ? 'active' : 'paused',
            startedAt: startedAt || new Date().toISOString(),
            completedAt: null,
            tourOrigin: tourOriginRef.current,
            navigableRoute: buildNavigableRouteFromStops(orderedNavigableStops),
          });
        } catch {
          showError('Remove Failed', 'Unable to remove this event from the tour right now.');
        }
      }
    },
    [
      orderedPlacesForSave,
      placeProgress,
      route.params?.tourName,
      routeDetails,
      startedAt,
      tourStarted,
      tourStops,
      user?.email,
      user?.id,
      user?.name,
    ]
  );

  const handleDeleteStop = useCallback(
    async (stopId: string) => {
      setExtraPlaceIds((prev) => prev.filter((id) => id !== stopId));
      setRemovedPlaceIds((prev) =>
        prev.includes(stopId) ? prev : [...prev, stopId]
      );
      setIsEdited(true);
      setOptimizedOrder(null);
      lastSavedOptimizedOrderKeyRef.current = null;

      const nextStops = tourStops.filter((stop) => stop.id !== stopId);
      const nextPlaces =
        routeDetails?.places.filter((place) => place.id !== stopId) || [];
      const nextProgress = { ...placeProgress };
      delete nextProgress[stopId];

      setTourStops(nextStops);
      setRouteDetails((prev) =>
        prev
          ? {
              ...prev,
              places: nextPlaces,
            }
          : prev
      );
      setPlaceProgress(nextProgress);
      setSelectedStop(null);
      setRoadSegments([]);
      setAirSegments([]);
      setCompletedRoadSegments([]);
      setCompletedAirSegments([]);
      setCompletedApproachRoadSegments([]);
      setCompletedApproachAirSegments([]);
      setLegPolylines({});
      if (fetchedLegKeysRef.current) {
        fetchedLegKeysRef.current.clear();
      }
      setSavedTourOrder(null);

      pendingEditSaveRef.current = true;

      if (!user?.id || !routeDetails) {
        return;
      }

      try {
        if (isFavorite(stopId)) {
          await removeFromFavorites(stopId, 'Place');
        }
        await removeTourPlaceFromUserAndRecord({
          userId: user.id,
          tourId: tourIdRef.current || tourId,
          placeId: stopId,
        });

        showInfo('Location Removed', 'This stop was removed from your tour.');
      } catch {
        showError(
          'Remove Failed',
          'Unable to remove this location from your tour right now.'
        );
      }
    },
    [
      isFavorite,
      isPausedTour,
      placeProgress,
      removeFromFavorites,
      route.params?.tourName,
      routeDetails,
      startedAt,
      tourId,
      tourStarted,
      tourStops,
      user?.email,
      user?.id,
      user?.name,
    ]
  );

  const persistTourIfNeeded = useCallback(
    async (
      nextProgress: typeof placeProgress,
      nextStartedAt: string | null,
      forcedStatus?: 'active' | 'completed' | 'paused' | 'scheduled',
      forceCreate = false
    ) => {
      if (!routeDetails || !user?.id) {
        return null;
      }

      const hasVisited = Object.values(nextProgress).some((item) => item.visited);
      const forcePersist =
        forceCreate ||
        (forcedStatus === 'paused' && Boolean(tourId || nextStartedAt));
      if (!isEdited && !hasVisited && !forcePersist) {
        return null;
      }

      const activePlaceStops = tourStops.map((stop) => stop.place!).filter(Boolean);
      const placesToSave =
        orderedPlacesForSave.length > 0 ? orderedPlacesForSave : activePlaceStops;

      const shouldDeferActiveSave =
        tourStarted &&
        !!tourIdRef.current &&
        !optimizedOrder &&
        !savedTourOrder &&
        routePlaceStops.length > 1;
      if (shouldDeferActiveSave) {
        pendingEditSaveRef.current = true;
        return tourIdRef.current;
      }

      const nextCurrentStopIndex = placesToSave.findIndex(
        (place) => !nextProgress[place.id]?.visited
      );
      const remainingStops = placesToSave.filter(
        (place) => !nextProgress[place.id]?.visited
      );
      const computedStatus = remainingStops.length === 0 ? 'completed' : 'active';
      const status = forcedStatus ?? computedStatus;
      const savedId = await saveUserTour({
        tourId: tourIdRef.current,
        userId: user.id,
        userName: user.name || '',
        userEmail: user.email || '',
        route: routeDetails.route,
        title: route.params?.tourName || routeDetails.route.name,
        places: placesToSave,
        events: routeDetails.events,
        placeProgress: nextProgress,
        eventProgress,
        currentStopIndex:
          nextCurrentStopIndex < 0 ? placesToSave.length : nextCurrentStopIndex,
        isEdited,
        status,
        startedAt: nextStartedAt || new Date().toISOString(),
        completedAt: status === 'completed' ? new Date().toISOString() : null,
        tourOrigin: tourOriginRef.current,
        navigableRoute: buildNavigableRouteFromStops(orderedNavigableStops),
      });
      tourIdRef.current = savedId;
      setTourId(savedId);
      return savedId;
    },
    [
      isEdited,
      orderedPlacesForSave,
      route.params?.tourName,
      routeDetails,
      tourStops,
      tourId,
      user?.email,
      user?.id,
      user?.name,
    ]
  );
  const pauseTourState = useCallback(async () => {
    if (leavingRef.current || isCompletedTour) {
      return tourId || null;
    }

    leavingRef.current = true;
    setTourStarted(false);
    setIsPausedTour(true);
    setSelectedStop(null);
    setSelectedEvent(null);
    const savedId = await persistTourIfNeeded(placeProgress, startedAt, 'paused').catch(() => null);
    showInfo('Tour Paused', 'You can resume this tour anytime.');
    return savedId || tourId || null;
  }, [isCompletedTour, persistTourIfNeeded, placeProgress, startedAt, tourId]);

  // Expose tour-active state to the TabNavigator so it can intercept any
  // tab press while a tour is running. Reading route.params from the
  // navigator level is more reliable than chasing parent listeners.
  useEffect(() => {
    navigation.setParams({ tourActive: tourStarted });
  }, [navigation, tourStarted]);

  // Intercept back navigation when tour is active — offer pause or stay
  useEffect(() => {
    if (!tourStarted) return;

    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (leavingRef.current) {
        return;
      }
      e.preventDefault();
      CustomAlert.alert(
        'Leave Tour?',
        'Your tour will be paused. You can resume from where you left off.',
        [
          { text: 'Stay on Tour', style: 'cancel' },
          {
            text: 'Pause & Leave',
            onPress: async () => {
              await pauseTourState();
              navigation.dispatch(e.data.action);
            },
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, pauseTourState, tourStarted]);

  // Tab-press interception happens in TabNavigator (more reliable than
  // chasing parent listeners). When the user chooses "Pause & Leave" in
  // that alert, TabNavigator re-navigates here with `pauseAndLeave` set;
  // we react to that param and persist the paused state.
  useEffect(() => {
    if (!tourStarted) {
      leavingRef.current = false;
      return;
    }
    const pauseAndLeave = route.params?.pauseAndLeave;
    if (!pauseAndLeave) return;

    pauseTourState().then((savedId) => {
      navigation.setParams({ pauseAndLeave: undefined });
      navigation.navigate('MyTour', {
        tourUpdate: {
          tourId: savedId || tourId || undefined,
          routeId: routeId,
          status: 'paused',
          updatedAt: new Date().toISOString(),
        },
      });
    });
  }, [navigation, pauseTourState, route.params?.pauseAndLeave, routeId, tourId, tourStarted]);

  const handleStopFavorite = async (place: FirebasePlace) => {
    if (isFavorite(place.id)) {
      await removeFromFavorites(place.id, 'Place');
      showInfo('Removed from Favorites', 'You have Removed from favorites successfully');
      return;
    }

    await addToFavorites({
      id: place.id,
      title: place.name,
      description: place.description || place.address || 'Location',
      rating: String(place.rating || 0),
      image: place.imageUrl || '',
      category: 'Place',
      routeName: 'RecommendationDetials',
      routeParams: { item: place },
      city_name: place.city_name,
      country: place.country,
    });
    const activeTourId = tourIdRef.current || tourId;
    if (activeTourId) {
      await recordTourFavoritedPlace(activeTourId, place.id).catch(() => {});
    }
    showSuccess('Added to Favorites', 'You have Added to favorites successfully');
  };

const handleCurrentLocation = useCallback(async (zoom = true) => {
  const currentLoc = currentLocationRef.current;
  if (currentLoc && zoom) {
    cameraRef.current?.setCamera({
      centerCoordinate: currentLoc,
      zoomLevel: 15,
      animationDuration: 500,
      animationMode: 'easeTo',
    });
    setFollowMode('follow');
  }

  const getPos = (): Promise<[number, number]> =>
    new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
        () => {
          Geolocation.getCurrentPosition(
            (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
            reject,
            { enableHighAccuracy: false, timeout: 2000 }
          );
        },
        { enableHighAccuracy: true, timeout: 3000 }
      );
    });

  try {
    const pos = await getPos();
    setCurrentLocation(pos);
    if (zoom) {
      cameraRef.current?.setCamera({
        centerCoordinate: pos,
        zoomLevel: 15,
        animationDuration: 500,
        animationMode: 'easeTo',
      });
      setFollowMode('follow');
    }
  } catch {
    // Fail silently or show toast
  }
}, []);

  useEffect(() => {
    handleCurrentLocation(false);
  }, [handleCurrentLocation]);

  const handlePauseTour = async () => {
    if (isCompletedTour) {
      return;
    }
    const savedId = await pauseTourState();
    navigation.navigate('MyTour', {
      tourUpdate: {
        tourId: savedId || tourId || undefined,
        routeId: routeId,
        status: 'paused',
        updatedAt: new Date().toISOString(),
      },
    });
  };


  const handleEventVerification = async (imageUri: string) => {
    const event = selectedEvent || selectedStop?.event;
    if (!event) {
      return false;
    }

    const eventCoordinate: [number, number] = [
      Number(event.coordinates?.longitude || 0),
      Number(event.coordinates?.latitude || 0),
    ];

    try {
      const coords = ALLOW_ANY_IMAGE_FOR_TESTING
        ? currentLocation || eventCoordinate
        : await getCurrentPositionAsync();

      const expectedNextStop = orderedRemainingStops[0];
      const eventStopId = event.id;
      if (expectedNextStop && expectedNextStop.id !== eventStopId) {
        showInfo(
          'Next Stop First',
          `Please complete your next route stop first: ${expectedNextStop.title}.`
        );
        return false;
      }

      if (!ALLOW_ANY_IMAGE_FOR_TESTING) {
        const distance = distanceMetersBetween(coords, eventCoordinate);

        if (distance > VISIT_DISTANCE_THRESHOLD_METERS) {
          showError(
            'Verification Failed',
            'You need to be near this event to confirm attendance.'
          );
          return false;
        }
      }

      const visitedAt = new Date().toISOString();
      setEventProgress((prev) => ({
        ...prev,
        [event.id]: {
          ...prev[event.id],
          attended: true,
          visitedAt,
          proofImageUri: imageUri,
        },
      }));
      setSelectedEvent(null);
      setSelectedStop(null);
      showSuccess('Event Attended', `You checked in at ${event.title}.`);

      const nextUnvisited = orderedRemainingStops.find(
        (stop) => stop.id !== event.id && !isStopComplete(stop)
      );
      if (nextUnvisited) {
        setTimeout(() => {
          cameraRef.current?.setCamera({
            centerCoordinate: nextUnvisited.coordinate,
            zoomLevel: 15,
            animationDuration: 1000,
            animationMode: 'flyTo',
          });
        }, 700);
      }

      return true;
    } catch {
      showError(
        'Verification Failed',
        'Unable to verify your location right now.'
      );
      return false;
    }
  };

  const handleVisitVerification = async (imageUri: string) => {
    if (scanForEvent || selectedStop?.event) {
      return handleEventVerification(imageUri);
    }

    if (!selectedStop?.place) {
      return false;
    }

    try {
      const coords = ALLOW_ANY_IMAGE_FOR_TESTING
        ? currentLocation || selectedStop.coordinate
        : await getCurrentPositionAsync();

      // Gate confirmation by the SAME ordering used everywhere else
      // (optimized road-distance order). Straight-line nearest gives a
      // different answer in cities and confuses the user — e.g. the beep
      // fires at Urdu Bazar but a straight-line check insists Mall Road
      // is "nearer" because km distance is smaller.
      const expectedNextStop = orderedRemainingStops[0];

      if (expectedNextStop && expectedNextStop.id !== selectedStop.id) {
        showInfo(
          'Next Stop First',
          `Please confirm your next stop in route order first: ${expectedNextStop.title}.`
        );
        return false;
      }

      if (!ALLOW_ANY_IMAGE_FOR_TESTING) {
        const distance = distanceMetersBetween(coords, selectedStop.coordinate);

        if (distance > VISIT_DISTANCE_THRESHOLD_METERS) {
          showError(
            'Verification Failed',
            'You need to be near this location to confirm your visit.'
          );
          return false;
        }
      }

      const visitedAt = new Date().toISOString();
      const pointsEarned = Number(selectedStop.place.points || 10);
      const nextProgress = {
        ...placeProgress,
        [selectedStop.id]: {
          ...placeProgress[selectedStop.id],
          visited: true,
          visitedAt,
          proofImageUri: imageUri,
          pointsEarned,
          addedByUser:
            placeProgress[selectedStop.id]?.addedByUser ||
            extraPlaceIds.includes(selectedStop.id),
        },
      };

      setTourOrigin((prev) => prev || coords);
      setCurrentLocation(selectedStop.coordinate);
      setPlaceProgress(nextProgress);
      setTourStarted(true);
      const nextStartedAt = startedAt || new Date().toISOString();
      setStartedAt(nextStartedAt);
      let savedTourId: string | null = tourId;
      try {
        savedTourId = await persistTourIfNeeded(nextProgress, nextStartedAt);
      } catch (error) {
        if (!ALLOW_ANY_IMAGE_FOR_TESTING) {
          throw error;
        }
      }

      if (user?.id && savedTourId && pointsEarned > 0) {
        try {
          await addUserVisitPoints({
            userId: user.id,
            tourId: savedTourId,
            placeId: selectedStop.place.id,
            pointsToAdd: pointsEarned,
          });
          dispatch(setUserPoints((user.points || 0) + pointsEarned));
        } catch (err) {
          console.warn('[MyTourStart] failed to add visit points', err);
        }
      }
      const allDone = allRouteStops.every((stop) => {
        if (stop.kind === 'event') {
          return isStopComplete(stop);
        }
        return Boolean(nextProgress[stop.id]?.visited);
      });
      if (allDone) {
        setRoadSegments([]);
        setAirSegments([]);
        setTourStarted(false);
        setTourActionVisible(false);
        setIsCompletedTour(true);
        setTourCompletedVisible(true);
      }

      // Auto-advance camera to next nearest unvisited stop
      if (!allDone) {
        const nextUnvisited =
          orderedRemainingStops.find((stop) => stop.id !== selectedStop.id) ||
          orderStopsByNearest(
            allRouteStops.filter((stop) => !isStopComplete(stop)),
          selectedStop.coordinate
        )[0];
        if (nextUnvisited) {
          setTimeout(() => {
            cameraRef.current?.setCamera({
              centerCoordinate: nextUnvisited.coordinate,
              zoomLevel: 15,
              animationDuration: 1000,
              animationMode: 'flyTo',
            });
          }, 700);
        }
      }

      return true;
    } catch {
      showError(
        'Verification Failed',
        'Unable to verify your location right now.'
      );
      return false;
    }
  };

  const centerCoordinate = useMemo<[number, number]>(() => {
    return currentLocation || orderedPlaceStops[0]?.coordinate || [-118.3014, 34.063];
  }, [currentLocation, orderedPlaceStops]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.BUTTON_COLOR} />
      </View>
    );
  }
return (
    <View style={styles.container}>
      <TopHeader title="My Tour" />
      <View style={styles.background}>
        <View style={styles.mapContainer}>
          {Config.MAPBOX_TOKEN && mapReady ? (
            <Mapbox.MapView
              ref={mapRef}
              style={styles.map}
              styleURL={Mapbox.StyleURL.Street}
              projection="mercator"
              logoEnabled={false}
              attributionEnabled={false}
              compassEnabled={false}
              scaleBarEnabled={false}
              rotateEnabled
              pitchEnabled
              scrollEnabled
              zoomEnabled
              surfaceView={false}
              onCameraChanged={() => {
                if (selectedStop) {
                  updateSelectedStopPosition(selectedStop).catch(() => { });
                }
              }}
              onRegionDidChange={(feature: any) => {
                if (feature?.properties?.isUserInteraction && followMode === 'follow') {
                  setFollowMode('free');
                }
              }}
              onPress={() => {
                setSelectedStop(null);
                setSelectedEvent(null);
              }}
            >
              <Mapbox.Camera
                ref={cameraRef}
                defaultSettings={{
                  centerCoordinate,
                  zoomLevel: 12.6,
                  pitch: 0,
                  heading: 0,
                }}
                animationMode="easeTo"
                animationDuration={900}
              />

              {completedRouteLine.features.length > 0 && (
                <Mapbox.ShapeSource id="completedTourRouteLine" shape={completedRouteLine}>
                  <Mapbox.LineLayer id="completedTourRouteLineLayer" style={completedRouteLineLayerStyle} />
                </Mapbox.ShapeSource>
              )}

              {completedApproachRouteLine.features.length > 0 && (
                <Mapbox.ShapeSource id="completedApproachRouteLine" shape={completedApproachRouteLine}>
                  <Mapbox.LineLayer id="completedApproachRouteLineLayer" style={completedRouteLineLayerStyle} />
                </Mapbox.ShapeSource>
              )}

              {routeLine.features.length > 0 && (
                <Mapbox.ShapeSource id="tourRouteLine" shape={routeLine}>
                  <Mapbox.LineLayer id="tourRouteLineLayer" style={routeLineLayerStyle} />
                </Mapbox.ShapeSource>
              )}

              <Mapbox.ShapeSource id="activeLegCompletedLine" shape={activeLegCompletedShape}>
                <Mapbox.LineLayer id="activeLegCompletedLineLayer" style={completedRouteLineLayerStyle} />
              </Mapbox.ShapeSource>

              {distanceLabels.features.length > 0 && (
                <Mapbox.ShapeSource id="distanceLabels" shape={distanceLabels}>
                  <Mapbox.SymbolLayer id="distanceLabelLayer" style={distanceLabelStyle} />
                </Mapbox.ShapeSource>
              )}

              {/* Stop name labels — native Mapbox rendering, visible at every zoom level */}
              <Mapbox.ShapeSource id="unvisitedStopLabels" shape={unvisitedStopLabels}>
                <Mapbox.SymbolLayer id="unvisitedStopNameLayer" style={stopNameLabelStyle} />
              </Mapbox.ShapeSource>
              <Mapbox.ShapeSource id="visitedStopLabels" shape={visitedStopLabels}>
                <Mapbox.SymbolLayer id="visitedStopNameLayer" style={visitedStopNameLabelStyle} />
              </Mapbox.ShapeSource>

              {tourStops.map((stop) => {
                const visited = Boolean(placeProgress[stop.id]?.visited);
                const isNextPending =
                  !visited && nearestPendingStop?.id === stop.id;
                return (
                  <Mapbox.MarkerView
                    key={stop.id}
                    id={stop.id}
                    coordinate={[...stop.coordinate]}
                    anchor={{ x: 0.5, y: 1 }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleMarkerPress(stop)}
                      style={styles.markerTapArea}
                    >
                      {visited ? (
                        <GrayMapIcon width={35} height={46} />
                      ) : isNextPending ? (
                        <PulsingPin />
                      ) : (
                        <BlueMapIcon width={35} height={46} />
                      )}
                    </TouchableOpacity>
                  </Mapbox.MarkerView>
                );
              })}

              {tourStarted
                ? activeTodayEventStops.map((stop) => {
                    const isNextPending =
                      !isStopComplete(stop) && nearestPendingStop?.id === stop.id;
                    return (
                <Mapbox.MarkerView
                  key={`event-${stop.id}`}
                  id={`event-${stop.id}`}
                  coordinate={[...stop.coordinate]}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Show event ${stop.title}`}
                          onPress={() => handleMarkerPress(stop)}
                    style={styles.markerTapArea}
                  >
                          {isNextPending ? (
                            <View style={styles.eventMarkerPulseWrap}>
                              <PulsingPin />
                              <View
                                style={[
                                  styles.eventMarkerOnPulse,
                                  eventMarkerColors(stop.event!),
                                ]}
                              >
                                <EventMarkerIcon event={stop.event!} size={26} />
                    </View>
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.eventMarker,
                                eventMarkerColors(stop.event!),
                              ]}
                            >
                              <EventMarkerIcon event={stop.event!} size={28} />
                            </View>
                          )}
                  </TouchableOpacity>
                </Mapbox.MarkerView>
                    );
                  })
                : null}

              {tourStarted
                ? expiredTodayEventStops.map((stop) => (
                    <Mapbox.MarkerView
                      key={`event-expired-${stop.id}`}
                      id={`event-expired-${stop.id}`}
                      coordinate={[...stop.coordinate]}
                      anchor={{ x: 0.5, y: 1 }}
                    >
                      <TouchableOpacity
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`Show passed event ${stop.title}`}
                        onPress={() => handleMarkerPress(stop)}
                        style={styles.markerTapArea}
                      >
                        <View style={styles.eventMarkerExpired}>
                          <EventMarkerIcon event={stop.event!} size={26} />
                        </View>
                      </TouchableOpacity>
                    </Mapbox.MarkerView>
                  ))
                : null}

              {currentLocation && currentMarkerNeedsStandalonePin ? (
                <Mapbox.MarkerView
                  id="currentUserLocationMarker"
                  coordinate={[...currentLocation]}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={userPinStyles.outer}>
                    <View style={userPinStyles.inner} />
                    <View
                      style={[
                        userPinStyles.arrowWrap,
                        {
                          transform: [
                            {
                              rotate: `${followMode === 'follow' ? 0 : userHeading}deg`,
                            },
                          ],
                        },
                      ]}
                      pointerEvents="none"
                    >
                      <View style={userPinStyles.arrow} />
                    </View>
                  </View>
                </Mapbox.MarkerView>
              ) : null}
            </Mapbox.MapView>
          ) : (
            <View style={styles.mapFallback}>
              <Text style={styles.mapFallbackText}>
                {Config.MAPBOX_TOKEN ? 'Loading map...' : 'Mapbox token missing'}
              </Text>
            </View>
          )}
        </View>

        {tourStarted && nearestPendingStop && currentLocation ? (
          <NextStopBanner
            stopName={
              nearestPendingStop.kind === 'event'
                ? `Event · ${nearestPendingStop.title}`
                : nearestPendingStop.title
            }
            distanceMeters={distanceMetersBetween(
              currentLocation,
              nearestPendingStop.coordinate
            )}
          />
        ) : null}

        {tourStarted ? (
          <RecenterButton
            active={followMode === 'free'}
            onPress={() => {
              if (currentLocation) {
                cameraRef.current?.setCamera({
                  centerCoordinate: currentLocation,
                  zoomLevel: 16,
                  animationDuration: 700,
                  animationMode: 'easeTo',
                });
              }
              setFollowMode('follow');
            }}
          />
        ) : null}

        <ZoomControls
          onZoomIn={() => handleZoom('in')}
          onZoomOut={() => handleZoom('out')}
        />

        <View style={styles.distancePill}>
          <Text style={styles.distancePillText}>
            {routeDistanceKm > 0 ? `${routeDistanceKm.toFixed(1)} km route` : 'Route loading'}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.currentLocationBtn}
          onPress={() => handleCurrentLocation()}
        >
          <View style={styles.currentLocationOuter}>
            <View style={styles.currentLocationInner} />
          </View>
        </TouchableOpacity>

        {selectedStop && (
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => { }}
            style={[
              styles.detailCard,
              styles.detailCardPosition,
              { left: cardPosition.x, top: cardPosition.y },
            ]}
          >
            {/* <Image
              source={{ uri: selectedStop.place?.imageUrl || currentRoute.image }}
              style={styles.cardImage}
            /> */}

            <View style={styles.topRow}>
              <ImageBackground
                source={{ uri: selectedStop.place?.imageUrl || currentRoute.image }}
                style={styles.cardImage}
              >

                <View style={styles.pill}>
                  <WhiteFork width={10} height={10} />
                  <Text style={styles.pillText}>Location</Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    selectedStop.place && handleStopFavorite(selectedStop.place)
                  }
                  style={{ marginTop: 8, marginRight: 8 }}
                >
                  {selectedStop.place && isFavorite(selectedStop.place.id) ? (
                    <RedHeartIcon width={16} height={16} />
                  ) : (
                    <WhiteHeart width={16} height={16} />
                  )}
                </TouchableOpacity>
              </ImageBackground>
            </View>

            <View style={styles.textBlock}>
              <Text style={styles.cardTitle}>{selectedStop.title}</Text>
              <Text style={styles.cardSubtitle}
                numberOfLines={expanded ? undefined : 3}
              >
                {selectedStop.place?.description || selectedStop.place?.address || 'Favorite place'}
              </Text>
              <TouchableOpacity onPress={() => setExpanded(!expanded)}>
                <Text style={styles.readMore}>
                  {expanded ? "Show Less" : "Read More"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <StarIcon width={9} height={9} />
                <Text style={styles.infoText}>{String(selectedStop.place?.rating || 0)}</Text>
              </View>
              <View style={styles.infoItem}>
                <LocationIcon width={8} height={8} />
                <Text style={styles.infoText}>{selectedStop.place?.city_name || routeDetails?.route.city_name}</Text>
              </View>
              <View style={styles.infoItem}>
                <TimeIcon width={8} height={8} />
                <Text style={styles.openText}>Open Now</Text>
              </View>
            </View>

            {!isCompletedTour ? (
              <View style={styles.bottomRow}>
                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    (!selectedStopIsNearestPending ||
                      Boolean(placeProgress[selectedStop.id]?.visited)) &&
                    styles.confirmBtnDisabled,
                  ]}
                  onPress={() => {
                    if (!selectedStopIsNearestPending) {
                      const nearestTitle = nearestPendingStop?.title || 'the nearest location';
                      showInfo(
                        'Nearest Stop Required',
                        `Please confirm ${nearestTitle} before this stop.`
                      );
                      return;
                    }

                    setScanForEvent(false);
                    setScanVisible(true);
                  }}
                  disabled={Boolean(placeProgress[selectedStop.id]?.visited)}
                >
                  <Text style={styles.confirmText}>
                    {placeProgress[selectedStop.id]?.visited
                      ? 'Visited'
                      : selectedStopIsNearestPending
                        ? 'Confirm Visit'
                        : 'Nearest Stop Only'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => handleDeleteStop(selectedStop.id)}
                >
                  <DeleteWhiteIcon width={24} height={24} />
                </TouchableOpacity>
              </View>
            ) : null}
            {!isCompletedTour && !placeProgress[selectedStop.id]?.visited && !selectedStopIsNearestPending ? (
              <Text style={styles.nearestStopHint}>
                Confirm {nearestPendingStop?.title || 'the nearest location'} first to unlock this stop.
              </Text>
            ) : null}
          </TouchableOpacity>
        )}

        {isCompletedTour ? (
          <View style={styles.rowButtons}>
            <TouchableOpacity
              style={[styles.startTourBtn, styles.startTourBtnStarted]}
              disabled
            >
              <Text style={[styles.btnText, { color: COLORS.WHITE }]}>
                Tour Completed
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.rowButtons}>
            <TouchableOpacity
              style={styles.startTourBtn}
              onPress={handlePauseTour}
            >
              <Text style={[styles.btnText, { color: COLORS.WHITE }]}>
                Pause Tour
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <ScanVerifyModal
          visible={scanVisible}
          title={
            scanForEvent
              ? selectedEvent?.title || 'this event'
              : selectedStop?.title || 'this location'
          }
          successPoints={
            scanForEvent ? 0 : Number(selectedStop?.place?.points || 10)
          }
          onClose={() => {
            setScanVisible(false);
            setScanForEvent(false);
            if (scanForEvent) {
              setSelectedEvent(null);
            } else {
            setSelectedStop(null);
            }
          }}
          onScanSuccess={handleVisitVerification}
        />

        <EventDetailModal
          visible={Boolean(selectedEvent)}
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          statusMessage={
            selectedEvent && (eventProgress[selectedEvent.id]?.expired || isEventTimeExpired(selectedEvent))
              ? 'This event was scheduled for today, but its time has passed. It is marked complete on your route.'
              : selectedEvent && eventProgress[selectedEvent.id]?.attended
                ? 'You have already checked in to this event.'
                : selectedEvent && nearestPendingStop?.id === selectedEvent.id
                  ? 'This is your next route stop. Confirm attendance when you arrive.'
                  : undefined
          }
          statusTone={
            selectedEvent && (eventProgress[selectedEvent.id]?.expired || isEventTimeExpired(selectedEvent))
              ? 'warning'
              : selectedEvent && eventProgress[selectedEvent.id]?.attended
                ? 'success'
                : 'info'
          }
          primaryActionLabel={
            selectedEvent && eventProgress[selectedEvent.id]?.attended
              ? 'Attended'
              : selectedEvent &&
                  (eventProgress[selectedEvent.id]?.expired || isEventTimeExpired(selectedEvent))
                ? undefined
                : 'Confirm Attendance'
          }
          onPrimaryAction={
            selectedEvent &&
            !eventProgress[selectedEvent.id]?.attended &&
            !eventProgress[selectedEvent.id]?.expired &&
            !isEventTimeExpired(selectedEvent)
              ? () => {
                  if (
                    nearestPendingStop &&
                    nearestPendingStop.id !== selectedEvent.id
                  ) {
                    showInfo(
                      'Next Stop First',
                      `Please complete ${nearestPendingStop.title} first.`
                    );
                    return;
                  }
                  setScanForEvent(true);
                  setScanVisible(true);
                }
              : undefined
          }
          primaryDisabled={Boolean(selectedEvent && eventProgress[selectedEvent.id]?.attended)}
          secondaryActionLabel={
            selectedEvent &&
            !eventProgress[selectedEvent.id]?.attended &&
            !eventProgress[selectedEvent.id]?.expired &&
            !isEventTimeExpired(selectedEvent)
              ? 'Skip for today'
              : undefined
          }
          onSecondaryAction={
            selectedEvent
              ? () => handleDismissTodayEvent(selectedEvent.id)
              : undefined
          }
          onRemoveFromTour={
            selectedEvent
              ? () => handleRemoveEventFromTour(selectedEvent.id)
              : undefined
          }
        />

        {tourCompletedVisible ? (
          <View style={styles.completionOverlay}>
            <TouchableOpacity
              activeOpacity={1}
              style={styles.completionBackdrop}
              onPress={() => setTourCompletedVisible(false)}
            />
            <View style={styles.completionCard}>
              <Text style={styles.completionEmoji}>🎉</Text>
              <Text style={styles.completionTitle}>Tour Completed Successfully</Text>
              <Text style={styles.completionText}>
                Amazing! You&apos;ve successfully visited all locations and earned
                a total of {totalEarnedPoints} points. Ready for your next
                adventure?
              </Text>
              <View style={styles.completionActions}>
                <TouchableOpacity
                  style={styles.completionCancelBtn}
                  onPress={() => setTourCompletedVisible(false)}
                >
                  <Text style={styles.completionCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.completionPrimaryBtn}
                  onPress={() => {
                    setTourCompletedVisible(false);
                    navigation.navigate('MyTour', {
                      tourUpdate: {
                        tourId: tourId || undefined,
                        routeId: routeId,
                        status: 'completed',
                        updatedAt: new Date().toISOString(),
                      },
                    });
                  }}
                >
                  <Text style={styles.completionPrimaryText}>Back To My Tour</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default MyTourStart;

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.BACKGROUND,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  background: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 30,
    backgroundColor: '#F6F2EC',
  },
  mapContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  map: {
    flex: 1,
  },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  mapFallbackText: {
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    fontSize: 13,
  },
  distancePill: {
    position: 'absolute',
    top: 18,
    left: 24,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  distancePillText: {
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    fontSize: 12,
  },
  markerTapArea: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  eventMarkerPulseWrap: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventMarkerOnPulse: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.BUTTON_COLOR,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
  },
  eventMarkerExpired: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EAB308',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 6,
  },
  todayEventBanner: {
    position: 'absolute',
    top: 52,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(244, 106, 58, 0.92)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 20,
  },
  todayEventBannerText: {
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.SMALL_TEXT,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
  eventActionCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 96,
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 16,
    zIndex: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  eventActionTitle: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.TEXT_PRIMARY,
  },
  eventActionMeta: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_SECONDARY,
  },
  eventActionHint: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_SECONDARY,
  },
  eventActionRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  skipEventBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  skipEventText: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
    color: COLORS.BUTTON_COLOR,
  },
  closeEventCardBtn: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  currentLocationBtn: {
    position: 'absolute',
    right: 34,
    bottom: 138,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.TEXT_PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
  },
  currentLocationOuter: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 3,
    borderColor: COLORS.WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLocationInner: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.WHITE,
  },
  detailCard: {
    padding: 8,
    width: 192,
    backgroundColor: COLORS.WHITE,
    // borderWidth: 3,
    // borderColor: COLORS.BUTTON_COLOR,
    // height:192,
    borderRadius: 10,
    overflow: 'hidden',
    // elevation: 10,
    zIndex: 100,
  },
  detailCardPosition: {
    position: 'absolute',
    zIndex: 100,
  },
  cardImage: {
    width: '100%',
    height: 90,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    // paddingHorizontal:8

  },
  topRow: {
    // marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pill: {
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginTop: 8,
    marginLeft: 8,
    // backgroundColor:'#00000060'
    backgroundColor: "rgba(0, 0, 0, 0.32)"
  },
  pillText: {
    fontSize: 9,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    color: COLORS.WHITE,
  },
  textBlock: {
    marginTop: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.TEXT_PRIMARY,
  },
  cardSubtitle: {
    fontSize: 12,
    // lineHeight: 17,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_SECONDARY,
  },
  divider: {
    marginTop: 8,
    height: 1,
    backgroundColor: '#E8E8E8',
  },
  infoRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 10,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_PRIMARY,
  },
  openText: {
    fontSize: 10,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_GREEN,
  },
  bottomRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmBtn: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    marginRight: 8,
    backgroundColor: '#F46A3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#E6B7AA',
  },
  confirmText: {
    color: COLORS.WHITE,
    fontSize: 13,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
  nearestStopHint: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.LOGOUT_TEXT,
  },
  rowButtons: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    zIndex: 30,
  },
  favoriteBtn: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  startTourBtn: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.BUTTON_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startTourBtnStarted: {
    opacity: 0.95,
  },
  actionOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 110,
    justifyContent: 'flex-end',
  },
  actionBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  actionSheet: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 34,
    gap: 12,
  },
  actionTitle: {
    textAlign: 'center',
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    fontSize: 20,
    marginBottom: 4,
  },
  actionPrimaryBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.BUTTON_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimaryText: {
    color: COLORS.WHITE,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
    fontSize: 16,
  },
  actionDangerBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FEECEC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F7B5B5',
  },
  actionDangerText: {
    color: '#D92D20',
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
    fontSize: 16,
  },
  actionCancelBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  actionCancelText: {
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    fontSize: 16,
  },
  completionOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  completionBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  completionCard: {
    width: '100%',
    backgroundColor: COLORS.WHITE,
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
  },
  completionEmoji: {
    fontSize: 34,
  },
  completionTitle: {
    marginTop: 10,
    fontSize: 20,
    textAlign: 'center',
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.TEXT_PRIMARY,
  },
  completionText: {
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_SECONDARY,
  },
  completionActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  completionCancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.WHITE,
  },
  completionPrimaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.BUTTON_COLOR,
  },
  completionCancelText: {
    fontFamily: FONT_FAMILY.InterTight_Medium,
    color: COLORS.TEXT_PRIMARY,
    fontSize: FONT_SIZE.SMALL_TEXT,
  },
  completionPrimaryText: {
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
    color: COLORS.WHITE,
    fontSize: FONT_SIZE.SMALL_TEXT,
  },
  btnText: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
  },
  // Add Location action sheet button
  actionSecondaryBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.BUTTON_COLOR,
  },
  actionSecondaryText: {
    color: COLORS.BUTTON_COLOR,
    fontFamily: FONT_FAMILY.InterTight_SemiBold,
    fontSize: 16,
  },

  readMore: {
    // marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.BUTTON_COLOR,
  },
});