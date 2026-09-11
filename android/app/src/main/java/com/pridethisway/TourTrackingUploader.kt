package com.pridethisway

import android.content.Context
import android.location.Location
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.util.Log
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import java.util.Date

/**
 * Saves the active tour's location to Firestore from native code, so tracking
 * keeps working while the screen is locked or the JS runtime is suspended in
 * the background. Closing the app from Recents ends the session
 * (TourLocationService.onTaskRemoved).
 *
 * Firestore layout, shared with the JS tracker in tourTrackingService.ts:
 *   tours/{tourId}.tracking            live state + heartbeat read by the backend
 *   tours/{tourId}/locations/{autoId}  throttled location history
 *
 * Every function must run on the main thread. Location callbacks already do
 * and TourLocationModule posts its calls there, so Firestore receives the
 * mutations in event order and a final "stopped" write can never be overtaken
 * by a late location write.
 *
 * Offline: Firestore's persistent write queue keeps unsent mutations on disk
 * and sends them in order once the network returns, even after a process
 * restart, so no separate local queue is needed.
 *
 * Sign-out always clears the session first (stopTourTrackingForSignOut in
 * tourTrackingService.ts), so writes are made as the tour's owner.
 */
object TourTrackingUploader {
  data class Session(
    val tourId: String,
    val userId: String,
    val sampleIntervalMs: Long,
    val sampleMinDistanceMeters: Float,
    val heartbeatIntervalMs: Long,
    val maxAccuracyMeters: Float,
    val backgroundGpsIntervalMs: Long,
    val backgroundGpsMinDistanceMeters: Float,
  )

  private const val TAG = "TourTracking"
  private const val PREFS_NAME = "tour_tracking_session"
  private const val TOURS_COLLECTION = "tours"
  private const val LOCATIONS_COLLECTION = "locations"

  private const val DEFAULT_SAMPLE_INTERVAL_MS = 15_000L
  private const val DEFAULT_SAMPLE_MIN_DISTANCE_METERS = 20f
  private const val DEFAULT_HEARTBEAT_INTERVAL_MS = 60_000L
  private const val DEFAULT_MAX_ACCURACY_METERS = 100f
  private const val DEFAULT_BACKGROUND_GPS_INTERVAL_MS = 10_000L
  private const val DEFAULT_BACKGROUND_GPS_MIN_DISTANCE_METERS = 0f

  private var sessionLoaded = false
  private var session: Session? = null
  private var lastSample: Location? = null
  private var lastSampleAt = 0L
  private var lastFix: Location? = null
  private var lastFixAt = 0L
  private var lastHeartbeatAt = 0L
  private var locationOffReported = false

  fun startSession(context: Context, next: Session) {
    val current = currentSession(context)
    val isNewSession =
      current == null || current.tourId != next.tourId || current.userId != next.userId
    if (current != null && isNewSession) {
      writeStopped(context, current, "superseded")
    }

    session = next
    saveSession(context, next)
    if (isNewSession) {
      lastSample = null
      lastSampleAt = 0L
      lastFix = null
      lastFixAt = 0L
    }
    locationOffReported = false
    lastHeartbeatAt = System.currentTimeMillis()

    // lastHeartbeatAt must exist from the start: the backend stale query only
    // matches tours that have it, even if no fix ever arrives.
    val data = mutableMapOf<String, Any>(
      "tracking.state" to "tracking",
      "tracking.platform" to "android",
      "tracking.lastHeartbeatAt" to FieldValue.serverTimestamp(),
      "tracking.unavailableReason" to FieldValue.delete(),
      // A running session has no stop reason; replace the previous one.
      "tracking.stopReason" to "none",
      "tracking.stoppedAt" to FieldValue.delete(),
    )
    if (isNewSession) {
      data["tracking.sessionStartedAt"] = FieldValue.serverTimestamp()
    }
    updateTracking(context, next, data)
  }

