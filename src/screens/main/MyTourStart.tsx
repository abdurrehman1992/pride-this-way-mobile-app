import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  Animated,
  AppState,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ImageBackground,
  Platform,
  InteractionManager,
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
import { useRoute, useNavigation, usePreventRemove } from '@react-navigation/native';
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
  removeTourPlaceFromUserAndRecord,
} from '../../services/myTourService';
import { scheduleStopsWithEventTiming } from '../../utils/tourRouteScheduling';
import {
  distanceMetersBetween,
  projectPointOnPolyline,
  splitPolylineAt,
  type Coord,
} from '../../utils/routeProgress';
import { checkInternetConnection, useInternetConnectivity } from '../../utils/networkStatus';
import { requestLocationPermission } from '../../utils/location';
import {
  getNativeTourLocationStatus,
  startNativeTourLocation,
  stopNativeTourLocation,
  subscribeToNativeTourLocation,
} from '../../utils/nativeTourLocation';
import { showLocationRequiredAlert } from '../../utils/locationRequiredAlert';
import { showInternetRequiredAlert } from '../../utils/internetRequiredAlert';
import { verifyPlaceImageMatch } from '../../services/aiService';
import { initializeMapbox } from '../../services/mapboxConfig';
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
  eventStatus?: 'active' | 'expired' | 'completed';
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

const futureRouteLineLayerStyle: LineLayerStyle = {
  ...routeLineLayerStyle,
  lineColor: '#F3A0A0',
  lineOpacity: 0.8,
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

// Keep the visit radius in one place so it can be tuned later.
const VISIT_DISTANCE_THRESHOLD_METERS = 100;
// The visual progress is updated locally for every GPS fix. A network
// reroute is only needed when the user has genuinely left the current road
// geometry; using the reported accuracy avoids reroute storms from noisy GPS.
const MIN_OFF_ROUTE_REROUTE_DISTANCE_METERS = 12;
const MAX_OFF_ROUTE_REROUTE_DISTANCE_METERS = 45;
const INTRACITY_ROUTE_DISTANCE_METERS = 50_000;
const FLIGHT_ROUTE_DISTANCE_METERS = 150_000;

// Route data arrives asynchronously from Directions and, while a request is
// being replaced, an individual leg can briefly be absent. Keep every map
// render path defensive: an incomplete leg should mean "draw nothing yet",
// never a React render crash.
const isRenderableRouteSegment = (segment: unknown): segment is Coord[] =>
  Array.isArray(segment) &&
  segment.length >= 2 &&
  segment.every(
    (coordinate) =>
      Array.isArray(coordinate) &&
      coordinate.length >= 2 &&
      Number.isFinite(coordinate[0]) &&
      Number.isFinite(coordinate[1])
  );
const LIVE_ROUTE_REFRESH_MIN_INTERVAL_MS = 2_500;
const ROUTE_RETRY_DELAY_MS = 1_500;
const MAX_ACCEPTED_GPS_ACCURACY_METERS = 100;
// A stop is complete only when both the visual proof and the live GPS check pass.
const ALLOW_ANY_IMAGE_FOR_TESTING = false;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DETAIL_CARD_WIDTH = 260;
const DETAIL_CARD_HEIGHT = 255;
const MAX_INITIAL_FIX_AGE_MS = 15_000;

const isFreshGpsPosition = (position: any) => {
  const timestamp = Number(position?.timestamp);
  return !Number.isFinite(timestamp) || timestamp <= 0 || Date.now() - timestamp <= MAX_INITIAL_FIX_AGE_MS;
};

const getCurrentPositionAsync = async (timeout = 5000) =>
  new Promise<[number, number]>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos) => {
        if (!isFreshGpsPosition(pos)) {
          reject(new Error('Stale GPS position'));
          return;
        }
        resolve([pos.coords.longitude, pos.coords.latitude]);
      },
      reject,
      { enableHighAccuracy: true, timeout, maximumAge: 0 }
    );
  });

type VerificationFailure = { verified: false; reason: string };

