/**
 * Backend side of active-tour location tracking.
 *
 * While a tour runs, the app writes `tours/{tourId}.tracking` (state +
 * heartbeat) and `tours/{tourId}/locations/*` (see the app's
 * src/services/tourTrackingService.ts and TourTrackingUploader.kt).
 *
 * This codebase:
 *  - finds active tours whose tracking heartbeat went stale and notifies the
 *    user via FCM, once per outage and with a cooldown;
 *  - deletes a tour's location history when the tour document is deleted.
 *
 * A stale heartbeat only means "tracking unavailable". The device may be
 * offline, the OS may have stopped the app, or the user may have closed it;
 * the platform does not tell these apart, so the alert asks the user to check.
 */
import { initializeApp } from 'firebase-admin/app';
import {
  DocumentReference,
  FieldValue,
  Timestamp,
  getFirestore,
} from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import * as logger from 'firebase-functions/logger';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

// Must be compatible with the Firestore database location, otherwise the
// onDocumentDeleted trigger cannot be deployed.
const FUNCTIONS_REGION = 'us-central1';

// Keep a few multiples of the app's heartbeat (src/constants/locationTracking.ts,
// heartbeatIntervalMs = 60 s). Three missed heartbeats are required, so one
// late update or a brief network drop never alerts the user.
const STALE_AFTER_MS = 3 * 60_000;
const CHECK_SCHEDULE = 'every 2 minutes';
// At most one alert per tour in this window, even if tracking flaps.
const ALERT_COOLDOWN_MS = 30 * 60_000;
// If the device stays unreachable longer than this, FCM drops the alert: by
// the time it reconnects the app has usually synced and resumed tracking.
const ALERT_TTL_MS = 15 * 60_000;
const MAX_TOURS_PER_RUN = 200;

const TOURS_COLLECTION = 'tours';
const USERS_COLLECTION = 'users';
const LOCATIONS_SUBCOLLECTION = 'locations';
const FCM_TOKENS_FIELD = 'fcmTokens';
const ALERT_TYPE = 'tour_tracking_unavailable';
// States in which the app is expected to keep sending heartbeats.
const LIVE_STATES = ['tracking', 'location_off'];
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

setGlobalOptions({ region: FUNCTIONS_REGION, maxInstances: 10 });
initializeApp();
const db = getFirestore();

type TrackingAlert = {
  tourId: string;
  userId: string;
  title: string;
  previousState: string;
};

const toMillis = (value: unknown): number | null =>
  value instanceof Timestamp ? value.toMillis() : null;

/**
 * Marks a stale tour as unavailable inside a transaction, so a heartbeat that
 * arrives while this runs wins. Returns the alert to send, if any.
 */
const markTrackingUnavailable = (
  ref: DocumentReference,
  now: number
): Promise<TrackingAlert | null> =>
  db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return null;

    const tour = snapshot.data() ?? {};
    const tracking = tour.tracking ?? {};
    if (!LIVE_STATES.includes(tracking.state)) return null;

    if (tour.status !== 'active') {
      // Paused/completed without a final tracking write (for example the app
      // was closed first). Stop matching this tour on every run.
      tx.update(ref, {
        'tracking.state': 'stopped',
        'tracking.stopReason': 'tour_not_active',
        'tracking.stoppedAt': FieldValue.serverTimestamp(),
      });
      return null;
    }

    const lastHeartbeat = toMillis(tracking.lastHeartbeatAt);
    if (lastHeartbeat !== null && now - lastHeartbeat < STALE_AFTER_MS) return null;

    const lastAlert = toMillis(tracking.lastAlertAt) ?? 0;
    const shouldAlert = now - lastAlert >= ALERT_COOLDOWN_MS;
    const update: Record<string, unknown> = {
      'tracking.state': 'unavailable',
      'tracking.previousState': tracking.state,
      'tracking.unavailableSince': FieldValue.serverTimestamp(),
    };
    if (shouldAlert) {
      update['tracking.lastAlertAt'] = FieldValue.serverTimestamp();
      update['tracking.alertCount'] = FieldValue.increment(1);
    }
    tx.update(ref, update);

    if (!shouldAlert || typeof tour.user_id !== 'string' || !tour.user_id) return null;
    return {
      tourId: ref.id,
      userId: tour.user_id,
      title: typeof tour.title === 'string' ? tour.title : '',
      previousState: tracking.state,
    };
  });