  fun stopSession(context: Context, reason: String) {
    val current = currentSession(context) ?: return
    writeStopped(context, current, reason)
    clearSession(context)
  }

  fun onLocation(context: Context, location: Location) {
    val active = currentSession(context) ?: return
    val now = System.currentTimeMillis()
    lastFix = location
    lastFixAt = now
    val recovered = locationOffReported
    locationOffReported = false

    if (location.accuracy <= active.maxAccuracyMeters && shouldSample(active, location, now)) {
      lastSample = location
      lastSampleAt = now
      addLocation(context, active, location, now)
    }
    if (recovered || now - lastHeartbeatAt >= active.heartbeatIntervalMs) {
      heartbeat(context, active, now)
    }
  }

  /** Called every few seconds by the service, whether or not a new fix arrived. */
  fun onTick(context: Context, locationEnabled: Boolean) {
    val active = currentSession(context) ?: return
    if (!locationEnabled) {
      onLocationUnavailable(context)
      return
    }
    val now = System.currentTimeMillis()
    if (locationOffReported || now - lastHeartbeatAt >= active.heartbeatIntervalMs) {
      locationOffReported = false
      heartbeat(context, active, now)
    }
  }

  fun onLocationUnavailable(context: Context) {
    val active = currentSession(context) ?: return
    if (locationOffReported) return
    locationOffReported = true
    // Deliberately no heartbeat: if Location stays off, the backend grace
    // period expires and the user is notified.
    updateTracking(
      context,
      active,
      mapOf(
        "tracking.state" to "location_off",
        "tracking.unavailableReason" to "location_disabled",
        "tracking.locationOffAt" to FieldValue.serverTimestamp(),
      ),
    )
  }

  /** GPS request used by the service while the tour UI is not visible. */
  fun backgroundGpsRequest(context: Context): Pair<Long, Float> {
    val active = currentSession(context)
    return (active?.backgroundGpsIntervalMs ?: DEFAULT_BACKGROUND_GPS_INTERVAL_MS) to
      (active?.backgroundGpsMinDistanceMeters ?: DEFAULT_BACKGROUND_GPS_MIN_DISTANCE_METERS)
  }

  private fun shouldSample(active: Session, location: Location, now: Long): Boolean {
    val previous = lastSample ?: return true
    if (now - lastSampleAt < active.sampleIntervalMs) return false
    return previous.distanceTo(location) >= active.sampleMinDistanceMeters
  }

  private fun heartbeat(context: Context, active: Session, now: Long) {
    lastHeartbeatAt = now
    val data = mutableMapOf<String, Any>(
      "tracking.state" to "tracking",
      "tracking.platform" to "android",
      "tracking.lastHeartbeatAt" to FieldValue.serverTimestamp(),
      "tracking.networkAvailable" to isNetworkAvailable(context),
      "tracking.unavailableReason" to FieldValue.delete(),
    )
    lastFix?.let { fix ->
      val recordedAt = Timestamp(Date(lastFixAt))
      data["tracking.lastLocation"] = mapOf(
        "latitude" to fix.latitude,
        "longitude" to fix.longitude,
        "accuracy" to fix.accuracy.toDouble(),
        "recordedAt" to recordedAt,
      )
      data["tracking.lastLocationAt"] = recordedAt
    }
    updateTracking(context, active, data)
  }

  private fun addLocation(context: Context, active: Session, location: Location, recordedAtMs: Long) {
    val data = hashMapOf<String, Any>(
      "userId" to active.userId,
      "tourId" to active.tourId,
      "latitude" to location.latitude,
      "longitude" to location.longitude,
      "accuracy" to location.accuracy.toDouble(),
      "recordedAt" to Timestamp(Date(recordedAtMs)),
      "receivedAt" to FieldValue.serverTimestamp(),
      "networkAvailable" to isNetworkAvailable(context),
      "platform" to "android",
    )
    if (location.hasSpeed()) data["speed"] = location.speed.toDouble()
    if (location.hasBearing()) data["heading"] = location.bearing.toDouble()

    FirebaseFirestore.getInstance()
      .collection(TOURS_COLLECTION)
      .document(active.tourId)
      .collection(LOCATIONS_COLLECTION)
      .add(data)
      .addOnFailureListener { error ->
        Log.w(TAG, "Location point for tour ${active.tourId} was not saved", error)
      }
  }

