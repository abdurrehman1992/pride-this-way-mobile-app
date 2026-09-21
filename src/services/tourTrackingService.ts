import { Platform } from 'react-native';
import Geolocation, {
  GeolocationError,
  GeolocationResponse,
} from '@react-native-community/geolocation';
import NetInfo from '@react-native-community/netinfo';
import firestore from '@react-native-firebase/firestore';
import { TOUR_TRACKING_CONFIG } from '../constants/locationTracking';
import { distanceMetersBetween } from '../utils/routeProgress';
import {
  isNativeTrackingAvailable,
  startNativeTrackingSession,
  stopNativeTourLocation,
  stopNativeTrackingSession,
} from '../utils/nativeTourLocation';
import { requestPushPermission } from './pushNotificationService';

/**
 * Active-tour location tracking (Firestore upload).
 *
 * Android: the native foreground service uploads (TourTrackingUploader.kt), so
 * it keeps working while the screen is locked or JS is suspended. Closing the
 * app from Recents stops tracking and notifies the user (TourLocationService).
 * iOS: this module uploads while the app runs in the foreground or, with
 * background location updates, in the background. iOS stops it when the user
 * force-quits the app; the backend then notices the stale heartbeat.
 *
 * Firestore layout:
 *   tours/{tourId}.tracking            state + heartbeat (read by the backend)
 *   tours/{tourId}/locations/{autoId}  throttled location history
 *
 * Writes are never awaited: Firestore queues them on disk while offline and
 * syncs them in order when the connection returns.
 */

export type TourTrackingStopReason = 'paused' | 'completed' | 'ended' | 'signed_out';
type StopReason = TourTrackingStopReason | 'superseded';

type Session = { tourId: string; userId: string };

const TOURS_COLLECTION = 'tours';
const LOCATIONS_SUBCOLLECTION = 'locations';
const HEARTBEAT_CHECK_MS = 5_000;
// A cached fix older than this is not reported as the current position.
const MAX_FIX_AGE_MS = 30_000;
const PERMISSION_DENIED = 1;

// What the tour screen asked for. tourId is null for a brand-new tour whose
// document MyTour is still creating; it is then resolved from the user's
// active tour (handleActiveTourIds).
let requested: { userId: string; tourId: string | null } | null = null;
// False once the tour screen unmounted. The tour keeps running, but the
// screen can no longer react when it ends elsewhere, so this module does.
let screenAttached = false;
let session: Session | null = null;
let activeTourIds: string[] = [];
let queue: Promise<void> = Promise.resolve();

// Start/stop requests come from screen effects, the active-tour listener and
// logout; run them strictly one after another.
const enqueue = (task: () => Promise<void>) => {
  queue = queue.then(task).catch(() => undefined);
  return queue;
};

const serverTimestamp = () => firestore.FieldValue.serverTimestamp();

const stoppedFields = (reason: StopReason) => ({
  'tracking.state': reason === 'paused' ? 'paused' : 'stopped',
  'tracking.stopReason': reason,
  'tracking.stoppedAt': serverTimestamp(),
});

// ---------------------------------------------------------------------------
// JS uploader (iOS, and Android builds without the native uploader)
// ---------------------------------------------------------------------------

type JsUpload = {
  session: Session;
  watchId: number | null;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  unsubscribeNetInfo: (() => void) | null;
  networkAvailable: boolean;
  lastSample: { coordinate: [number, number]; at: number } | null;
  lastFix: { latitude: number; longitude: number; accuracy: number; at: number } | null;
  lastHeartbeatAt: number;
  locationOff: boolean;
};

let jsUpload: JsUpload | null = null;

const tourRef = (tourId: string) => firestore().collection(TOURS_COLLECTION).doc(tourId);

const updateTracking = (upload: JsUpload, data: Record<string, unknown>) => {
  // update(), not set(merge): a late write must never recreate a deleted tour.
  tourRef(upload.session.tourId)
    .update(data)
    .catch((error: { code?: string }) => {
      if (error?.code !== 'firestore/not-found') return;
      const deletedTourId = upload.session.tourId;
      enqueue(async () => {
        if (session?.tourId === deletedTourId) {
          await switchSession(null, 'ended');
        }
      });
    });
};

const sendHeartbeat = (upload: JsUpload, now: number) => {
  upload.lastHeartbeatAt = now;
  const data: Record<string, unknown> = {
    'tracking.state': 'tracking',
    'tracking.platform': Platform.OS,
    'tracking.lastHeartbeatAt': serverTimestamp(),
    'tracking.networkAvailable': upload.networkAvailable,
    'tracking.unavailableReason': firestore.FieldValue.delete(),
  };
  if (upload.lastFix) {
    const recordedAt = firestore.Timestamp.fromMillis(upload.lastFix.at);
    data['tracking.lastLocation'] = {
      latitude: upload.lastFix.latitude,
      longitude: upload.lastFix.longitude,
      accuracy: upload.lastFix.accuracy,
      recordedAt,
    };
    data['tracking.lastLocationAt'] = recordedAt;
  }
  updateTracking(upload, data);
};