const getVerificationFailureMessage = (
  placeName: string,
  imageMatched: boolean,
  locationMatched: boolean,
  hasGpsFix: boolean,
): string => {
  if (!hasGpsFix) {
    return `We could not confirm your current location. Turn on precise location, move near ${placeName}, and take a clear photo of the place.`;
  }
  if (!imageMatched && !locationMatched) {
    return `Please be physically near ${placeName} and take a clear photo that shows its entrance, signboard, or another identifiable feature.`;
  }
  if (!imageMatched) {
    return `You are near ${placeName}, but the photo does not clearly match it. Take another clear photo of the actual place—avoid map screenshots, generic roads, or unrelated images.`;
  }
  return `Your photo matches ${placeName}, but you need to be physically near the location to confirm this stop.`;
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
  status: 'active' | 'expired' | 'completed'
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
  const [scanTargetEvent, setScanTargetEvent] = useState<FirebaseEvent | null>(null);
  // iOS cannot present a new modal while another is still animating out, so we
  // hide the event modal first and open the scan modal after a short delay.
  const [eventDetailDismissing, setEventDetailDismissing] = useState(false);
  const pendingEventScanRef = useRef(false);
  const eventScanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (eventScanTimerRef.current) {
      clearTimeout(eventScanTimerRef.current);
      eventScanTimerRef.current = null;
    }
  }, []);

  const [tourStarted, setTourStarted] = useState(Boolean(route.params?.autoStart));
  // MAPBOX_TOKEN is loaded synchronously from react-native-config. Mount the
  // native MapView immediately on first launch; waiting for the native token
  // promise here can leave a brand-new install stuck on the blue fallback.
  // Do not mount the native MapView until setAccessToken has completed. On a
  // fresh Android install mounting it during token initialization can leave
  // the surface stuck on the blue background until the screen is restarted.
  const [mapReady, setMapReady] = useState(false);
  const [nativeMapReady, setNativeMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roadSegments, setRoadSegments] = useState<[number, number][][]>([]);
  const [airSegments, setAirSegments] = useState<[number, number][][]>([]);
  const [renderedRouteStopsKey, setRenderedRouteStopsKey] = useState('');
  const [routeGeometryVersion, setRouteGeometryVersion] = useState(0);
  const [routeRetryNonce, setRouteRetryNonce] = useState(0);
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
  const initialLocationUnavailable =
    route.params?.initialLocationUnavailable === true;
  const [locationUnavailable, setLocationUnavailable] = useState(
    initialLocationUnavailable
  );
  const [locationStatusChecked, setLocationStatusChecked] = useState(
    !tourStarted ||
      route.params?.initialLocationStatusChecked === true ||
      initialLocationUnavailable
  );
  const currentLocationRef = useRef<[number, number] | null>(null);
  const currentLocationAccuracyRef = useRef<number>(MAX_ACCEPTED_GPS_ACCURACY_METERS);
  const nativeLocationDisabledRef = useRef(initialLocationUnavailable);
  // If an already-active tour is restored after the process was closed with
  // GPS off, keep it suspended on this screen (rather than converting it to a
  // manually paused tour). Turning GPS back on can then continue it in place.
  const locationBlockedOnEntryRef = useRef(initialLocationUnavailable);
  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  // Android keeps an active tour alive in a native foreground service so the
  // JS watcher is not the only source of GPS updates while the screen is
  // locked. The service also persists its latest fix; restore it immediately
  // when the app returns from the background.
  useEffect(() => {
    let cancelled = false;
    const subscription = subscribeToNativeTourLocation((status) => {
      if (cancelled || !tourStarted) return;
      setLocationStatusChecked(true);
      if (status.type === 'unavailable' || status.locationEnabled === false) {
        nativeLocationDisabledRef.current = true;
        setLocationUnavailable(true);
        return;
      }

      const latitude = Number(status.latitude);
      const longitude = Number(status.longitude);
      const accuracy = Number(status.accuracy);
      if (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        (!Number.isFinite(accuracy) || accuracy <= MAX_ACCEPTED_GPS_ACCURACY_METERS)
      ) {
        if (Number.isFinite(accuracy) && accuracy > 0) {
          currentLocationAccuracyRef.current = accuracy;
        }
        nativeLocationDisabledRef.current = false;
        locationBlockedOnEntryRef.current = false;
        setLocationUnavailable(false);
        const next: [number, number] = [longitude, latitude];
        setCurrentLocation(next);
        currentLocationRef.current = next;
      }
    });

    const start = async () => {
      if (!tourStarted) {
        setLocationStatusChecked(true);
        await stopNativeTourLocation();
        return;
      }

      // Check Android's master location switch before requesting a GPS fix or
      // starting the service. This makes an app reopened with GPS off show the
      // actionable modal immediately instead of sitting on “Getting location”.
      const initialStatus = await getNativeTourLocationStatus();
      if (cancelled) return;
      if (initialStatus) {
        setLocationStatusChecked(true);
      }
      if (initialStatus?.locationEnabled === false) {
        nativeLocationDisabledRef.current = true;
        if (!currentLocationRef.current) {
          locationBlockedOnEntryRef.current = true;
        }
        setLocationUnavailable(true);
        return;
      }

      if (!(await requestLocationPermission(true)) || cancelled) {
        if (!cancelled) {
          setLocationStatusChecked(true);
          if (!currentLocationRef.current) {
            locationBlockedOnEntryRef.current = true;
          }
          setLocationUnavailable(true);
        }
        return;
      }
      setLocationStatusChecked(true);

      await startNativeTourLocation(tourIdRef.current);
      if (cancelled) return;

      const status = await getNativeTourLocationStatus();
      if (cancelled || !status) return;
      if (status.locationEnabled === false) {
        nativeLocationDisabledRef.current = true;
        if (!currentLocationRef.current) {
          locationBlockedOnEntryRef.current = true;
        }
        setLocationUnavailable(true);
        return;
      }
      nativeLocationDisabledRef.current = false;

      // Never anchor a new/resumed tour to an old service fix left over from
      // a previous process. Live service events will provide the fresh fix.
      const age = Number(status.timestamp) > 0
        ? Date.now() - Number(status.timestamp)
        : Number.POSITIVE_INFINITY;
      const latitude = Number(status.latitude);
      const longitude = Number(status.longitude);
      if (
        age <= MAX_INITIAL_FIX_AGE_MS &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
      ) {
        const accuracy = Number(status.accuracy);
        if (Number.isFinite(accuracy) && accuracy > 0) {
          currentLocationAccuracyRef.current = accuracy;
        }
        const next: [number, number] = [longitude, latitude];
        locationBlockedOnEntryRef.current = false;
        setLocationUnavailable(false);
        setCurrentLocation(next);
        currentLocationRef.current = next;
      }
    };

    start();

    // Some Android vendor ROMs drop local broadcasts when their quick
    // settings panel is open. Poll the native master-location state as a
    // second guard so an active tour is paused even if that event was missed.
    const locationStatePoll = setInterval(async () => {
      if (cancelled || !tourStarted) return;
      const status = await getNativeTourLocationStatus();
      if (!cancelled && status?.locationEnabled === false) {
        setLocationStatusChecked(true);
        nativeLocationDisabledRef.current = true;
        setLocationUnavailable(true);
      } else if (!cancelled && status?.locationEnabled === true) {
        const wasBlockedOnEntry = locationBlockedOnEntryRef.current;
        setLocationStatusChecked(true);
        nativeLocationDisabledRef.current = false;
        if (wasBlockedOnEntry) {
          locationBlockedOnEntryRef.current = false;
          await startNativeTourLocation(tourIdRef.current);
          if (!cancelled) {
            setLocationUnavailable(false);
          }
        }
      }
    }, 1_000);

    return () => {
      cancelled = true;
      clearInterval(locationStatePoll);
      subscription.remove();
      // Do not stop an active native service merely because Android removed
      // the React Activity from Recents. A deliberate pause/completion flips
      // `tourStarted` to false, and the next effect run stops it explicitly.
    };
  }, [tourStarted]);
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
        verifiedByGemini?: boolean;
        verificationConfidence?: number;
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
        verifiedByGemini?: boolean;
        verificationConfidence?: number;
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
  const [isPausingTour, setIsPausingTour] = useState(false);
  const isOnline = useInternetConnectivity();
  const leavingRef = useRef(false);
  const locationPauseAlertRef = useRef(false);
  const offlineAlertRef = useRef(false);
  const locationUnavailableErrorsRef = useRef(0);
  const pausedByLocationRef = useRef(false);
  const locationPausePromiseRef = useRef<Promise<string | null> | null>(null);

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
  const pendingSaveInProgressRef = useRef(false);
  const introPlayedRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const roadSegmentsRef = useRef<[number, number][][]>([]);
  const airSegmentsRef = useRef<[number, number][][]>([]);
  const renderedRouteStopsKeyRef = useRef('');
  const latestRouteStopsKeyRef = useRef<string>('');
  const routeRequestSequenceRef = useRef(0);
  const routeRequestInFlightRef = useRef<{
    id: number;
    stopsKey: string;
    kind: 'full' | 'active';
  } | null>(null);
  const lastRouteRequestAtRef = useRef(0);
  const lastRouteRequestStopsKeyRef = useRef('');
  const routeRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routeScreenMountedRef = useRef(true);

  useEffect(() => {
    roadSegmentsRef.current = roadSegments;
  }, [roadSegments]);

  useEffect(() => {
    airSegmentsRef.current = airSegments;
  }, [airSegments]);

  useEffect(() => {
    routeScreenMountedRef.current = true;
    return () => {
      routeScreenMountedRef.current = false;
      routeRequestSequenceRef.current += 1;
      if (routeRetryTimerRef.current) {
        clearTimeout(routeRetryTimerRef.current);
        routeRetryTimerRef.current = null;
      }
    };
  }, []);

  const fetchRoadSegment = useCallback(
    async (from: [number, number], to: [number, number]): Promise<[number, number][] | null> => {
      const dist = distanceMetersBetween(from, to);
      if (!Config.MAPBOX_TOKEN) {
        return null;
      }

      // Intra-city legs (< 50 km straight-line) avoid motorways — Lahore
      // tour stops shouldn't route via M2/M3 when normal city roads work.
      // Longer legs allow motorways because they're between cities.
      const excludeMotorway = dist < INTRACITY_ROUTE_DISTANCE_METERS;

      // Prefer city roads, but retry without the motorway exclusion if the
      // constrained request has no route. Both attempts remain real by-road
      // Mapbox routes; a straight-line visual fallback is never produced.
      const attempts = excludeMotorway ? [true, false] : [false];
      for (const shouldExcludeMotorway of attempts) {
        try {
          const { data } = await axios.get<DirectionsResponse>(
            `https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}`,
            {
              params: {
                access_token: Config.MAPBOX_TOKEN,
                geometries: 'geojson',
                overview: 'full',
                steps: false,
                ...(shouldExcludeMotorway ? { exclude: 'motorway' } : {}),
              },
              timeout: 6_000,
            }
          );

          const routedCoordinates = data.routes?.[0]?.geometry?.coordinates;
          if (routedCoordinates && routedCoordinates.length >= 2) {
            // Mapbox snaps to the nearest road. Keep exact endpoints so the
            // rendered route meets the live marker and destination pin.
            return [from, ...(routedCoordinates as [number, number][]), to];
          }
        } catch {
          // Try the unconstrained road request below when available. The
          // route owner schedules a quiet retry if every attempt fails.
        }
      }
      return null;
    },
    []
  );

  const fetchRouteSegment = useCallback(
    async (from: Coord, to: Coord): Promise<{ road: Coord[]; air: Coord[] }> => {
      const distance = distanceMetersBetween(from, to);

      // Mapbox driving cannot connect different continents (for example an
      // iOS simulator in the USA to a Lahore tour). Avoid a guaranteed slow
      // failure and show that long transfer as a flight leg immediately.
      // Once the user reaches the destination region, all local legs remain
      // normal road routes and 50km+ road legs may use motorways.
      if (distance >= FLIGHT_ROUTE_DISTANCE_METERS) {
        return { road: [], air: [from, to] };
      }

      const road = await fetchRoadSegment(from, to);
      return road
        ? { road, air: [] }
        : { road: [], air: [] };
    },
    [fetchRoadSegment]
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
          return fetchRouteSegment(from as Coord, to);
        })
      );

      // Preserve one array slot per requested leg. Dropping a failed first
      // leg would incorrectly promote the second (future) leg to the active
      // red route. Empty slots stay hidden and are retried by the owner.
      const road: Coord[][] = results.map(({ road: segment }) =>
        isRenderableRouteSegment(segment) ? segment : []
      );
      const air: Coord[][] = results.map(({ air: segment }) =>
        isRenderableRouteSegment(segment) ? segment : []
      );

      return {
        // A straight line is used only for an explicit long-distance flight
        // leg, never as a fallback for a failed local road request.
        road,
        air,
      };
    },
    [fetchRouteSegment]
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

    initializeMapbox()
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
            .filter((id): id is string => Boolean(id));
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
                    verifiedByGemini?: boolean;
                    verificationConfidence?: number;
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
                  verifiedByGemini: item.verifiedByGemini,
                  verificationConfidence: item.verificationConfidence,
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
                  verifiedByGemini?: boolean;
                  verificationConfidence?: number;
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
        }

        setPlaceProgress(nextProgress);

        // Restore persisted per-event progress (attended/dismissed) if present
        // Extract from all_places entries that have event_progress field or from saved doc
        let nextEventProgress: Record<string, {
          attended?: boolean;
          dismissed?: boolean;
          visitedAt?: string | null;
          proofImageUri?: string | null;
          verifiedByGemini?: boolean;
          verificationConfidence?: number;
        }> = {};

        // Build event progress from all_places order field entries
        (savedTour?.all_places || [])
          .filter((item: any) => item.event_id)
          .forEach((item: any) => {
            nextEventProgress[item.event_id] = {
              attended: item.visited || false,
              visitedAt: item.visitedAt || null,
              proofImageUri: item.proofImageUri || null,
              verifiedByGemini: Boolean(item.verifiedByGemini),
              verificationConfidence: Number(item.verificationConfidence || 0),
            };
          });

        setEventProgress(nextEventProgress);
        setRouteDetails(nextDetails);

        // Extract route order from all_places using the order field
        const savedRouteOrder: string[] = [];
        (savedTour?.all_places || [])
          .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
          .forEach((item: any) => {
            if (item.place_id) {
              savedRouteOrder.push(item.place_id);
            } else if (item.event_id) {
              savedRouteOrder.push(item.event_id);
            }
          });

        if (savedRouteOrder.length > 0) {
          setSavedTourOrder(savedRouteOrder);
        }


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
        if (savedTour && savedRouteOrder.length === 0) {
          // If the saved tour document did not include an explicit order,
          // fall back to the loaded place order only. Otherwise preserve
          // the authoritative all_places order including event stops.
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
        navigation.setParams({ addedPlaceId: undefined, timestamp: undefined } as any);
        return;
      }

      setTourStops((prev) => {
        if (prev.some((s) => s.id === addedPlace.id)) return prev;
        return [
          ...prev,
          { id: addedPlace.id, title: addedPlace.name, coordinate: [lng, lat] as [number, number], place: addedPlace },
        ];
      });

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
      setOptimizedOrder(null);
      pendingEditSaveRef.current = true;
      navigation.setParams({ addedPlaceId: undefined, timestamp: undefined } as any);
    });
  }, [navigation, route.params?.addedPlaceId]);

  const placeStops = useMemo(() => tourStops, [tourStops]);

  const hasVisitedProgress = useMemo(
    () => Object.values(placeProgress).some((item) => item.visited),
    [placeProgress]
  );

  const isStopComplete = useCallback(
    (stop: TourStop) => {
      if (stop.kind === 'event' || stop.event) {
        const progress = eventProgress[stop.id];
        return Boolean((progress?.attended && progress?.verifiedByGemini) || progress?.expired);
      }
      const progress = placeProgress[stop.id];
      // Older tours did not persist verifiedByGemini. A persisted `visited`
      // flag is still authoritative for those tours; newly completed stops
      // continue to write verifiedByGemini=true.
      return Boolean(progress?.visited && progress?.verifiedByGemini !== false);
    },
    [eventProgress, placeProgress]
  );

  const { activeTodayEventStops, expiredTodayEventStops, completedTodayEventStops } = useMemo(() => {
    const today = new Date();
    const active: TourStop[] = [];
    const expired: TourStop[] = [];
    const completed: TourStop[] = [];

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

        // Attended events go into completed array (still visible but styled differently)
        if (progress?.attended) {
          completed.push(eventToTourStop(event, 'completed'));
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
      completedTodayEventStops: completed.sort(byTime),
    };
  }, [eventProgress, routeDetails?.events]);

  /** Places only — Mapbox optimizes driving order without pulling events forward. */
  const routePlaceStops = useMemo(() => placeStops, [placeStops]);
  const shouldOptimizeFromLiveLocation = tourStarted || isPausedTour;
  const optimizationPlaceStops = useMemo(
    () =>
      shouldOptimizeFromLiveLocation
        ? routePlaceStops.filter((stop) => !isStopComplete(stop))
        : routePlaceStops,
    [isStopComplete, routePlaceStops, shouldOptimizeFromLiveLocation]
  );

  useEffect(() => {
    if (!routeDetails || !user?.id) return;
    if (!tourStarted) return;
    if (savedTourOrder) return;
    if (pendingEditSaveRef.current) return;
    if (routePlaceStops.length === 0) return;

    pendingEditSaveRef.current = true;
  }, [routeDetails, routePlaceStops.length, savedTourOrder, tourStarted, user?.id]);

  const allTodayEventStops = useMemo(() =>
    [...activeTodayEventStops, ...expiredTodayEventStops, ...completedTodayEventStops].sort(
      (a, b) => (a.sortTime || 0) - (b.sortTime || 0)
    ),
    [activeTodayEventStops, completedTodayEventStops, expiredTodayEventStops]
  );

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
    const eventStops = [...activeTodayEventStops, ...expiredTodayEventStops, ...completedTodayEventStops];
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
    completedTodayEventStops,
    eventProgress,
    expiredTodayEventStops,
    isStopComplete,
    placeProgress,
    tourStops,
  ]);

  // Current GPS is authoritative for choosing the next unvisited stop.
  const orderingAnchor = useMemo<[number, number] | null>(
    () => currentLocation ?? tourOrigin,
    [currentLocation, tourOrigin]
  );

  // Re-evaluate from live GPS for an active/resumable tour. The API key below
  // rounds GPS to ~100m, so normal location noise cannot reshuffle stops every
  // second, while a meaningful move or completing a stop does optimize again.
  const optimizationAnchor = useMemo<[number, number] | null>(() => {
    if (tourStarted || isPausedTour) {
      return (
        currentLocation ||
        (visitedStopsInVisitOrder.length > 0
          ? visitedStopsInVisitOrder[visitedStopsInVisitOrder.length - 1]?.coordinate
          : null) ||
        tourOrigin ||
        null
      );
    }

    return currentLocation ?? tourOrigin;
  }, [currentLocation, tourOrigin, tourStarted, isPausedTour, visitedStopsInVisitOrder]);

  const currentOptimizationKey = useMemo(() => {
    if (!optimizationAnchor || optimizationPlaceStops.length === 0) return '';
    const ids = optimizationPlaceStops.map((stop) => stop.id).join(',');
    return `${optimizationAnchor[0].toFixed(3)},${optimizationAnchor[1].toFixed(3)}|${ids}`;
  }, [optimizationAnchor, optimizationPlaceStops]);

  // Cached "true" road-distance order from Mapbox Optimization API.
  // Keyed by stop ids in current set so we don't refetch needlessly.
  const [optimizedOrder, setOptimizedOrder] = useState<{
    key: string;
    ids: string[];
  } | null>(null);

  useEffect(() => {
    // A saved non-active tour keeps its stored order. Active/paused tours use
    // the stable tour-origin/last-stop anchor calculated above.
    if (savedTourOrder && !tourStarted && !isPausedTour) {
      return;
    }
    if (!optimizationAnchor || optimizationPlaceStops.length < 2) {
      return;
    }
    if (!Config.MAPBOX_TOKEN) {
      return;
    }

    const key = currentOptimizationKey;
    if (optimizedOrder?.key === key) {
      return;
    }

    // Driving optimization has no valid result when the device and every
    // stop are in disconnected regions/continents. The local nearest-order
    // fallback below is immediate; route rendering handles the first transfer
    // as a flight leg.
    const nearestDistance = Math.min(
      ...optimizationPlaceStops.map((stop) =>
        distanceMetersBetween(optimizationAnchor, stop.coordinate)
      )
    );
    if (nearestDistance >= FLIGHT_ROUTE_DISTANCE_METERS) {
      return;
    }

    const coords = [optimizationAnchor, ...optimizationPlaceStops.map((s) => s.coordinate)]
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
          .map((entry) => optimizationPlaceStops[entry.originalIndex - 1].id);
        setOptimizedOrder({ key, ids: orderedIds });
      })
      .catch(() => {
        // Fall back silently to straight-line ordering on API failure.
      });

    return () => {
      cancelled = true;
    };
  }, [
    currentOptimizationKey,
    optimizationAnchor,
    optimizationPlaceStops,
    optimizedOrder?.key,
    savedTourOrder,
    tourStarted,
    isPausedTour,
  ]);

  const mapOptimizedPlaceStops = useMemo(() => {
    // Saved order is useful before a tour starts. During navigation, current
    // GPS and only the unvisited stop set decide the next destination.
    if (!shouldOptimizeFromLiveLocation && savedTourOrder && savedTourOrder.length > 0) {
      const byId = new Map(optimizationPlaceStops.map((s) => [s.id, s]));
      const ordered = savedTourOrder
        .map((id) => byId.get(id))
        .filter((s): s is TourStop => Boolean(s));
      const missing = optimizationPlaceStops.filter((s) => !savedTourOrder.includes(s.id));
      return [...ordered, ...missing];
    }

    if (!optimizedOrder && !optimizationAnchor) {
      return optimizationPlaceStops;
    }

    let ordered: TourStop[];

    if (optimizedOrder?.key === currentOptimizationKey) {
      const byId = new Map(optimizationPlaceStops.map((s) => [s.id, s]));
      ordered = optimizedOrder.ids
        .map((id) => byId.get(id))
        .filter((s): s is TourStop => Boolean(s));
      const missing = optimizationPlaceStops.filter((s) => !optimizedOrder.ids.includes(s.id));
      if (missing.length > 0) {
        ordered = [...ordered, ...orderStopsByNearest(missing, optimizationAnchor)];
      }
    } else {
      ordered = orderStopsByNearest(optimizationPlaceStops, optimizationAnchor);
    }

    return ordered;
  }, [
    currentOptimizationKey,
    optimizationAnchor,
    optimizationPlaceStops,
    optimizedOrder,
    savedTourOrder,
    shouldOptimizeFromLiveLocation,
  ]);

  const orderedNavigableStops = useMemo(() => {
    if (!tourStarted && !isPausedTour) {
      return mapOptimizedPlaceStops;
    }

    // With no timed events, the optimized/persisted order is authoritative.
    // The user's live coordinate changes the road to that next stop, but must
    // not randomly activate a different destination while they are moving.
    if (allTodayEventStops.length === 0) {
      return mapOptimizedPlaceStops.filter((stop) => !isStopComplete(stop));
    }

    const anchor =
      visitedStopsInVisitOrder[visitedStopsInVisitOrder.length - 1]?.coordinate ||
      tourOrigin ||
      currentLocation ||
      optimizationAnchor;

    // Timed events still need scheduling, but use a stable leg anchor rather
    // than every raw GPS point.
    return scheduleStopsWithEventTiming(
      [...mapOptimizedPlaceStops, ...allTodayEventStops],
      isStopComplete,
      anchor,
      Date.now()
    );
  }, [
    allTodayEventStops,
    currentLocation,
    isPausedTour,
    isStopComplete,
    mapOptimizedPlaceStops,
    optimizationAnchor,
    tourOrigin,
    tourStarted,
    visitedStopsInVisitOrder,
  ]);


  const orderedPlaceStops = orderedNavigableStops;

  const allRouteStops = useMemo(() => orderedNavigableStops, [orderedNavigableStops]);

  const persistedEventStops = useMemo(() => {
    if (!routeDetails?.events?.length) {
      return [] as TourStop[];
    }

    return routeDetails.events.map((event) => {
      const progress = eventProgress[event.id];
      const status = progress?.attended
        ? 'completed'
        : progress?.expired
          ? 'expired'
          : 'active';
      return eventToTourStop(event, status);
    });
  }, [eventProgress, routeDetails?.events]);

  const persistableTourStops = useMemo(() => {
    const stopById = new Map<string, TourStop>();
    const ordered: TourStop[] = [];

    orderedNavigableStops.forEach((stop) => {
      if (!stopById.has(stop.id)) {
        stopById.set(stop.id, stop);
        ordered.push(stop);
      }
    });

    const allStops = [...tourStops, ...persistedEventStops];
    allStops.forEach((stop) => {
      if (!stopById.has(stop.id)) {
        stopById.set(stop.id, stop);
        ordered.push(stop);
      }
    });

    if (savedTourOrder && savedTourOrder.length > 0) {
      const orderedBySaved = savedTourOrder
        .map((id) => stopById.get(id))
        .filter((stop): stop is TourStop => Boolean(stop));
      const remaining = ordered.filter((stop) => !savedTourOrder.includes(stop.id));
      return [...orderedBySaved, ...remaining];
    }

    return ordered;
  }, [orderedNavigableStops, persistedEventStops, savedTourOrder, tourStops]);

  // For DB persistence: include both visited (completed) and unvisited (remaining) stops
  // in a coherent order: visited stops first (in visit order), then remaining stops (optimized).
  // IMPORTANT: Include all places from tourStops to ensure no completed places are lost.
  const allStopsForPersistence = useMemo(() => {
    const visitedStops = visitedStopsInVisitOrder;
    const remainingStops = orderedNavigableStops;

    // Combine: visited stops (in order), then remaining stops (optimized order), then any missing places from tourStops
    const byId = new Map<string, TourStop>();
    const result: TourStop[] = [];

    // Add visited stops first (in their visit order)
    visitedStops.forEach((stop) => {
      if (!byId.has(stop.id)) {
        byId.set(stop.id, stop);
        result.push(stop);
      }
    });

    // Add remaining stops (optimized order)
    remainingStops.forEach((stop) => {
      if (!byId.has(stop.id)) {
        byId.set(stop.id, stop);
        result.push(stop);
      }
    });

    // Add any places from tourStops that weren't included above to prevent data loss
    tourStops.forEach((stop) => {
      if (!byId.has(stop.id)) {
        byId.set(stop.id, stop);
        result.push(stop);
      }
    });

    // Add any events from routeDetails that aren't already included
    (routeDetails?.events || []).forEach((event) => {
      const eventStop: TourStop = {
        id: event.id,
        title: event.title,
        coordinate: [
          Number(event.coordinates?.longitude || 0),
          Number(event.coordinates?.latitude || 0),
        ] as [number, number],
        event,
        kind: 'event',
      };
      if (!byId.has(eventStop.id)) {
        byId.set(eventStop.id, eventStop);
        result.push(eventStop);
      }
    });

    return result;
  }, [orderedNavigableStops, routeDetails?.events, tourStops, visitedStopsInVisitOrder]);

  const orderedPlacesForSave = useMemo(
    () =>
      persistableTourStops
        .filter((stop) => Boolean(stop.place))
        .map((stop) => stop.place!),
    [persistableTourStops]
  );

  useEffect(() => {
    if (!pendingEditSaveRef.current) return;
    if (!routeDetails || !user?.id) return;
    if (!optimizedOrder && !savedTourOrder && routePlaceStops.length > 1) return;
    if (pendingSaveInProgressRef.current) return;

    pendingSaveInProgressRef.current = true;
    const routeOrderKey = allStopsForPersistence.map((stop) => stop.id).join(',');
    const nextSavedRouteOrder = allStopsForPersistence.map((stop) => stop.id);
    setSavedTourOrder(nextSavedRouteOrder);
    (async () => {
      try {
        const activePlaceStops = tourStops.map((stop) => stop.place!).filter(Boolean);
        const placesToSave =
          orderedPlacesForSave.length > 0 ? orderedPlacesForSave : activePlaceStops;
        if (placesToSave.length === 0) return;

        const nextCurrentStopIndex = placesToSave.findIndex(
          (place) => !(placeProgress[place.id]?.visited && placeProgress[place.id]?.verifiedByGemini)
        );
        const remainingStops = placesToSave.filter(
          (place) => !(placeProgress[place.id]?.visited && placeProgress[place.id]?.verifiedByGemini)
        );
        const computedStatus = isCompletedTour
          ? 'completed'
          : tourStarted
            ? 'active'
            : isPausedTour
              ? 'paused'
              : 'saved';

        const debugNavigableRoute = allStopsForPersistence.map((stop, i) => ({
          order: i + 1,
          kind: stop.place ? 'place' : 'event',
          stop_id: stop.place ? stop.place.id : stop.event ? stop.event.id : '',
        }));
        console.log('[DEBUG] saveUserTour payload routeOrderKey:', routeOrderKey, 'navigableRoute:', debugNavigableRoute, 'persistableIds:', allStopsForPersistence.map(s => s.id));

        const savedId = await saveUserTour({
          tourId: tourIdRef.current,
          userId: user.id,
          userName: user.name || '',
          userEmail: user.email || '',
          route: routeDetails.route,
          title: route.params?.tourName || routeDetails.route.name,
          places: placesToSave,
          events: routeDetails.events,
          placeProgress,
          eventProgress,
          currentStopIndex:
            nextCurrentStopIndex < 0 ? placesToSave.length : nextCurrentStopIndex,
          isEdited,
          status: computedStatus,
          startedAt: startedAt || new Date().toISOString(),
          completedAt: computedStatus === 'completed' ? new Date().toISOString() : null,
          navigableRoute: allStopsForPersistence.map((stop, i) => ({
            order: i + 1,
            kind: stop.place ? 'place' : 'event',
            stop_id: stop.place ? stop.place.id : stop.event ? stop.event.id : '',
          })),
          allPlacesAndEvents: buildAllPlacesArray(allStopsForPersistence),
        });

        if (savedId) {
          tourIdRef.current = savedId;
          setTourId(savedId);
          setSavedTourOrder(allStopsForPersistence.map((stop) => stop.id));
          pendingEditSaveRef.current = false;
          lastSavedRouteOrderKeyRef.current = routeOrderKey;
        }
      } catch {
        // Preserve pending flag so we can retry later.
      } finally {
        pendingSaveInProgressRef.current = false;
      }
    })();
  }, [
    optimizedOrder?.key,
    savedTourOrder,
    routeDetails,
    tourStarted,
    user?.id,
    orderedPlacesForSave,
    tourStops,
    placeProgress,
    eventProgress,
    isEdited,
    startedAt,
    tourOrigin,
    orderedNavigableStops,
    visitedStopsInVisitOrder,
    route.params?.tourName,
  ]);

  const buildAllPlacesArray = (orderedStops: TourStop[]) =>
    orderedStops
      .map((stop, index) => {
        if (stop.place) {
          const progress = placeProgress[stop.place.id] || {};
          return {
            place_id: stop.place.id,
            visited: Boolean(progress.visited),
            visitedAt: progress.visitedAt || null,
            pointsEarned: Number(progress.pointsEarned || 0),
            proofImageUri: progress.proofImageUri || null,
            verifiedByGemini: Boolean(progress.verifiedByGemini),
            verificationConfidence: Number(progress.verificationConfidence || 0),
            addedByUser: Boolean(progress.addedByUser),
            order: index + 1,
          } as any;
        }
        if (stop.event) {
          const progress = eventProgress[stop.event.id] || {};
          return {
            event_id: stop.event.id,
            visited: Boolean(progress.attended),
            visitedAt: progress.visitedAt || null,
            pointsEarned: 0,
            proofImageUri: progress.proofImageUri || null,
            verifiedByGemini: Boolean(progress.verifiedByGemini),
            verificationConfidence: Number(progress.verificationConfidence || 0),
            addedByUser: false,
            order: index + 1,
          } as any;
        }
        return null;
      })
      .filter(Boolean);

  const lastSavedOptimizedOrderKeyRef = useRef<string | null>(null);
  const lastSavedRouteOrderKeyRef = useRef<string | null>(null);

  useEffect(() => {
    lastSavedOptimizedOrderKeyRef.current = null;
    lastSavedRouteOrderKeyRef.current = null;
  }, [tourId]);

  useEffect(() => {
    if (!routeDetails || !user?.id) return;
    if (pendingSaveInProgressRef.current) return;

    const routeOrderKey = orderedNavigableStops.map((stop) => stop.id).join(',');
    if (!routeOrderKey) return;
    if (routeOrderKey === lastSavedRouteOrderKeyRef.current) return;

    pendingEditSaveRef.current = true;
  }, [
    orderedNavigableStops,
    routeDetails,
    tourStarted,
    isPausedTour,
    user?.id,
  ]);

  // Persist to Firestore after tourStops updates from AddLocations
  useEffect(() => {
    if (!pendingEditSaveRef.current || !routeDetails || !user?.id) return;
    pendingEditSaveRef.current = false;

    const placesToSave =
      orderedPlacesForSave.length > 0
        ? orderedPlacesForSave
        : tourStops.map((s) => s.place!).filter(Boolean);
    if (placesToSave.length === 0) return;

    const debugNavigableRoute = allStopsForPersistence.map((stop, i) => ({
      order: i + 1,
      kind: stop.place ? 'place' : 'event',
      stop_id: stop.place ? stop.place.id : stop.event ? stop.event.id : '',
    }));
    console.log('[DEBUG] saveUserTour (tourStops update) navigableRoute:', debugNavigableRoute, 'persistableIds:', allStopsForPersistence.map(s => s.id));

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
      status: isCompletedTour
        ? 'completed'
        : isPausedTour
          ? 'paused'
          : tourStarted
            ? 'active'
            : 'saved',
      startedAt: startedAt || new Date().toISOString(),
      completedAt: null,
      navigableRoute: allStopsForPersistence.map((stop, i) => ({
        order: i + 1,
        kind: stop.place ? 'place' : 'event',
        stop_id: stop.place ? stop.place.id : stop.event ? stop.event.id : '',
      })),
      allPlacesAndEvents: buildAllPlacesArray(allStopsForPersistence),
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

    const debugNavigableRoute = allStopsForPersistence.map((stop, i) => ({
      order: i + 1,
      kind: stop.place ? 'place' : 'event',
      stop_id: stop.place ? stop.place.id : stop.event ? stop.event.id : '',
    }));
    console.log('[DEBUG] saveUserTour (optimizedOrder) navigableRoute:', debugNavigableRoute, 'allStopsForPersistenceIds:', allStopsForPersistence.map(p => p.id));

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
      navigableRoute: allStopsForPersistence.map((stop, i) => ({
        order: i + 1,
        kind: stop.place ? 'place' : 'event',
        stop_id: stop.place ? stop.place.id : stop.event ? stop.event.id : '',
      })),
      allPlacesAndEvents: buildAllPlacesArray(allStopsForPersistence),
    }).catch(() => { });
  }, [
    allStopsForPersistence,
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
      currentLocation ||
      visitedStopsInVisitOrder[visitedStopsInVisitOrder.length - 1]?.coordinate ||
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

  // Continuous GPS tracking — runs while the screen is mounted.
  useEffect(() => {
    let cancelled = false;

    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    (async () => {
      if (!(await requestLocationPermission()) || cancelled) return;

      watchIdRef.current = Geolocation.watchPosition(
        (position) => {
          if (!isFreshGpsPosition(position)) {
            return;
          }
          const accuracy = Number(position.coords.accuracy);
          if (
            !Number.isFinite(position.coords.longitude) ||
            !Number.isFinite(position.coords.latitude) ||
            (Number.isFinite(accuracy) && accuracy > MAX_ACCEPTED_GPS_ACCURACY_METERS)
          ) {
            return;
          }

          // Android can deliver one final queued watcher callback immediately
          // after its master location switch is disabled. Never restore that
          // stale point over the GPS-off state detected by the native module.
          if (nativeLocationDisabledRef.current) {
            return;
          }

          const next: [number, number] = [
            position.coords.longitude,
            position.coords.latitude,
          ];
          if (Number.isFinite(accuracy) && accuracy > 0) {
            currentLocationAccuracyRef.current = accuracy;
          }
          locationBlockedOnEntryRef.current = false;
          setCurrentLocation(next);
          currentLocationRef.current = next;
          locationUnavailableErrorsRef.current = 0;
          setLocationUnavailable(false);

          const heading = position.coords.heading;
          if (typeof heading === 'number' && heading >= 0 && heading <= 360) {
            setUserHeading(heading);
          }
        },
        (error) => {
          // Android can emit POSITION_UNAVAILABLE during a normal cold-GPS
          // fix. Do not pause on one transient callback; require repeated
          // failures while the tour is active before treating it as disabled.
          if (Number(error?.code) === 2) {
            locationUnavailableErrorsRef.current += 1;
            if (locationUnavailableErrorsRef.current >= 3) {
              setLocationUnavailable(true);
            }
          }
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 1,
          maximumAge: 0,
          timeout: 15000,
          interval: 1000,
          fastestInterval: 500,
        }
      );
    })();

    return () => {
      cancelled = true;
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
    if (!mapReady || !nativeMapReady || !tourStarted || followMode !== 'follow' || !currentLocation) return;
    const heading =
      typeof userHeading === 'number' && userHeading >= 0 && userHeading <= 360
        ? userHeading
        : 0;
    cameraRef.current?.setCamera({
      centerCoordinate: currentLocation,
      zoomLevel: 16,
      heading,
      animationDuration: 250,
      animationMode: 'easeTo',
    });
  }, [currentLocation, followMode, mapReady, nativeMapReady, tourStarted, userHeading]);

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

  const pendingNavigableStops = useMemo(
    () =>
      (tourStarted || hasVisitedProgress) && orderedRemainingStops.length > 0
        ? orderedRemainingStops
        : orderedPlaceStops,
    [hasVisitedProgress, orderedPlaceStops, orderedRemainingStops, tourStarted]
  );

  const pendingRouteStopsKey = useMemo(
    () => pendingNavigableStops.map((stop) => stop.id).join(','),
    [pendingNavigableStops]
  );

  useEffect(() => {
    const hasCompletedTour = orderedPlaceStops.length > 0 && orderedRemainingStops.length === 0;
    latestRouteStopsKeyRef.current = pendingRouteStopsKey;

    if (hasCompletedTour) {
      routeRequestSequenceRef.current += 1;
      routeRequestInFlightRef.current = null;
      roadSegmentsRef.current = [];
      airSegmentsRef.current = [];
      renderedRouteStopsKeyRef.current = '';
      setRoadSegments([]);
      setAirSegments([]);
      setRenderedRouteStopsKey('');
      return;
    }

    // Keep the last valid Mapbox road geometry visible while GPS is disabled.
    // Once location returns this effect reruns with a fresh origin and swaps
    // in the updated by-road route.
    if (
      locationUnavailable ||
      pausedByLocationRef.current ||
      locationBlockedOnEntryRef.current
    ) {
      return;
    }

    // Never build an active-tour route from the stop list alone. On a fresh
    // install Android may still be resolving the first GPS fix; waiting here
    // prevents the route from being anchored to a stale/default location.
    if ((tourStarted || hasVisitedProgress) && !currentLocation) {
      return;
    }

    const routeStartCoordinate =
      ((tourStarted || hasVisitedProgress) ? routeAnchor : currentLocation) || null;

    const lineStops = [
      ...(routeStartCoordinate ? [routeStartCoordinate] : []),
      ...pendingNavigableStops.map((stop) => stop.coordinate),
    ];

    if (lineStops.length < 2) {
      routeRequestSequenceRef.current += 1;
      routeRequestInFlightRef.current = null;
      roadSegmentsRef.current = [];
      airSegmentsRef.current = [];
      renderedRouteStopsKeyRef.current = '';
      setRoadSegments([]);
      setAirSegments([]);
      setRenderedRouteStopsKey('');
      return;
    }

    const isNavigatedRoute = tourStarted || hasVisitedProgress;
    const expectedLegCount = lineStops.length - 1;
    const currentRoadSegments = roadSegmentsRef.current;
    const currentAirSegments = airSegmentsRef.current;
    const routeMatchesCurrentStops =
      renderedRouteStopsKeyRef.current === pendingRouteStopsKey;
    const hasCompleteRoute =
      routeMatchesCurrentStops &&
      currentRoadSegments.length === expectedLegCount &&
      Array.from({ length: expectedLegCount }, (_, index) =>
        isRenderableRouteSegment(currentRoadSegments[index]) ||
        isRenderableRouteSegment(currentAirSegments[index])
      ).every(Boolean);

    // Progress along the selected road is rendered locally for every GPS
    // update. Only ask Mapbox for a new active leg when GPS has genuinely
    // moved away from that road, so the UI is immediate without flooding the
    // Directions API while the user follows the suggested route.
    const activeRoadSegment =
      routeMatchesCurrentStops && isRenderableRouteSegment(currentRoadSegments[0])
        ? currentRoadSegments[0]
        : null;
    const offRouteDistance =
      tourStarted && currentLocation && activeRoadSegment
        ? distanceMetersBetween(
          currentLocation,
          projectPointOnPolyline(currentLocation, activeRoadSegment).point
        )
        : 0;
    const accuracyAwareRerouteDistance = Math.min(
      MAX_OFF_ROUTE_REROUTE_DISTANCE_METERS,
      Math.max(
        MIN_OFF_ROUTE_REROUTE_DISTANCE_METERS,
        currentLocationAccuracyRef.current * 1.25
      )
    );
    const needsOffRouteRefresh =
      tourStarted &&
      Boolean(activeRoadSegment) &&
      offRouteDistance >= accuracyAwareRerouteDistance;

    if (hasCompleteRoute && !needsOffRouteRefresh) {
      return;
    }

    const inFlight = routeRequestInFlightRef.current;
    if (
      inFlight?.stopsKey === pendingRouteStopsKey &&
      !(
        needsOffRouteRefresh &&
        inFlight.kind === 'full' &&
        Boolean(activeRoadSegment)
      )
    ) {
      return;
    }

    const now = Date.now();
    const elapsedSinceRequest = now - lastRouteRequestAtRef.current;
    if (
      lastRouteRequestStopsKeyRef.current === pendingRouteStopsKey &&
      elapsedSinceRequest < LIVE_ROUTE_REFRESH_MIN_INTERVAL_MS
    ) {
      if (!routeRetryTimerRef.current) {
        routeRetryTimerRef.current = setTimeout(() => {
          routeRetryTimerRef.current = null;
          if (routeScreenMountedRef.current) {
            setRouteRetryNonce((value) => value + 1);
          }
        }, LIVE_ROUTE_REFRESH_MIN_INTERVAL_MS - elapsedSinceRequest);
      }
      return;
    }

    if (routeRetryTimerRef.current) {
      clearTimeout(routeRetryTimerRef.current);
      routeRetryTimerRef.current = null;
    }

    const requestId = routeRequestSequenceRef.current + 1;
    routeRequestSequenceRef.current = requestId;
    routeRequestInFlightRef.current = {
      id: requestId,
      stopsKey: pendingRouteStopsKey,
      kind:
        needsOffRouteRefresh && Boolean(activeRoadSegment)
          ? 'active'
          : 'full',
    };
    lastRouteRequestAtRef.current = now;
    lastRouteRequestStopsKeyRef.current = pendingRouteStopsKey;
    const scheduleRetry = (delay = ROUTE_RETRY_DELAY_MS) => {
      if (routeRetryTimerRef.current) {
        clearTimeout(routeRetryTimerRef.current);
      }
      routeRetryTimerRef.current = setTimeout(() => {
        routeRetryTimerRef.current = null;
        if (routeScreenMountedRef.current) {
          setRouteRetryNonce((value) => value + 1);
        }
      }, delay);
    };

    const requestIsCurrent = () =>
      routeScreenMountedRef.current &&
      routeRequestSequenceRef.current === requestId &&
      latestRouteStopsKeyRef.current === pendingRouteStopsKey;

    const commitRoute = (
      nextRoad: [number, number][][],
      nextAir: [number, number][][] = []
    ) => {
      if (!requestIsCurrent()) return false;

      const hasActiveRoad = isRenderableRouteSegment(nextRoad[0]);
      const hasActiveAir = isRenderableRouteSegment(nextAir[0]);
      const hasAnyRoad = nextRoad.some(isRenderableRouteSegment);
      const hasAnyAir = nextAir.some(isRenderableRouteSegment);
      const usableRoute = isNavigatedRoute
        ? hasActiveRoad || hasActiveAir
        : hasAnyRoad || hasAnyAir;
      if (!usableRoute) return false;

      // Commit geometry and its stop-key atomically. Rendering checks this
      // key, so an old route can never be shown as the route to a newly
      // active stop after completion/reopen.
      roadSegmentsRef.current = nextRoad;
      airSegmentsRef.current = nextAir;
      renderedRouteStopsKeyRef.current = pendingRouteStopsKey;
      setRoadSegments(nextRoad);
      setAirSegments(nextAir);
      setRenderedRouteStopsKey(pendingRouteStopsKey);
      setRouteGeometryVersion((value) => value + 1);
      return true;
    };

    const fetchRoadRoute = async () => {
      try {
        let nextRoad: [number, number][][];
        let nextAir: [number, number][][] = [];

        // When only the live origin has changed, refresh just the user-to-next
        // stop leg. Future stop-to-stop legs are still valid and remain on
        // screen while this request is in flight.
        if (
          needsOffRouteRefresh &&
          isNavigatedRoute &&
          Boolean(activeRoadSegment) &&
          routeStartCoordinate &&
          pendingNavigableStops[0]
        ) {
          const activeLeg = await fetchRouteSegment(
            routeStartCoordinate,
            pendingNavigableStops[0].coordinate
          );
          if (
            !isRenderableRouteSegment(activeLeg.road) &&
            !isRenderableRouteSegment(activeLeg.air)
          ) {
            scheduleRetry();
            return;
          }
          nextRoad = [activeLeg.road, ...currentRoadSegments.slice(1)];
          nextAir = [activeLeg.air, ...currentAirSegments.slice(1)];
        } else if (isNavigatedRoute) {
          // Start all road calls together, but do not make the active route
          // wait for every future leg. As soon as user -> next stop resolves,
          // render it and let the remaining legs finish in the background.
          const segmentRequests = lineStops.slice(0, -1).map((from, index) =>
            fetchRouteSegment(
              from as [number, number],
              lineStops[index + 1] as [number, number]
            )
          );
          const activeLeg = await segmentRequests[0];
          const hasActiveSegment =
            isRenderableRouteSegment(activeLeg.road) ||
            isRenderableRouteSegment(activeLeg.air);
          if (!hasActiveSegment || !requestIsCurrent()) {
            if (requestIsCurrent()) scheduleRetry();
            return;
          }

          const provisionalFutureRoad = Array.from(
            { length: Math.max(0, expectedLegCount - 1) },
            (_, index) =>
              routeMatchesCurrentStops
                ? currentRoadSegments[index + 1] || []
                : []
          );
          const provisionalFutureAir = Array.from(
            { length: Math.max(0, expectedLegCount - 1) },
            (_, index) =>
              routeMatchesCurrentStops
                ? currentAirSegments[index + 1] || []
                : []
          );
          commitRoute(
            [activeLeg.road, ...provisionalFutureRoad],
            [activeLeg.air, ...provisionalFutureAir]
          );

          if (expectedLegCount === 1) {
            return;
          }

          const futureSegments = await Promise.all(segmentRequests.slice(1));
          nextRoad = [
            activeLeg.road,
            ...futureSegments.map((segment) =>
              isRenderableRouteSegment(segment.road) ? segment.road : []
            ),
          ];
          nextAir = [
            activeLeg.air,
            ...futureSegments.map((segment) =>
              isRenderableRouteSegment(segment.air) ? segment.air : []
            ),
          ];
        } else {
          const next = await buildRouteSegments(lineStops as [number, number][]);
          nextRoad = next.road;
          nextAir = next.air;
        }

        if (!commitRoute(nextRoad, nextAir)) {
          if (!requestIsCurrent()) return;
          scheduleRetry();
          return;
        }

        const routeIsComplete =
          nextRoad.length === expectedLegCount &&
          Array.from({ length: expectedLegCount }, (_, index) =>
            isRenderableRouteSegment(nextRoad[index]) ||
            isRenderableRouteSegment(nextAir[index])
          ).every(Boolean);
        if (!routeIsComplete) {
          scheduleRetry();
        }
      } catch {
        // Never erase the last valid road geometry on a transient Mapbox or
        // network failure. Retry quietly; the existing route stays usable.
        scheduleRetry();
      } finally {
        if (routeRequestInFlightRef.current?.id === requestId) {
          routeRequestInFlightRef.current = null;
        }
      }
    };

    fetchRoadRoute();
  }, [
    buildRouteSegments,
    currentLocation,
    fetchRouteSegment,
    hasVisitedProgress,
    locationUnavailable,
    orderedPlaceStops,
    orderedRemainingStops.length,
    pendingNavigableStops,
    pendingRouteStopsKey,
    routeAnchor,
    routeGeometryVersion,
    routeRetryNonce,
    tourStarted,
  ]);

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
          setCompletedRoadSegments([]);
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
          setCompletedApproachRoadSegments([]);
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

  const routeGeometryMatchesCurrentStops =
    renderedRouteStopsKey === pendingRouteStopsKey;

  const makeRouteFeature = useCallback((segment: [number, number][]) => ({
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: segment },
  }), []);

  const activeRouteLine = useMemo<FeatureCollection<LineString>>(
    () => {
      if (
        !routeGeometryMatchesCurrentStops ||
        !(tourStarted || hasVisitedProgress)
      ) {
        return { type: 'FeatureCollection', features: [] };
      }

      const activeSegment = isRenderableRouteSegment(roadSegments[0])
        ? roadSegments[0]
        : isRenderableRouteSegment(airSegments[0])
          ? airSegments[0]
          : null;
      if (!activeSegment) {
        return { type: 'FeatureCollection', features: [] };
      }

      let remaining: Coord[] = activeSegment;
      if (currentLocation) {
        const projection = projectPointOnPolyline(currentLocation, remaining);
        // A malformed/incomplete leg must not take the whole screen down.
        // `splitPolylineAt` normally always returns both arrays, but the
        // fallback also protects releases receiving stale cached geometry.
        const split = splitPolylineAt(remaining, projection);
        remaining = Array.isArray(split?.remaining) ? split.remaining : [];
      }

      return {
        type: 'FeatureCollection',
        features: remaining.length >= 2 ? [makeRouteFeature(remaining)] : [],
      };
    },
    [
      currentLocation,
      airSegments,
      hasVisitedProgress,
      makeRouteFeature,
      roadSegments,
      routeGeometryMatchesCurrentStops,
      tourStarted,
    ]
  );

  const routeLine = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: routeGeometryMatchesCurrentStops
        ? [
          ...(
            (tourStarted || hasVisitedProgress)
              ? roadSegments.slice(1)
              : roadSegments
          ),
          ...(
            (tourStarted || hasVisitedProgress)
              ? airSegments.slice(1)
              : airSegments
          ),
        ]
          .filter(isRenderableRouteSegment)
          .map(makeRouteFeature)
        : [],
    }),
    [
      airSegments,
      hasVisitedProgress,
      makeRouteFeature,
      roadSegments,
      routeGeometryMatchesCurrentStops,
      tourStarted,
    ]
  );

  const completedRouteLine = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: [...completedRoadSegments, ...completedAirSegments]
        .filter(isRenderableRouteSegment)
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
        .filter(isRenderableRouteSegment)
        .map((seg) => ({
          type: 'Feature' as const,
          properties: {},
          geometry: { type: 'LineString' as const, coordinates: seg },
        })),
    }),
    [completedApproachAirSegments, completedApproachRoadSegments]
  );
  const activeRouteCompletedShape = useMemo<FeatureCollection<LineString>>(() => {
    const activePolyline: Coord[] | null =
      !routeGeometryMatchesCurrentStops
        ? null
        : isRenderableRouteSegment(roadSegments[0])
          ? roadSegments[0]
          : isRenderableRouteSegment(airSegments[0])
            ? airSegments[0]
            : null;
    if (!activePolyline || !currentLocation) {
      return { type: 'FeatureCollection', features: [] };
    }
    const projection = projectPointOnPolyline(currentLocation, activePolyline);
    const split = splitPolylineAt(activePolyline, projection);
    const completed = Array.isArray(split?.completed) ? split.completed : [];
    const markerGap = distanceMetersBetween(currentLocation, projection.point);
    // The gray line represents progress already travelled, so its endpoint
    // must follow the live marker immediately even while a new by-road red
    // route is being fetched after a deviation.
    const completedToLiveMarker: Coord[] =
      markerGap > 0.75
        ? [...completed, currentLocation]
        : completed;
    if (completedToLiveMarker.length < 2) {
      return { type: 'FeatureCollection', features: [] };
    }
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: completedToLiveMarker },
      }],
    };
  }, [airSegments, currentLocation, roadSegments, routeGeometryMatchesCurrentStops]);

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
        (sum, item) => sum + (item.visited ? Number(item.pointsEarned || 0) : 0),
        0
      ),
    [placeProgress]
  );

  const routeDistanceKm = useMemo(() => {
    const visibleRoadSegments = routeGeometryMatchesCurrentStops
      ? roadSegments
      : [];
    const visibleAirSegments = routeGeometryMatchesCurrentStops
      ? airSegments
      : [];
    const allCoords: [number, number][] = [
      ...completedRoadSegments.flat(),
      ...completedAirSegments.flat(),
      ...visibleRoadSegments.flat(),
      ...visibleAirSegments.flat(),
    ];
    if (allCoords.length < 2) return 0;
    const meters = allCoords
      .slice(1)
      .reduce((sum: number, coord: [number, number], i: number) =>
        sum + distanceMetersBetween(allCoords[i], coord), 0);
    return meters / 1000;
  }, [
    airSegments,
    completedAirSegments,
    completedRoadSegments,
    roadSegments,
    routeGeometryMatchesCurrentStops,
  ]);

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
      const nextEventProgress = { ...eventProgress };
      delete nextEventProgress[eventId];
      const nextOrderedStops = orderedNavigableStops.filter(
        (stop) => stop.event?.id !== eventId
      );

      setRouteDetails((prev) =>
        prev
          ? {
            ...prev,
            events: nextEvents,
          }
          : prev
      );
      setEventProgress(nextEventProgress);
      setSelectedEvent(null);
      setIsEdited(true);
      pendingEditSaveRef.current = true;

      if (user?.id) {
        try {
          const placesToSave =
            orderedPlacesForSave.length > 0
              ? orderedPlacesForSave
              : tourStops.map((stop) => stop.place!).filter(Boolean);
          const nextCurrentStopIndex = placesToSave.findIndex(
            (place) => !placeProgress[place.id]?.visited
          );
          const nextPersistableStops = persistableTourStops.filter(
            (stop) => stop.id !== eventId
          );

          const debugNavigableRoute = allStopsForPersistence.map((stop, i) => ({
            order: i + 1,
            kind: stop.place ? 'place' : 'event',
            stop_id: stop.place ? stop.place.id : stop.event ? stop.event.id : '',
          }));
          console.log('[DEBUG] saveUserTour (remove event) navigableRoute:', debugNavigableRoute, 'allStopsForPersistenceIds:', allStopsForPersistence.map(s => s.id));

          await saveUserTour({
            tourId: tourIdRef.current,
            userId: user.id,
            userName: user.name || '',
            userEmail: user.email || '',
            route: routeDetails.route,
            title: route.params?.tourName || routeDetails.route.name,
            places: placesToSave,
            events: nextEvents,
            placeProgress,
            eventProgress: nextEventProgress,
            currentStopIndex:
              nextCurrentStopIndex < 0 ? placesToSave.length : nextCurrentStopIndex,
            isEdited: true,
            status: isPausedTour ? 'paused' : tourStarted ? 'active' : 'saved',
            startedAt: startedAt || new Date().toISOString(),
            completedAt: null,
            navigableRoute: allStopsForPersistence.map((stop, i) => ({
              order: i + 1,
              kind: stop.place ? 'place' : 'event',
              stop_id: stop.place ? stop.place.id : stop.event ? stop.event.id : '',
            })),
            allPlacesAndEvents: buildAllPlacesArray(allStopsForPersistence),
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
      orderedNavigableStops,
      eventProgress,
      isPausedTour,
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
      roadSegmentsRef.current = [];
      airSegmentsRef.current = [];
      renderedRouteStopsKeyRef.current = '';
      setRenderedRouteStopsKey('');
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

      const hasVisited = Object.values(nextProgress).some(
        (item) => item.visited && item.verifiedByGemini,
      );
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
        !optimizedOrder &&
        !savedTourOrder &&
        routePlaceStops.length > 1;
      if (shouldDeferActiveSave) {
        pendingEditSaveRef.current = true;
        return tourIdRef.current;
      }

      const nextCurrentStopIndex = placesToSave.findIndex(
        (place) => !(nextProgress[place.id]?.visited && nextProgress[place.id]?.verifiedByGemini)
      );
      const remainingStops = placesToSave.filter(
        (place) => !(nextProgress[place.id]?.visited && nextProgress[place.id]?.verifiedByGemini)
      );
      const computedStatus = remainingStops.length === 0 ? 'completed' : 'active';
      const status = forcedStatus ?? computedStatus;
      const debugNavigableRoute = allStopsForPersistence.map((stop, i) => ({
        order: i + 1,
        kind: stop.place ? 'place' : 'event',
        stop_id: stop.place ? stop.place.id : stop.event ? stop.event.id : '',
      }));
      console.log('[DEBUG] saveUserTour (persistTourIfNeeded) navigableRoute:', debugNavigableRoute, 'allStopsForPersistenceIds:', allStopsForPersistence.map(s => s.id));

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
        navigableRoute: allStopsForPersistence.map((stop, i) => ({
          order: i + 1,
          kind: stop.place ? 'place' : 'event',
          stop_id: stop.place ? stop.place.id : stop.event ? stop.event.id : '',
        })),
        allPlacesAndEvents: buildAllPlacesArray(allStopsForPersistence),
      });
      tourIdRef.current = savedId;
      setTourId(savedId);
      return savedId;
    },
    [
      allStopsForPersistence,
      buildAllPlacesArray,
      eventProgress,
      isEdited,
      orderedPlacesForSave,
      route.params?.tourName,
      routeDetails,
      routePlaceStops,
      savedTourOrder,
      tourStarted,
      tourStops,
      tourId,
      user?.email,
      user?.id,
      user?.name,
      optimizedOrder,
    ]
  );
  const pauseTourState = useCallback(async (showPausedToast = true) => {
    if (leavingRef.current || isCompletedTour) {
      return tourId || null;
    }

    leavingRef.current = true;
    setTourStarted(false);
    setIsPausedTour(true);
    setSelectedStop(null);
    setSelectedEvent(null);
    const savedId = await persistTourIfNeeded(placeProgress, startedAt, 'paused').catch(() => null);
    if (showPausedToast) {
      showInfo('Tour Paused', 'You can resume this tour anytime.');
    }
    // `persistTourIfNeeded` may create the document during this call. Use the
    // ref as the authoritative ID so the screen we navigate back to updates
    // the exact paused card instead of leaving a stale/duplicate route.
    return savedId || tourIdRef.current || tourId || null;
  }, [isCompletedTour, persistTourIfNeeded, placeProgress, startedAt, tourId]);

  // If the user disables device location while the tour is active, the OS
  // cannot be intercepted before the Settings change. Detect it as soon as
  // the app returns, pause safely, and prevent a route from continuing on a
  // stale position.
  useEffect(() => {
    if (!locationUnavailable || !tourStarted || !isOnline || locationPauseAlertRef.current) return;

    locationPauseAlertRef.current = true;
    setCurrentLocation(null);

    // A process restored directly into an already-active tour has not yet had
    // a live fix in this session. Keep that tour suspended in place so Open
    // Settings -> location ON can continue it and rebuild the road route.
    if (locationBlockedOnEntryRef.current) {
      showLocationRequiredAlert({ blocking: true });
      return;
    }

    // Pause/persist in the background, but show the actionable settings modal
    // immediately. Waiting for Firestore here made the screen appear stuck.
    pausedByLocationRef.current = true;
    locationPausePromiseRef.current = pauseTourState(false);
    showLocationRequiredAlert({ blocking: true });
  }, [isOnline, locationUnavailable, pauseTourState, tourStarted]);

  useEffect(() => {
    if (tourStarted && !isOnline) {
      offlineAlertRef.current = true;
      showInternetRequiredAlert();
      return;
    }

    if (offlineAlertRef.current && isOnline) {
      offlineAlertRef.current = false;
      CustomAlert.dismiss();
      if (tourStarted && locationUnavailable) {
        locationPauseAlertRef.current = true;
        showLocationRequiredAlert({ blocking: true });
      }
    }
  }, [isOnline, locationUnavailable, tourStarted]);

  useEffect(() => {
    // Allow the warning to be shown again if this mounted screen is later
    // resumed successfully and location is disabled a second time.
    if (!locationUnavailable) {
      if (locationPauseAlertRef.current && isOnline && !offlineAlertRef.current) {
        CustomAlert.dismiss();
      }
      locationPauseAlertRef.current = false;
    }
  }, [isOnline, locationUnavailable]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || (!tourStarted && !pausedByLocationRef.current)) return;

      let cancelled = false;
      const resumeLocationPausedTour = async () => {
        if (!pausedByLocationRef.current) return;
        await locationPausePromiseRef.current;
        if (cancelled) return;

        leavingRef.current = false;
        pausedByLocationRef.current = false;
        locationPausePromiseRef.current = null;
        setIsPausedTour(false);
        setTourStarted(true);
        persistTourIfNeeded(placeProgress, startedAt, 'active', true).catch(() => null);
      };

      const verifyLocationService = async () => {
        if (!(await requestLocationPermission()) || cancelled) {
          if (!cancelled) {
            setLocationStatusChecked(true);
            setLocationUnavailable(true);
            locationPauseAlertRef.current = true;
            showLocationRequiredAlert({ blocking: true });
          }
          return;
        }

        // A JS GPS watcher can be suspended while the screen is locked. Read
        // the fix written by the native foreground service first so the map
        // and the active route recover immediately on unlock.
        const nativeStatus = await getNativeTourLocationStatus();
        if (cancelled) return;
        if (nativeStatus?.locationEnabled === false) {
          nativeLocationDisabledRef.current = true;
          setLocationUnavailable(true);
          // The Open Settings action dismisses the modal before Android comes
          // back to the app. If location is still off, present it again.
          locationPauseAlertRef.current = true;
          showLocationRequiredAlert({ blocking: true });
          return;
        }
        if (nativeStatus?.locationEnabled === true) {
          nativeLocationDisabledRef.current = false;
          locationBlockedOnEntryRef.current = false;
          setLocationStatusChecked(true);
          setLocationUnavailable(false);
          await startNativeTourLocation(tourIdRef.current);

          // A running tour is paused while its required GPS service is off.
          // Returning from Location Settings with GPS enabled resumes only
          // that automatic pause; a user-initiated pause stays paused.
          await resumeLocationPausedTour();
        }
        const nativeAge = Number(nativeStatus?.timestamp) > 0
          ? Date.now() - Number(nativeStatus?.timestamp)
          : Number.POSITIVE_INFINITY;
        const nativeLatitude = Number(nativeStatus?.latitude);
        const nativeLongitude = Number(nativeStatus?.longitude);
        if (
          nativeStatus &&
          nativeAge <= MAX_INITIAL_FIX_AGE_MS &&
          Number.isFinite(nativeLatitude) &&
          Number.isFinite(nativeLongitude)
        ) {
          const nativeAccuracy = Number(nativeStatus.accuracy);
          if (Number.isFinite(nativeAccuracy) && nativeAccuracy > 0) {
            currentLocationAccuracyRef.current = nativeAccuracy;
          }
          const next: [number, number] = [nativeLongitude, nativeLatitude];
          setLocationUnavailable(false);
          setCurrentLocation(next);
          currentLocationRef.current = next;
          return;
        }

        try {
          const next = await getCurrentPositionAsync(6000);
          if (cancelled) return;
          setCurrentLocation(next);
          currentLocationRef.current = next;
          setLocationUnavailable(false);
          await resumeLocationPausedTour();
        } catch {
          // A resume-time timeout is also common while Android reacquires a
          // cold GPS fix. The watcher is the debounced source of truth for
          // location-disabled handling, so never pause from this one probe.
          return;
        }
      };

      verifyLocationService();
    });

    return () => subscription.remove();
  }, [persistTourIfNeeded, placeProgress, startedAt, tourStarted]);

  // Expose tour-active state to the TabNavigator so it can intercept any
  // tab press while a tour is running. Reading route.params from the
  // navigator level is more reliable than chasing parent listeners.
  useEffect(() => {
    navigation.setParams({ tourActive: tourStarted });
  }, [navigation, tourStarted]);

  // Intercept back navigation when tour is active — offer pause or stay
  const handlePreventRemove = useCallback((e: any) => {
    if (!tourStarted) return;
    if (leavingRef.current) return;
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
  }, [tourStarted, pauseTourState, navigation]);

  usePreventRemove(tourStarted, handlePreventRemove);

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
      await recordTourFavoritedPlace(activeTourId, place.id).catch(() => { });
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
          (pos) => {
            if (!isFreshGpsPosition(pos)) {
              reject(new Error('Stale GPS position'));
              return;
            }
            resolve([pos.coords.longitude, pos.coords.latitude]);
          },
          () => {
            Geolocation.getCurrentPosition(
              (pos) => {
                if (!isFreshGpsPosition(pos)) {
                  reject(new Error('Stale GPS position'));
                  return;
                }
                resolve([pos.coords.longitude, pos.coords.latitude]);
              },
              reject,
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
            );
          },
          // Network-assisted location is faster on a cold start. The
          // timestamp is still validated above, so an old hostel fix cannot
          // be accepted; the live high-accuracy watcher refines it afterward.
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
        );
      });

    try {
      if (!(await requestLocationPermission())) return;
      const pos = await getPos();
      setCurrentLocation(pos);
      currentLocationRef.current = pos;
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

  // On a fresh install Android may still be resolving the first permission
  // dialog/GPS fix when the screen mounts. The recenter button works because
  // it retries this exact request later, so do the same automatically.
  useEffect(() => {
    if (!tourStarted && !routeDetails) return;

    let cancelled = false;
    const retryInitialLocation = async () => {
      // A cold Android GPS fix can need several seconds after permission is
      // granted. Retry automatically so the user never has to press recenter
      // just to start the first route.
      for (let attempt = 0; attempt < 8; attempt += 1) {
        if (cancelled || currentLocationRef.current) return;
        await handleCurrentLocation(false);
        if (cancelled || currentLocationRef.current) return;
        await new Promise<void>((resolve) => setTimeout(resolve, 2000));
      }
    };

    retryInitialLocation();
    return () => {
      cancelled = true;
    };
  }, [handleCurrentLocation, routeDetails, tourStarted]);

  const prepareVerification = async (
    destinationName: string,
    destinationCoordinate: [number, number],
  ): Promise<[number, number] | null> => {
    // The watcher already maintains the latest GPS fix. Use it immediately
    // for the radius gate so an out-of-range user gets feedback without
    // waiting for another OS GPS request to time out.
    const latestCoordinates = currentLocationRef.current;
    if (latestCoordinates) {
      const latestDistance = distanceMetersBetween(latestCoordinates, destinationCoordinate);
      if (latestDistance > VISIT_DISTANCE_THRESHOLD_METERS) {
        CustomAlert.alert(
          'Too Far Away',
          `You must be within 100 meters of ${destinationName} to verify this location.`,
          [{ text: 'OK', style: 'cancel' }],
        );
        return null;
      }
      return latestCoordinates;
    }

    const captureCoordinates = await getCoordinatesForVerification();
    if (!captureCoordinates) {
      CustomAlert.alert(
        'Location Required',
        'Unable to get your current location. Please enable location access and try again.',
        [{ text: 'OK', style: 'cancel' }],
      );
      return null;
    }

    setCurrentLocation(captureCoordinates);
    const distance = distanceMetersBetween(captureCoordinates, destinationCoordinate);
    if (distance > VISIT_DISTANCE_THRESHOLD_METERS) {
      CustomAlert.alert(
        'Too Far Away',
        `You must be within 100 meters of ${destinationName} to verify this location.`,
        [{ text: 'OK', style: 'cancel' }],
      );
      return null;
    }

    return captureCoordinates;
  };

  const getCoordinatesForVerification = async (): Promise<[number, number] | null> => {
    const permitted = await requestLocationPermission();
    if (!permitted) return currentLocationRef.current;

    return getCurrentPositionAsync().catch(() => currentLocationRef.current);
  };

  const handlePauseTour = async () => {
    if (isCompletedTour || isPausingTour) {
      return;
    }
    setIsPausingTour(true);
    try {
      const savedId = await pauseTourState();
      navigation.navigate('MyTour', {
        tourUpdate: {
          tourId: savedId || tourId || undefined,
          routeId: routeId,
          status: 'paused',
          updatedAt: new Date().toISOString(),
        },
      });
    } finally {
      if (routeScreenMountedRef.current) {
        setIsPausingTour(false);
      }
    }
  };


  const handleEventVerification = async (imageUri: string) => {
    const event = scanTargetEvent || selectedEvent || selectedStop?.event;
    if (!event) {
      return false;
    }

    const isOnline = await checkInternetConnection();
    if (!isOnline) {
      showInternetRequiredAlert();
      return false;
    }

    const eventMeta = event as any;
    const eventCoordinate: [number, number] = [
      Number(event.coordinates?.longitude || 0),
      Number(event.coordinates?.latitude || 0),
    ];
    const captureCoordinates = ALLOW_ANY_IMAGE_FOR_TESTING
      ? currentLocation || eventCoordinate
      : await getCoordinatesForVerification();
    const captureDistanceMeters = captureCoordinates
      ? distanceMetersBetween(captureCoordinates, eventCoordinate)
      : undefined;
    if (!ALLOW_ANY_IMAGE_FOR_TESTING && !captureCoordinates) {
      return {
        verified: false,
        reason: 'Unable to get your current location. Please enable location access and try again.',
      } satisfies VerificationFailure;
    }
    if (!ALLOW_ANY_IMAGE_FOR_TESTING && captureDistanceMeters !== undefined && captureDistanceMeters > VISIT_DISTANCE_THRESHOLD_METERS) {
      return {
        verified: false,
        reason: `You must be within 100 meters of ${event.title} to verify this location.`,
      } satisfies VerificationFailure;
    }
    const aiMatch = await verifyPlaceImageMatch({
      title: event.title,
      location: eventMeta.location || event.address || event.city_name || event.country,
      imageUrl: eventMeta.imageUrl || event.coverImage || '',
      targetCoordinates: eventCoordinate,
      captureCoordinates: captureCoordinates || undefined,
      captureDistanceMeters,
      verificationRadius: VISIT_DISTANCE_THRESHOLD_METERS,
    }, imageUri);
    const eventLocationMatched = Boolean(
      captureCoordinates &&
      captureDistanceMeters !== undefined &&
      captureDistanceMeters <= VISIT_DISTANCE_THRESHOLD_METERS,
    );

    if (!ALLOW_ANY_IMAGE_FOR_TESTING && (!aiMatch.matched || !eventLocationMatched)) {
      return {
        verified: false,
        reason: aiMatch.reason || getVerificationFailureMessage(
          event.title,
          aiMatch.matched,
          eventLocationMatched,
          Boolean(captureCoordinates),
        ),
      } satisfies VerificationFailure;
    }

    try {
      const coords = ALLOW_ANY_IMAGE_FOR_TESTING
        ? currentLocation || eventCoordinate
        : captureCoordinates;

      const expectedNextStop = orderedRemainingStops[0];
      const eventStopId = event.id;
      if (expectedNextStop && expectedNextStop.id !== eventStopId) {
        showInfo(
          'Next Stop First',
          `Please complete your next route stop first: ${expectedNextStop.title}.`
        );
        return false;
      }

      if (!coords) return false;

      const visitedAt = new Date().toISOString();
      const nextEventProgress = {
        ...(eventProgress || {}),
        [event.id]: {
          ...((eventProgress || {})[event.id] || {}),
          attended: true,
          visited: true,
          visitedAt,
          proofImageUri: imageUri,
          verifiedByGemini: true,
          verificationConfidence: aiMatch.confidence,
        },
      };

      setEventProgress(nextEventProgress);
      setSelectedEvent(null);
      setSelectedStop(null);
      setTourOrigin((prev) => prev || coords);
      setCurrentLocation(coords);
      showSuccess('Event Attended', `You checked in at ${event.title}.`);

      // Persist updated event progress immediately so event shows as visited
      // in `all_places` when saved to Firestore.
      try {
        const activePlaceStops = tourStops.map((stop) => stop.place!).filter(Boolean);
        const placesToSave =
          orderedPlacesForSave.length > 0 ? orderedPlacesForSave : activePlaceStops;

        const nextCurrentStopIndex = placesToSave.findIndex(
          (place) => !placeProgress[place.id]?.visited
        );
        const remainingStops = placesToSave.filter((place) => !placeProgress[place.id]?.visited);

        // Check if all places AND events are complete
        const checkRemainingPlaces = activePlaceStops.filter((place) => {
          const progress = placeProgress[place.id];
          return !(progress?.visited && progress?.verifiedByGemini);
        });
        const checkRemainingEvents = (routeDetails?.events || []).filter((event) => {
          const eventProg = nextEventProgress[event.id];
          return !Boolean((eventProg?.attended && eventProg?.verifiedByGemini) || eventProg?.expired);
        });
        const computedStatus = (checkRemainingPlaces.length === 0 && checkRemainingEvents.length === 0) ? 'completed' : 'active';

        const savedId = await saveUserTour({
          tourId: tourIdRef.current,
          userId: user?.id || '',
          userName: user?.name || '',
          userEmail: user?.email || '',
          route: routeDetails!.route,
          title: route.params?.tourName || routeDetails!.route.name,
          places: placesToSave,
          events: routeDetails!.events,
          placeProgress,
          eventProgress: nextEventProgress,
          currentStopIndex:
            nextCurrentStopIndex < 0 ? placesToSave.length : nextCurrentStopIndex,
          isEdited,
          status: computedStatus,
          startedAt: startedAt || new Date().toISOString(),
          completedAt: computedStatus === 'completed' ? new Date().toISOString() : null,
          navigableRoute: allStopsForPersistence.map((stop, i) => ({
            order: i + 1,
            kind: stop.place ? 'place' : 'event',
            stop_id: stop.place ? stop.place.id : stop.event ? stop.event.id : '',
          })),
          allPlacesAndEvents: buildAllPlacesArray(allStopsForPersistence),
        });
        if (savedId) {
          tourIdRef.current = savedId;
          setTourId(savedId);
        }

        // Show completion modal if tour is now complete
        if (computedStatus === 'completed') {
          setRoadSegments([]);
          setAirSegments([]);
          roadSegmentsRef.current = [];
          airSegmentsRef.current = [];
          setTourStarted(false);
          setTourActionVisible(false);
          setIsCompletedTour(true);
          setTourCompletedVisible(true);
        }
      } catch (err) {
        console.error('persist after event attendance failed', err);
      }

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

    const isOnline = await checkInternetConnection();
    if (!isOnline) {
      showInternetRequiredAlert();
      return false;
    }

    const placeMeta = selectedStop.place as any;
    const captureCoordinates = ALLOW_ANY_IMAGE_FOR_TESTING
      ? currentLocation || selectedStop.coordinate
      : await getCoordinatesForVerification();
    const captureDistanceMeters = captureCoordinates
      ? distanceMetersBetween(captureCoordinates, selectedStop.coordinate)
      : undefined;
    if (!ALLOW_ANY_IMAGE_FOR_TESTING && !captureCoordinates) {
      return {
        verified: false,
        reason: 'Unable to get your current location. Please enable location access and try again.',
      } satisfies VerificationFailure;
    }
    if (!ALLOW_ANY_IMAGE_FOR_TESTING && captureDistanceMeters !== undefined && captureDistanceMeters > VISIT_DISTANCE_THRESHOLD_METERS) {
      return {
        verified: false,
        reason: `You must be within 100 meters of ${selectedStop.place.name} to verify this location.`,
      } satisfies VerificationFailure;
    }
    const aiMatch = await verifyPlaceImageMatch({
      title: selectedStop.place.name,
      location: selectedStop.place.address || selectedStop.place.city_name || selectedStop.place.country,
      imageUrl: selectedStop.place.imageUrl || placeMeta.image || placeMeta.coverImage || '',
      targetCoordinates: selectedStop.coordinate,
      captureCoordinates: captureCoordinates || undefined,
      captureDistanceMeters,
      verificationRadius: VISIT_DISTANCE_THRESHOLD_METERS,
    }, imageUri);

    const placeLocationMatched = Boolean(
      captureCoordinates &&
      captureDistanceMeters !== undefined &&
      captureDistanceMeters <= VISIT_DISTANCE_THRESHOLD_METERS,
    );

    if (!ALLOW_ANY_IMAGE_FOR_TESTING && (!aiMatch.matched || !placeLocationMatched)) {
      return {
        verified: false,
        reason: aiMatch.reason || getVerificationFailureMessage(
          selectedStop.place.name,
          aiMatch.matched,
          placeLocationMatched,
          Boolean(captureCoordinates),
        ),
      } satisfies VerificationFailure;
    }

    try {
      const coords = ALLOW_ANY_IMAGE_FOR_TESTING
        ? currentLocation || selectedStop.coordinate
        : captureCoordinates;

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

      if (!coords) return false;

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
          verifiedByGemini: true,
          verificationConfidence: aiMatch.confidence,
          addedByUser:
            placeProgress[selectedStop.id]?.addedByUser ||
            extraPlaceIds.includes(selectedStop.id),
        },
      };

      setTourOrigin((prev) => prev || coords);
      setCurrentLocation(coords);
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
      // Check if all places and events are now complete with the updated progress
      // A better approach: recalculate what remaining stops would be with the new progress
      const checkRemainingStops = tourStops.filter((stop) => {
        const progress = nextProgress[stop.id];
        return !(progress?.visited && progress?.verifiedByGemini);
      });
      const checkRemainingEvents = (routeDetails?.events || []).filter((event) => {
        const eventProg = eventProgress[event.id];
        return !Boolean((eventProg?.attended && eventProg?.verifiedByGemini) || eventProg?.expired);
      });
      const allDone = checkRemainingStops.length === 0 && checkRemainingEvents.length === 0;

      if (allDone) {
        setRoadSegments([]);
        setAirSegments([]);
        roadSegmentsRef.current = [];
        airSegmentsRef.current = [];
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
              onDidFinishLoadingMap={() => {
                setNativeMapReady(true);
              }}
              onDidFinishLoadingStyle={() => {
                // On a fresh Android install the style can finish after the
                // map event. Either event is sufficient to safely issue the
                // first camera update.
                setNativeMapReady(true);
              }}
              onMapLoadingError={() => {
                console.warn('[MyTourStart] Mapbox loading error');
              }}
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
                <Mapbox.ShapeSource
                  key={`future-route-${routeGeometryVersion}`}
                  id="tourRouteLine"
                  shape={routeLine}
                >
                  <Mapbox.LineLayer id="tourRouteLineLayer" style={
                    (tourStarted || hasVisitedProgress)
                      ? futureRouteLineLayerStyle
                      : routeLineLayerStyle
                  } />
                </Mapbox.ShapeSource>
              )}

              {activeRouteLine.features.length > 0 && (
                <Mapbox.ShapeSource
                  key={`active-route-${routeGeometryVersion}`}
                  id="activePendingRouteLine"
                  shape={activeRouteLine}
                >
                  <Mapbox.LineLayer
                    id="activePendingRouteLineLayer"
                    style={{ ...routeLineLayerStyle, lineWidth: 6, lineOpacity: 1 }}
                  />
                </Mapbox.ShapeSource>
              )}

              <Mapbox.ShapeSource id="activeRouteCompletedLine" shape={activeRouteCompletedShape}>
                <Mapbox.LineLayer id="activeRouteCompletedLineLayer" style={completedRouteLineLayerStyle} />
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

              {tourStarted
                ? completedTodayEventStops.map((stop) => (
                  <Mapbox.MarkerView
                    key={`event-completed-${stop.id}`}
                    id={`event-completed-${stop.id}`}
                    coordinate={[...stop.coordinate]}
                    anchor={{ x: 0.5, y: 1 }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Show completed event ${stop.title}`}
                      onPress={() => handleMarkerPress(stop)}
                      style={styles.markerTapArea}
                    >
                      <View style={styles.eventMarkerCompleted}>
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

        {tourStarted && locationStatusChecked && !currentLocation && !locationUnavailable ? (
          <View style={styles.locationLoadingOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color={COLORS.BUTTON_COLOR} />
            <Text style={styles.locationLoadingText}>Getting your current location…</Text>
          </View>
        ) : null}

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
                  onPress={async () => {
                    if (!selectedStopIsNearestPending) {
                      const nearestTitle = nearestPendingStop?.title || 'the nearest location';
                      showInfo(
                        'Nearest Stop Required',
                        `Please confirm ${nearestTitle} before this stop.`
                      );
                      return;
                    }

                    const coords = await prepareVerification(selectedStop.title, selectedStop.coordinate);
                    if (!coords) return;
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
              style={[
                styles.startTourBtn,
                isPausingTour && styles.startTourBtnLoading,
              ]}
              onPress={handlePauseTour}
              disabled={isPausingTour}
            >
              {isPausingTour ? (
                <View style={styles.pauseLoadingContent}>
                  <ActivityIndicator size="small" color={COLORS.WHITE} />
                  <Text style={[styles.btnText, { color: COLORS.WHITE }]}>
                    Pausing...
                  </Text>
                </View>
              ) : (
                <Text style={[styles.btnText, { color: COLORS.WHITE }]}>
                  Pause Tour
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <EventDetailModal
          visible={Boolean(selectedEvent) && !scanVisible && !eventDetailDismissing}
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDismiss={() => {
            // iOS fires this once the event modal has fully animated out — the
            // safe moment to present the scan modal without a presentation race.
            if (eventScanTimerRef.current) {
              clearTimeout(eventScanTimerRef.current);
              eventScanTimerRef.current = null;
            }
            if (pendingEventScanRef.current) {
              pendingEventScanRef.current = false;
              setScanVisible(true);
            }
          }}
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
              ? async () => {
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
                const eventCoordinate: [number, number] = [
                  Number(selectedEvent.coordinates?.longitude || 0),
                  Number(selectedEvent.coordinates?.latitude || 0),
                ];
                const coords = await prepareVerification(selectedEvent.title, eventCoordinate);
                if (!coords) return;
                setScanForEvent(true);
                setScanTargetEvent(selectedEvent);
                if (Platform.OS === 'ios') {
                  // iOS can't present the scan modal while the event modal is
                  // still on screen. Hide the event modal but keep it MOUNTED
                  // (don't null selectedEvent) so its dismissal completes
                  // cleanly — nulling it here unmounts the modal mid-dismiss
                  // and leaves iOS unable to present the next modal. The scan
                  // modal is then opened from whichever fires first: the native
                  // onDismiss callback, or this fallback timer.
                  pendingEventScanRef.current = true;
                  setEventDetailDismissing(true);
                  if (eventScanTimerRef.current) {
                    clearTimeout(eventScanTimerRef.current);
                  }
                  eventScanTimerRef.current = setTimeout(() => {
                    eventScanTimerRef.current = null;
                    if (pendingEventScanRef.current) {
                      pendingEventScanRef.current = false;
                      setScanVisible(true);
                    }
                  }, 500);
                } else {
                  setSelectedEvent(null);
                  setScanVisible(true);
                }
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

        <ScanVerifyModal
          visible={scanVisible}
          title={
            scanForEvent
              ? scanTargetEvent?.title || selectedEvent?.title || 'this event'
              : selectedStop?.title || 'this location'
          }
          successPoints={
            scanForEvent ? 0 : Number(selectedStop?.place?.points || 10)
          }
          onClose={() => {
            setScanVisible(false);
            setScanForEvent(false);
            pendingEventScanRef.current = false;
            setEventDetailDismissing(false);
            if (eventScanTimerRef.current) {
              clearTimeout(eventScanTimerRef.current);
              eventScanTimerRef.current = null;
            }
            if (scanForEvent) {
              setScanTargetEvent(null);
              setSelectedEvent(null);
            } else {
              setSelectedStop(null);
            }
          }}
          onScanSuccess={handleVisitVerification}
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
  locationLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(246, 242, 236, 0.58)',
    zIndex: 20,
  },
  locationLoadingText: {
    marginTop: 10,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILY.InterTight_Medium,
    fontSize: 14,
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
  eventMarkerCompleted: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#9AA3AF',
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
  startTourBtnLoading: {
    opacity: 0.8,
  },
  pauseLoadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
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