  private fun writeStopped(context: Context, active: Session, reason: String) {
    updateTracking(
      context,
      active,
      mapOf(
        "tracking.state" to if (reason == "paused") "paused" else "stopped",
        "tracking.stopReason" to reason,
        "tracking.stoppedAt" to FieldValue.serverTimestamp(),
      ),
    )
  }

  private fun updateTracking(context: Context, active: Session, data: Map<String, Any>) {
    val appContext = context.applicationContext
    FirebaseFirestore.getInstance()
      .collection(TOURS_COLLECTION)
      .document(active.tourId)
      // update(), not set(merge): a late write must never recreate a deleted
      // tour document.
      .update(data)
      .addOnFailureListener { error ->
        Log.w(TAG, "Tracking status for tour ${active.tourId} was not saved", error)
        val code = (error as? FirebaseFirestoreException)?.code
        if (code == FirebaseFirestoreException.Code.NOT_FOUND && session?.tourId == active.tourId) {
          clearSession(appContext)
        }
      }
  }

  private fun isNetworkAvailable(context: Context): Boolean {
    val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
      ?: return false
    return try {
      val capabilities = manager.getNetworkCapabilities(manager.activeNetwork) ?: return false
      capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
        capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    } catch (_: Exception) {
      false
    }
  }

  private fun currentSession(context: Context): Session? {
    if (!sessionLoaded) {
      session = readSession(context)
      sessionLoaded = true
    }
    return session
  }

  private fun readSession(context: Context): Session? {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val tourId = prefs.getString("tourId", null) ?: return null
    val userId = prefs.getString("userId", null) ?: return null
    return Session(
      tourId = tourId,
      userId = userId,
      sampleIntervalMs = prefs.getLong("sampleIntervalMs", DEFAULT_SAMPLE_INTERVAL_MS),
      sampleMinDistanceMeters = prefs.getFloat("sampleMinDistanceMeters", DEFAULT_SAMPLE_MIN_DISTANCE_METERS),
      heartbeatIntervalMs = prefs.getLong("heartbeatIntervalMs", DEFAULT_HEARTBEAT_INTERVAL_MS),
      maxAccuracyMeters = prefs.getFloat("maxAccuracyMeters", DEFAULT_MAX_ACCURACY_METERS),
      backgroundGpsIntervalMs = prefs.getLong("backgroundGpsIntervalMs", DEFAULT_BACKGROUND_GPS_INTERVAL_MS),
      backgroundGpsMinDistanceMeters =
        prefs.getFloat("backgroundGpsMinDistanceMeters", DEFAULT_BACKGROUND_GPS_MIN_DISTANCE_METERS),
    )
  }

  private fun saveSession(context: Context, value: Session) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
      .putString("tourId", value.tourId)
      .putString("userId", value.userId)
      .putLong("sampleIntervalMs", value.sampleIntervalMs)
      .putFloat("sampleMinDistanceMeters", value.sampleMinDistanceMeters)
      .putLong("heartbeatIntervalMs", value.heartbeatIntervalMs)
      .putFloat("maxAccuracyMeters", value.maxAccuracyMeters)
      .putLong("backgroundGpsIntervalMs", value.backgroundGpsIntervalMs)
      .putFloat("backgroundGpsMinDistanceMeters", value.backgroundGpsMinDistanceMeters)
      .apply()
  }

  private fun clearSession(context: Context) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply()
    session = null
    sessionLoaded = true
    lastSample = null
    lastSampleAt = 0L
    lastFix = null
    lastFixAt = 0L
    locationOffReported = false
  }
}
