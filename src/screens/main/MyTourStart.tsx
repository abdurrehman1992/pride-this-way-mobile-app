import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  Alert,
  Animated,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
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
} from '../../constants/icons';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/fonts';
import ScanVerifyModal from '../../components/modals/ScanVerifyModal';
import TopHeader from '../../components/Home/TopHeader';
import EventDetailModal from '../../components/modals/EventDetailModal';
import {
  deleteUserTour,
  fetchPlacesByIds,
  fetchRouteDetails,
  FirebaseEvent,
  FirebasePlace,
  FirebaseRoute,
  fetchUserTourById,
  saveUserTour,
} from '../../services/myTourService';
import { useSelector } from 'react-redux';
import { RootState } from '../../Redux/store';

type TourStop = {
  id: string;
  title: string;
  coordinate: [number, number];
  place?: FirebasePlace;
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

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceInMeters = (
  from: [number, number],
  to: [number, number]
) => {
  const earthRadius = 6371000;
  const dLat = toRadians(to[1] - from[1]);
  const dLon = toRadians(to[0] - from[0]);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from[1])) *
      Math.cos(toRadians(to[1])) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

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
  const lat2 = toRad(to[1]);   const lon2 = toRad(to[0]);
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
    let nearestDistance = distanceInMeters(cursor, remaining[0].coordinate);

    for (let index = 1; index < remaining.length; index += 1) {
      const candidateDistance = distanceInMeters(cursor, remaining[index].coordinate);
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
    backgroundColor: '#1D82DD',
  },
  iconLayer: {
    width: 35,
    height: 46,
  },
});