const addLocation = (upload: JsUpload, position: GeolocationResponse, recordedAtMs: number) => {
  const { latitude, longitude, accuracy, speed, heading } = position.coords;
  const data: Record<string, unknown> = {
    userId: upload.session.userId,
    tourId: upload.session.tourId,
    latitude,
    longitude,
    accuracy,
    recordedAt: firestore.Timestamp.fromMillis(recordedAtMs),
    receivedAt: serverTimestamp(),
    networkAvailable: upload.networkAvailable,
    platform: Platform.OS,
  };
  if (typeof speed === 'number' && speed >= 0) data.speed = speed;
  if (typeof heading === 'number' && heading >= 0) data.heading = heading;

  tourRef(upload.session.tourId)
    .collection(LOCATIONS_SUBCOLLECTION)
    .add(data)
    .catch(() => undefined);
};

const handleFix = (upload: JsUpload, position: GeolocationResponse) => {
  if (jsUpload !== upload) return;
  const { latitude, longitude, accuracy } = position.coords;
  const now = Date.now();
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy)) return;
  if (Number.isFinite(position.timestamp) && now - position.timestamp > MAX_FIX_AGE_MS) return;

  upload.lastFix = { latitude, longitude, accuracy, at: now };
  const recovered = upload.locationOff;
  upload.locationOff = false;

  const coordinate: [number, number] = [longitude, latitude];
  const previous = upload.lastSample;
  const dueForSample =
    !previous ||
    (now - previous.at >= TOUR_TRACKING_CONFIG.sampleIntervalMs &&
      distanceMetersBetween(previous.coordinate, coordinate) >=
        TOUR_TRACKING_CONFIG.sampleMinDistanceMeters);
  if (accuracy <= TOUR_TRACKING_CONFIG.maxAccuracyMeters && dueForSample) {
    upload.lastSample = { coordinate, at: now };
    addLocation(upload, position, now);
  }

  if (recovered || now - upload.lastHeartbeatAt >= TOUR_TRACKING_CONFIG.heartbeatIntervalMs) {
    sendHeartbeat(upload, now);
  }
};

const handleWatchError = (upload: JsUpload, error: GeolocationError) => {
  if (jsUpload !== upload || error?.code !== PERMISSION_DENIED || upload.locationOff) return;
  upload.locationOff = true;
  // Deliberately no heartbeat: if location stays off, the backend grace
  // period expires and the user is notified.
  updateTracking(upload, {
    'tracking.state': 'location_off',
    'tracking.unavailableReason': 'location_disabled',
    'tracking.locationOffAt': serverTimestamp(),
  });
};

const tick = (upload: JsUpload) => {
  if (jsUpload !== upload || upload.locationOff) return;
  const now = Date.now();
  if (now - upload.lastHeartbeatAt >= TOUR_TRACKING_CONFIG.heartbeatIntervalMs) {
    sendHeartbeat(upload, now);
  }
};

const startJsUpload = (next: Session) => {
  const upload: JsUpload = {
    session: next,
    watchId: null,
    heartbeatTimer: null,
    unsubscribeNetInfo: null,
    networkAvailable: true,
    lastSample: null,
    lastFix: null,
    lastHeartbeatAt: Date.now(),
    locationOff: false,
  };
  jsUpload = upload;

  if (Platform.OS === 'ios') {
    // Keep receiving updates while the app is in the background (needs the
    // "location" UIBackgroundMode). The tour start flow already requested
    // permission, so the module must not ask again.
    Geolocation.setRNConfiguration({
      skipPermissionRequests: true,
      authorizationLevel: 'whenInUse',
      enableBackgroundLocationUpdates: true,
    });
    // The background flag is applied when the native module (re)starts
    // location updates; a fresh one-off request makes it do that even if the
    // tour screen's watcher is already running.
    Geolocation.getCurrentPosition(
      () => undefined,
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 }
    );
  }

  // Same options as the tour screen's watcher: the first active watcher's
  // options apply to all of them.
  upload.watchId = Geolocation.watchPosition(
    (position) => handleFix(upload, position),
    (error) => handleWatchError(upload, error),
    {
      enableHighAccuracy: true,
      distanceFilter: 1,
      maximumAge: 0,
      timeout: 15_000,
      interval: 1_000,
      fastestInterval: 500,
    }
  );
  upload.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    upload.networkAvailable = state.isConnected === true && state.isInternetReachable !== false;
  });
  upload.heartbeatTimer = setInterval(() => tick(upload), HEARTBEAT_CHECK_MS);

  // lastHeartbeatAt must exist from the start: the backend stale query only
  // matches tours that have it, even if no fix ever arrives.
  updateTracking(upload, {
    'tracking.state': 'tracking',
    'tracking.platform': Platform.OS,
    'tracking.sessionStartedAt': serverTimestamp(),
    'tracking.lastHeartbeatAt': serverTimestamp(),
    'tracking.unavailableReason': firestore.FieldValue.delete(),
    // A running session has no stop reason; replace the previous one.
    'tracking.stopReason': 'none',
    'tracking.stoppedAt': firestore.FieldValue.delete(),
  });
};