const sendTrackingAlert = async (alert: TrackingAlert) => {
  const userRef = db.collection(USERS_COLLECTION).doc(alert.userId);
  const userSnapshot = await userRef.get();
  const storedTokens: unknown = userSnapshot.get(FCM_TOKENS_FIELD);
  const tokens = Array.isArray(storedTokens)
    ? storedTokens.filter((token): token is string => typeof token === 'string' && token.length > 0)
    : [];
  if (tokens.length === 0) {
    logger.info('Tracking unavailable but user has no FCM token', {
      tourId: alert.tourId,
      userId: alert.userId,
    });
    return;
  }

  const tourName = alert.title ? `"${alert.title}"` : 'your tour';
  const body =
    alert.previousState === 'location_off'
      ? `Location seems to be turned off for ${tourName}. Turn it on and reopen Pride This Way to continue.`
      : `We haven't received your location for ${tourName} in a few minutes. Please reopen Pride This Way to check your tour.`;
  // Replaces an earlier alert for the same tour instead of stacking.
  const tag = `tour-tracking-${alert.tourId}`;

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title: 'Location tracking appears to have stopped',
      body,
    },
    data: { type: ALERT_TYPE, tourId: alert.tourId },
    android: {
      priority: 'high',
      ttl: ALERT_TTL_MS,
      collapseKey: tag,
      notification: { tag },
    },
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-expiration': String(Math.floor((Date.now() + ALERT_TTL_MS) / 1000)),
        'apns-collapse-id': tag,
      },
      payload: { aps: { sound: 'default' } },
    },
  });

  const invalidTokens = response.responses
    .map((result, index) =>
      !result.success && INVALID_TOKEN_CODES.has(result.error?.code ?? '') ? tokens[index] : null
    )
    .filter((token): token is string => token !== null);
  if (invalidTokens.length > 0) {
    await userRef.update({ [FCM_TOKENS_FIELD]: FieldValue.arrayRemove(...invalidTokens) });
  }

  logger.info('Tracking alert sent', {
    tourId: alert.tourId,
    userId: alert.userId,
    delivered: response.successCount,
    failed: response.failureCount,
  });
};

export const checkStaleTourTracking = onSchedule(
  { schedule: CHECK_SCHEDULE, timeZone: 'Etc/UTC', retryCount: 0, timeoutSeconds: 120 },
  async () => {
    const now = Date.now();
    const stale = await db
      .collection(TOURS_COLLECTION)
      .where('tracking.state', 'in', LIVE_STATES)
      .where('tracking.lastHeartbeatAt', '<=', Timestamp.fromMillis(now - STALE_AFTER_MS))
      .limit(MAX_TOURS_PER_RUN)
      .get();
    if (stale.empty) return;

    const results = await Promise.allSettled(
      stale.docs.map(async (doc) => {
        const alert = await markTrackingUnavailable(doc.ref, now);
        if (alert) await sendTrackingAlert(alert);
      })
    );
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error('Stale tracking check failed', {
          tourId: stale.docs[index].id,
          error: String(result.reason),
        });
      }
    });
  }
);

export const deleteTourLocationHistory = onDocumentDeleted(
  `${TOURS_COLLECTION}/{tourId}`,
  async (event) => {
    await db.recursiveDelete(
      db.collection(TOURS_COLLECTION).doc(event.params.tourId).collection(LOCATIONS_SUBCOLLECTION)
    );
  }
);
