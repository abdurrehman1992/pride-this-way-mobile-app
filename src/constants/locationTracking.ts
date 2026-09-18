// Tuning for active-tour location tracking (Firestore upload).
// Android passes these values to the native foreground service; iOS uses them
// in the JS tracker. The backend grace period in functions/src/index.ts
// (STALE_AFTER_MS) must stay a few multiples of heartbeatIntervalMs.
export const TOUR_TRACKING_CONFIG = {
  // Minimum time between two saved location points.
  sampleIntervalMs: 15_000,
  // Minimum movement between two saved location points, so a user standing
  // still does not produce a new history document every interval.
  sampleMinDistanceMeters: 20,
  // Liveness update on the tour document. Sent even without movement so the
  // backend can tell "standing still" apart from "tracking stopped".
  heartbeatIntervalMs: 60_000,
  // Fixes less accurate than this are not saved as history points.
  maxAccuracyMeters: 100,
  // Android GPS request while the tour UI is not visible (screen locked or app
  // in background). While the tour screen is visible the existing 1 s / 1 m
  // navigation rate is kept. Closing the app from Recents stops tracking.
  backgroundGpsIntervalMs: 2_000,
  backgroundGpsMinDistanceMeters: 0,
} as const;