const stopJsUpload = (previous: Session, reason: StopReason) => {
  const upload = jsUpload;
  if (!upload || upload.session.tourId !== previous.tourId) return;
  jsUpload = null;

  if (upload.watchId !== null) Geolocation.clearWatch(upload.watchId);
  if (upload.heartbeatTimer) clearInterval(upload.heartbeatTimer);
  upload.unsubscribeNetInfo?.();
  if (Platform.OS === 'ios') {
    Geolocation.setRNConfiguration({
      skipPermissionRequests: false,
      enableBackgroundLocationUpdates: false,
    });
  }
  updateTracking(upload, stoppedFields(reason));
};

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

const startUpload = async (next: Session) => {
  if (!isNativeTrackingAvailable) {
    startJsUpload(next);
    return;
  }
  await startNativeTrackingSession({ ...next, ...TOUR_TRACKING_CONFIG });
};

const stopUpload = async (previous: Session, reason: StopReason) => {
  if (!isNativeTrackingAvailable) {
    stopJsUpload(previous, reason);
    return;
  }
  await stopNativeTrackingSession(reason);
};

const switchSession = async (next: Session | null, reason: TourTrackingStopReason) => {
  const previous = session;
  if (previous?.tourId === next?.tourId && previous?.userId === next?.userId) {
    // Re-applying the same session is cheap and repairs native state after a
    // JS reload or an app relaunch (the native service keeps its own copy).
    if (next) await startUpload(next);
    return;
  }

  session = next;
  if (previous) await stopUpload(previous, next ? 'superseded' : reason);
  if (next) await startUpload(next);
};

const reconcile = (reason: TourTrackingStopReason) =>
  enqueue(async () => {
    if (!requested) {
      if (session) await switchSession(null, reason);
      return;
    }
    const tourId = requested.tourId ?? activeTourIds[0] ?? null;
    // Keep the current session until the tour's document id is known.
    if (!tourId) return;
    if (session?.tourId === tourId && session.userId === requested.userId) return;
    await switchSession({ tourId, userId: requested.userId }, reason);
  });

/** Called by the tour screen while its tour is running. Idempotent. */
export const startTourTracking = ({
  userId,
  tourId,
}: {
  userId: string;
  tourId: string | null;
}) => {
  const isNewRequest =
    requested?.userId !== userId || requested?.tourId !== tourId || !screenAttached;
  requested = { userId, tourId };
  screenAttached = true;
  if (isNewRequest) {
    requestPushPermission().catch(() => undefined);
  }
  return enqueue(async () => {
    const resolvedTourId = tourId ?? activeTourIds[0] ?? null;
    if (!resolvedTourId) return;
    await switchSession({ tourId: resolvedTourId, userId }, 'paused');
  });
};

export const stopTourTracking = (reason: TourTrackingStopReason) => {
  requested = null;
  return reconcile(reason);
};

/**
 * Sign-out: stop tracking even if this JS runtime never started the session
 * (the native service keeps its session across app restarts).
 */
export const stopTourTrackingForSignOut = () => {
  requested = null;
  return enqueue(async () => {
    if (session) {
      await switchSession(null, 'signed_out');
    } else if (isNativeTrackingAvailable) {
      await stopNativeTrackingSession('signed_out');
    }
  });
};

/** The tour keeps running when its screen unmounts; see screenAttached. */
export const onTourScreenUnmounted = () => {
  screenAttached = false;
};

/** Fed by the user's active-tour listener (server-confirmed snapshots only). */
export const handleActiveTourIds = (tourIds: string[]) => {
  const wasActive = activeTourIds;
  activeTourIds = tourIds;

  const current = session;
  const endedElsewhere =
    current !== null &&
    !screenAttached &&
    wasActive.includes(current.tourId) &&
    !tourIds.includes(current.tourId);
  if (endedElsewhere) {
    // Completed, paused or deleted outside the tour screen (for example
    // "End Tour" in the tour list). Stop the GPS service too.
    requested = null;
    return enqueue(async () => {
      if (session?.tourId !== current.tourId) return;
      await switchSession(null, 'ended');
      await stopNativeTourLocation();
    });
  }

  // Resolves a brand-new tour's id, or follows the tour document the screen
  // is really saving to.
  return reconcile('paused');
};