const MyTourStart = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();
  const cameraRef = useRef<Mapbox.Camera>(null);
  const mapRef = useRef<Mapbox.MapView>(null);
  const user = useSelector((state: RootState) => state.auth.user);

  const [scanVisible, setScanVisible] = useState(false);
  const [tourStarted, setTourStarted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roadSegments, setRoadSegments] = useState<[number, number][][]>([]);
  const [airSegments, setAirSegments] = useState<[number, number][][]>([]);
  const [completedRoadSegments, setCompletedRoadSegments] = useState<[number, number][][]>([]);
  const [completedAirSegments, setCompletedAirSegments] = useState<[number, number][][]>([]);
  const [tourStops, setTourStops] = useState<TourStop[]>([]);
  const [tourId, setTourId] = useState<string | null>(route.params?.tourId || null);
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
  const [tourOrigin, setTourOrigin] = useState<[number, number] | null>(null);
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
  const [tourActionVisible, setTourActionVisible] = useState(false);
  const [isPausedTour, setIsPausedTour] = useState(false);
  const pendingEditSaveRef = useRef(false);
  const introPlayedRef = useRef(false);

  const fetchRoadSegment = useCallback(
    async (from: [number, number], to: [number, number]): Promise<[number, number][]> => {
      const dist = distanceInMeters(from, to);

      // Long distance — skip road routing and use a smooth great circle arc (airplane path)
      if (dist > ROAD_ROUTE_MAX_METERS) {
        return greatCircleArc(from, to);
      }

      if (!Config.MAPBOX_TOKEN) {
        return [from, to];
      }

      try {
        const { data } = await axios.get<DirectionsResponse>(
          // driving profile follows actual roads, not hiking trails
          `https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}`,
          {
            params: {
              access_token: Config.MAPBOX_TOKEN,
              geometries: 'geojson',
              overview: 'full',
              steps: false,
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
      } catch {
        // Fall back to straight line if API fails
      }

      return [from, to];
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
          const isAir = distanceInMeters(from as [number, number], to) > ROAD_ROUTE_MAX_METERS;
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
      fetchUserTourById(route.params?.tourId || null),
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
          const savedPlaces = await fetchPlacesByIds(
            savedTour.all_places.map((item) => item.place_id)
          );

          const mergedSavedPlaces = [
            ...savedPlaces,
            ...data.places.filter(
              (place) => !savedPlaces.some((savedPlace) => savedPlace.id === place.id)
            ),
          ];

          nextDetails = {
            ...data,
            places: mergedSavedPlaces,
          };
          nextProgress = savedTour.all_places.reduce<
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
          >((acc, item) => {
            acc[item.place_id] = {
              visited: item.visited,
              visitedAt: item.visitedAt,
              proofImageUri: item.proofImageUri,
              pointsEarned: item.pointsEarned,
              addedByUser: item.addedByUser,
            };
            return acc;
          }, {});
          const wasPaused = savedTour.status === 'paused';
          const wasCompleted = savedTour.status === 'completed';
          setTourStarted(savedTour.status === 'active');
          setIsPausedTour(wasPaused);
          setIsCompletedTour(wasCompleted);
          setTourId(savedTour.id);
          setStartedAt(savedTour.startedAt || null);
          setIsEdited(savedTour.isEdited || isEdited);
        }

        setPlaceProgress(nextProgress);
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
      })
      .finally(() => setLoading(false));
  }, [extraPlaceIds, isEdited, removedPlaceIds, route.params?.tourId, routeId, user?.id]);

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
      pendingEditSaveRef.current = true;
    });
  }, [route.params?.addedPlaceId]);

  // Persist to Firestore after tourStops updates from AddLocations
  useEffect(() => {
    if (!pendingEditSaveRef.current || !routeDetails || !user?.id) return;
    pendingEditSaveRef.current = false;

    const allPlaceStops = tourStops.map((s) => s.place!).filter(Boolean);
    if (allPlaceStops.length === 0) return;

    saveUserTour({
      tourId,
      userId: user.id,
      userName: user.name || '',
      userEmail: user.email || '',
      route: routeDetails.route,
      title: route.params?.tourName || routeDetails.route.name,
      places: allPlaceStops,
      events: routeDetails.events,
      placeProgress,
      currentStopIndex: 0,
      isEdited: true,
      status: 'active',
      startedAt: startedAt || new Date().toISOString(),
      completedAt: null,
    })
      .then((savedId) => { if (savedId !== tourId) setTourId(savedId); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourStops]);

  const placeStops = useMemo(() => tourStops, [tourStops]);

  const eventStops = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (routeDetails?.events || [])
      .filter((event) => {
        // Hide events whose end date (or start date if no end date) has passed
        if (event.endDate) {
          const end = new Date(event.endDate);
          end.setHours(23, 59, 59, 999);
          return end >= today;
        }
        if (event.startDate) {
          const start = new Date(event.startDate);
          return start >= today;
        }
        return true; // No date = always show
      })
      .filter(
        (event) =>
          event.coordinates?.longitude !== undefined &&
          event.coordinates?.latitude !== undefined
      )
      .map((event) => ({
        id: event.id,
        title: event.title,
        coordinate: [
          Number(event.coordinates?.longitude || 0),
          Number(event.coordinates?.latitude || 0),
        ] as [number, number],
        event,
      }));
  }, [routeDetails?.events]);

  const visitedStopsInVisitOrder = useMemo(
    () =>
      tourStops
        .filter((stop) => Boolean(placeProgress[stop.id]?.visited))
        .sort((a, b) => {
          const aTime = placeProgress[a.id]?.visitedAt || '';
          const bTime = placeProgress[b.id]?.visitedAt || '';
          return aTime.localeCompare(bTime);
        }),
    [placeProgress, tourStops]
  );

  const orderingAnchor = useMemo<[number, number] | null>(
    () => (tourStarted || visitedStopsInVisitOrder.length > 0 ? tourOrigin : currentLocation),
    [currentLocation, tourOrigin, tourStarted, visitedStopsInVisitOrder.length]
  );

  const orderedPlaceStops = useMemo(
    () => orderStopsByNearest(placeStops, orderingAnchor),
    [orderingAnchor, placeStops]
  );

  const routeAnchor = useMemo<[number, number] | null>(() => {
    return (
      visitedStopsInVisitOrder[visitedStopsInVisitOrder.length - 1]?.coordinate ||
      currentLocation ||
      null
    );
  }, [currentLocation, visitedStopsInVisitOrder]);

  const orderedRemainingStops = useMemo(
    () => orderedPlaceStops.filter((stop) => !placeProgress[stop.id]?.visited),
    [orderedPlaceStops, placeProgress]
  );

  const nearestPendingStop = useMemo(() => {
    if (!currentLocation || orderedRemainingStops.length === 0) {
      return null;
    }

    return orderedRemainingStops.reduce<TourStop>((nearest, stop) => {
      const nearestDistance = distanceInMeters(currentLocation, nearest.coordinate);
      const stopDistance = distanceInMeters(currentLocation, stop.coordinate);
      return stopDistance < nearestDistance ? stop : nearest;
    }, orderedRemainingStops[0]);
  }, [currentLocation, orderedRemainingStops]);

  const selectedStopIsNearestPending = useMemo(() => {
    if (!selectedStop || placeProgress[selectedStop.id]?.visited) {
      return false;
    }

    if (!nearestPendingStop) {
      return true;
    }

    return (
      nearestPendingStop.id === selectedStop.id ||
      distanceInMeters(nearestPendingStop.coordinate, selectedStop.coordinate) <=
        NEAREST_STOP_TOLERANCE_METERS
    );
  }, [nearestPendingStop, placeProgress, selectedStop]);

  useEffect(() => {
    handleCurrentLocation(false);
  }, [handleCurrentLocation]);

  useEffect(() => {
    if (
      introPlayedRef.current ||
      !cameraRef.current ||
      !mapReady ||
      !currentLocation ||
      !nearestPendingStop
    ) {
      return;
    }

    // Mark as played BEFORE scheduling timers so any in-flight re-render of
    // this effect (caused by state updates between now and the flyTo) bails
    // out at the guard above. We deliberately do NOT clear the timeout in
    // cleanup — if we did, a re-render between the easeTo and the flyTo
    // would cancel the flyTo and the user would only ever see the easeTo.
    introPlayedRef.current = true;

    const startCoord = currentLocation;
    const targetCoord = nearestPendingStop.coordinate;
    const targetHeading = tourStarted ? 18 : 0;

    cameraRef.current.setCamera({
      centerCoordinate: startCoord,
      zoomLevel: 14,
      animationDuration: 700,
      animationMode: 'easeTo',
    });

    setTimeout(() => {
      cameraRef.current?.setCamera({
        centerCoordinate: targetCoord,
        zoomLevel: 15.2,
        heading: targetHeading,
        animationDuration: 1600,
        animationMode: 'flyTo',
      });
    }, 800);
  }, [currentLocation, mapReady, nearestPendingStop, tourStarted]);

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

    // Route line ONLY connects places — events are informational markers only
    const navigablePlaceStops =
      (tourStarted || hasVisitedProgress) && orderedRemainingStops.length > 0
        ? orderedRemainingStops
        : orderedPlaceStops;

    // Second guard: exclude any coordinate that matches an event stop coordinate
    const eventCoordKeys = new Set(
      eventStops.map((s) => `${s.coordinate[0].toFixed(6)},${s.coordinate[1].toFixed(6)}`)
    );
    const filteredPlaceCoords = navigablePlaceStops
      .filter((stop) => {
        const key = `${stop.coordinate[0].toFixed(6)},${stop.coordinate[1].toFixed(6)}`;
        return !eventCoordKeys.has(key);
      })
      .map((stop) => stop.coordinate);

    const lineStops = [
      ...(((tourStarted || hasVisitedProgress) ? routeAnchor : currentLocation)
        ? [(((tourStarted || hasVisitedProgress) ? routeAnchor : currentLocation) as [number, number])]
        : []),
      ...filteredPlaceCoords,
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
  }, [buildRouteSegments, currentLocation, eventStops, hasVisitedProgress, orderedPlaceStops, orderedRemainingStops, routeAnchor, tourStarted]);

  useEffect(() => {
    const completedStops = [
      ...(tourOrigin && visitedStopsInVisitOrder.length > 0 ? [tourOrigin] : []),
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
      const dist = distanceInMeters(stop.coordinate, next.coordinate);
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
        sum + distanceInMeters(allCoords[i], coord), 0);
    return meters / 1000;
  }, [airSegments, completedAirSegments, completedRoadSegments, roadSegments]);

  const hasVisitedProgress = useMemo(
    () => Object.values(placeProgress).some((item) => item.visited),
    [placeProgress]
  );

  const canResumeTour =
    !isCompletedTour &&
    (isPausedTour || Boolean(tourId || hasVisitedProgress || startedAt));

  const currentMarkerNeedsStandalonePin = useMemo(() => {
    if (!currentLocation) {
      return false;
    }

    return !tourStops.some((stop) => {
      const dx = Math.abs(stop.coordinate[0] - currentLocation[0]);
      const dy = Math.abs(stop.coordinate[1] - currentLocation[1]);
      return dx < 0.000001 && dy < 0.000001;
    });
  }, [currentLocation, tourStops]);

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
      setSelectedEvent(null);
      setSelectedStop(stop);
      await updateSelectedStopPosition(stop);
    },
    [updateSelectedStopPosition]
  );

  const handleEventMarkerPress = useCallback((event: FirebaseEvent) => {
    if (
      event.coordinates?.longitude === undefined ||
      event.coordinates?.latitude === undefined
    ) {
      return;
    }

    setSelectedStop(null);
    setSelectedEvent(event);
    cameraRef.current?.setCamera({
      centerCoordinate: [
        Number(event.coordinates.longitude || 0),
        Number(event.coordinates.latitude || 0),
      ],
      zoomLevel: 15.8,
      pitch: 0,
      heading: 0,
      animationDuration: 900,
      animationMode: 'flyTo',
    });
  }, []);

  const handleDeleteStop = useCallback((stopId: string) => {
    setExtraPlaceIds((prev) => prev.filter((id) => id !== stopId));
    setRemovedPlaceIds((prev) => (prev.includes(stopId) ? prev : [...prev, stopId]));
    setIsEdited(true);
    setTourStops((prev) => prev.filter((s) => s.id !== stopId));
    setRouteDetails((prev) =>
      prev
        ? {
            ...prev,
            places: prev.places.filter((place) => place.id !== stopId),
          }
        : prev
    );
    setSelectedStop(null);
  }, []);

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
      const nextCurrentStopIndex = activePlaceStops.findIndex(
        (place) => !nextProgress[place.id]?.visited
      );
      const remainingStops = activePlaceStops.filter(
        (place) => !nextProgress[place.id]?.visited
      );
      const computedStatus = remainingStops.length === 0 ? 'completed' : 'active';
      const status = forcedStatus ?? computedStatus;
      const savedId = await saveUserTour({
        tourId,
        userId: user.id,
        userName: user.name || '',
        userEmail: user.email || '',
        route: routeDetails.route,
        title: route.params?.tourName || routeDetails.route.name,
        places: activePlaceStops,
        events: routeDetails.events,
        placeProgress: nextProgress,
        currentStopIndex:
          nextCurrentStopIndex < 0 ? activePlaceStops.length : nextCurrentStopIndex,
        isEdited,
        status,
        startedAt: nextStartedAt || new Date().toISOString(),
        completedAt: status === 'completed' ? new Date().toISOString() : null,
      });
      setTourId(savedId);
      return savedId;
    },
    [isEdited, route.params?.tourName, routeDetails, tourId, tourStops, user?.email, user?.id, user?.name]
  );

  // Intercept back navigation when tour is active — offer pause & leave
  useEffect(() => {
    if (!tourStarted) return;

    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      e.preventDefault();
      Alert.alert(
        'Leave Tour?',
        'Your tour will be paused. You can resume from where you left off.',
        [
          { text: 'Stay on Tour', style: 'cancel' },
          {
            text: 'Pause & Leave',
            style: 'destructive',
            onPress: async () => {
              setTourStarted(false);
              setIsPausedTour(true);
              setSelectedStop(null);
              setSelectedEvent(null);
              await persistTourIfNeeded(placeProgress, startedAt, 'paused').catch(() => {});
              navigation.dispatch(e.data.action);
            },
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, tourStarted, persistTourIfNeeded, placeProgress, startedAt]);

  const handleStopFavorite = async (place: FirebasePlace) => {
    if (isFavorite(place.id)) {
      await removeFromFavorites(place.id);
      showInfo('Removed', 'Removed from favorites');
      return;
    }

    await addToFavorites({
      id: place.id,
      title: place.name,
      description: place.description || place.address || 'Location',
      rating: String(place.rating || 0),
      image: place.imageUrl || '',
      category: 'Food',
      routeName: 'RecommendationDetials',
      routeParams: { item: place },
      city_name: place.city_name,
      country: place.country,
    });
    showSuccess('Added', 'Added to favorites');
  };

  const handleCurrentLocation = useCallback((shouldFocus = true) => {
    const request = (granted: boolean) => {
      if (!granted) return;
      Geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [
            pos.coords.longitude,
            pos.coords.latitude,
          ];
          setTourOrigin((prev) => prev || coords);
          setCurrentLocation(coords);
          if (shouldFocus) {
            cameraRef.current?.setCamera({
              centerCoordinate: coords,
              zoomLevel: 14,
              animationDuration: 800,
              animationMode: 'easeTo',
            });
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 },
      );
    };

    if (Platform.OS === 'android') {
      PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ).then((result) => request(result === PermissionsAndroid.RESULTS.GRANTED));
    } else {
      request(true);
    }
  }, []);

  const handleStartTour = async () => {
    if (!routeDetails) {
      return;
    }

    const nextStartedAt = startedAt || new Date().toISOString();
    setStartedAt(nextStartedAt);
    setTourStarted(true);
    setIsCompletedTour(false);
    setIsPausedTour(false);

    try {
      // Always persist — creates users_routes entry even on first start
      await persistTourIfNeeded(placeProgress, nextStartedAt, 'active', true);
      showSuccess(
        canResumeTour ? 'Tour Resumed' : 'Tour Started',
        canResumeTour
          ? 'You can continue your journey from where you paused.'
          : isEdited
            ? 'Your edited tour has been saved.'
            : 'Your route is ready to explore.'
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to start tour.';
      showError('Start Tour Failed', message);
    }
  };

  const handlePauseTour = async () => {
    if (isCompletedTour) {
      return;
    }
    setTourStarted(false);
    setIsPausedTour(true);
    setSelectedStop(null);
    setSelectedEvent(null);
    setTourActionVisible(false);
    await persistTourIfNeeded(placeProgress, startedAt, 'paused').catch(() => {});
    showInfo('Tour Paused', 'You can resume this tour anytime.');
  };

  const handleCloseTour = async () => {
    if (isCompletedTour) {
      return;
    }
    if (tourId) {
      await deleteUserTour(tourId);
    }

    setTourId(null);
    setStartedAt(null);
    setPlaceProgress({});
    setSelectedStop(null);
    setSelectedEvent(null);
    setTourActionVisible(false);
    showInfo('Tour Closed', 'This tour has been closed and will not resume again.');
    navigation.goBack();
  };

  const handleTourAction = () => {
    if (isCompletedTour) {
      return;
    }
    setTourActionVisible(true);
  };

  const handleVisitVerification = async (imageUri: string) => {
    if (!selectedStop?.place) {
      return false;
    }

    try {
      const coords = ALLOW_ANY_IMAGE_FOR_TESTING
        ? currentLocation || selectedStop.coordinate
        : await getCurrentPositionAsync();

      const nearestStopFromCurrentLocation = orderStopsByNearest(
        placeStops.filter((stop) => !placeProgress[stop.id]?.visited),
        coords
      )[0];

      if (
        nearestStopFromCurrentLocation &&
        nearestStopFromCurrentLocation.id !== selectedStop.id
      ) {
        showInfo(
          'Nearest Stop Required',
          `You can only confirm the nearest location first: ${nearestStopFromCurrentLocation.title}.`
        );
        return false;
      }

      if (!ALLOW_ANY_IMAGE_FOR_TESTING) {
        const distance = distanceInMeters(coords, selectedStop.coordinate);

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
      try {
        await persistTourIfNeeded(nextProgress, nextStartedAt);
      } catch (error) {
        if (!ALLOW_ANY_IMAGE_FOR_TESTING) {
          throw error;
        }
      }
      const allDone = placeStops.filter((stop) => !nextProgress[stop.id]?.visited).length === 0;
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
        const nextUnvisited = orderStopsByNearest(
          placeStops.filter((stop) => !nextProgress[stop.id]?.visited),
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
                  updateSelectedStopPosition(selectedStop).catch(() => {});
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

              {routeLine.features.length > 0 && (
                <Mapbox.ShapeSource id="tourRouteLine" shape={routeLine}>
                  <Mapbox.LineLayer id="tourRouteLineLayer" style={routeLineLayerStyle} />
                </Mapbox.ShapeSource>
              )}

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

              {eventStops.map((stop) => (
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
                    onPress={() => stop.event && handleEventMarkerPress(stop.event)}
                    style={styles.markerTapArea}
                  >
                    <View style={styles.eventMarker}>
                      <View style={styles.eventMarkerInner} />
                    </View>
                  </TouchableOpacity>
                </Mapbox.MarkerView>
              ))}

              {currentLocation && currentMarkerNeedsStandalonePin ? (
                <Mapbox.MarkerView
                  id="currentUserLocationMarker"
                  coordinate={[...currentLocation]}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <GrayMapIcon width={35} height={46} />
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

        <View style={styles.distancePill}>
          <Text style={styles.distancePillText}>
            {routeDistanceKm > 0 ? `${routeDistanceKm.toFixed(1)} km route` : 'Route loading'}
          </Text>
        </View>

        <TouchableOpacity activeOpacity={0.85} style={styles.currentLocationBtn} onPress={handleCurrentLocation}>
          <View style={styles.currentLocationOuter}>
            <View style={styles.currentLocationInner} />
          </View>
        </TouchableOpacity>

        {selectedStop && (
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={[
              styles.detailCard,
              styles.detailCardPosition,
              { left: cardPosition.x, top: cardPosition.y },
            ]}
          >
            <Image
              source={{ uri: selectedStop.place?.imageUrl || currentRoute.image }}
              style={styles.cardImage}
            />

            <View style={styles.topRow}>
              <View style={styles.pill}>
                <ForkIcon width={8} height={8} />
                <Text style={styles.pillText}>Location</Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  selectedStop.place && handleStopFavorite(selectedStop.place)
                }
              >
                {selectedStop.place && isFavorite(selectedStop.place.id) ? (
                  <RedHeartIcon width={13} height={11} />
                ) : (
                  <HeartIcon width={13} height={11} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.textBlock}>
              <Text style={styles.cardTitle}>{selectedStop.title}</Text>
              <Text style={styles.cardSubtitle}>
                {selectedStop.place?.description || selectedStop.place?.address || 'Favorite place'}
              </Text>
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

                <TouchableOpacity onPress={() => handleDeleteStop(selectedStop.id)}>
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
            <TouchableOpacity style={styles.favoriteBtn} onPress={handleTourAction}>
              <Text style={[styles.btnText, { color: COLORS.TEXT_PRIMARY }]}>
                Action
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.startTourBtn, tourStarted && styles.startTourBtnStarted]}
              onPress={handleStartTour}
              disabled={tourStarted}
            >
              <Text style={[styles.btnText, { color: COLORS.WHITE }]}>
                {tourStarted ? 'Tour Started' : canResumeTour ? 'Resume Tour' : 'Start a Tour'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <ScanVerifyModal
          visible={scanVisible}
          title={selectedStop?.title || 'this location'}
          successPoints={Number(selectedStop?.place?.points || 10)}
          onClose={() => {
            setScanVisible(false);
            setSelectedStop(null);
          }}
          onScanSuccess={handleVisitVerification}
        />

        <EventDetailModal
          visible={Boolean(selectedEvent)}
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />

        {tourActionVisible ? (
          <View style={styles.actionOverlay}>
            <TouchableOpacity
              activeOpacity={1}
              style={styles.actionBackdrop}
              onPress={() => setTourActionVisible(false)}
            />
            <View style={styles.actionSheet}>
              <Text style={styles.actionTitle}>Tour Actions</Text>
             
              <TouchableOpacity
                style={styles.actionPrimaryBtn}
                onPress={handlePauseTour}
              >
                <Text style={styles.actionPrimaryText}>Pause Tour</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionDangerBtn}
                onPress={() => {
                  handleCloseTour().catch(() => {
                    showError('Tour Close Failed', 'Unable to end this tour right now.');
                  });
                }}
              >
                <Text style={styles.actionDangerText}>End Tour</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionCancelBtn}
                onPress={() => setTourActionVisible(false)}
              >
                <Text style={styles.actionCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

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
                    navigation.navigate('MyTour' as never);
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.BUTTON_COLOR,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 6,
  },
  eventMarkerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.7)',
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
    width: 260,
    backgroundColor: COLORS.WHITE,
    borderWidth: 3,
    borderColor: COLORS.BUTTON_COLOR,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 10,
    zIndex: 100,
  },
  detailCardPosition: {
    position: 'absolute',
    zIndex: 100,
  },
  cardImage: {
    width: '100%',
    height: 108,
    borderRadius: 6,
  },
  topRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pillText: {
    fontSize: 10,
    fontFamily: FONT_FAMILY.InterTight_Regular,
    color: COLORS.TEXT_SECONDARY,
  },
  textBlock: {
    marginTop: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: FONT_FAMILY.Poppins_SemiBold,
    color: COLORS.TEXT_PRIMARY,
  },
  cardSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
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
});
