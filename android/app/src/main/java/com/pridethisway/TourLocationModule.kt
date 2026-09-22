package com.pridethisway

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class TourLocationModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private val mainHandler = Handler(Looper.getMainLooper())

  private val receiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action != TourLocationService.EVENT_ACTION) return

      val payload = Arguments.createMap()
      payload.putString("type", intent.getStringExtra("type") ?: "update")
      payload.putBoolean("locationEnabled", intent.getBooleanExtra("locationEnabled", true))
      if (intent.hasExtra("latitude")) {
        payload.putDouble("latitude", intent.getDoubleExtra("latitude", 0.0))
        payload.putDouble("longitude", intent.getDoubleExtra("longitude", 0.0))
        payload.putDouble("accuracy", intent.getDoubleExtra("accuracy", 0.0))
        payload.putDouble("speed", intent.getDoubleExtra("speed", -1.0))
        payload.putDouble("timestamp", intent.getLongExtra("timestamp", 0L).toDouble())
      }

      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(TourLocationService.JS_EVENT, payload)
    }
  }

  init {
    val filter = IntentFilter(TourLocationService.EVENT_ACTION)
    if (Build.VERSION.SDK_INT >= 33) {
      reactContext.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      reactContext.registerReceiver(receiver, filter)
    }
  }

  override fun getName(): String = "TourLocation"

  @ReactMethod
  fun startTracking(promise: Promise) {
    try {
      val intent = Intent(reactContext, TourLocationService::class.java)
        .setAction(TourLocationService.ACTION_START)
      ContextCompat.startForegroundService(reactContext, intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("TOUR_LOCATION_START_FAILED", error)
    }
  }

  @ReactMethod
  fun stopTracking(promise: Promise) {
    try {
      val intent = Intent(reactContext, TourLocationService::class.java)
        .setAction(TourLocationService.ACTION_STOP)
      reactContext.startService(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("TOUR_LOCATION_STOP_FAILED", error)
    }
  }

  @ReactMethod
  fun setActiveTourId(tourId: String?, promise: Promise) {
    try {
      reactContext
        .getSharedPreferences(TourLocationService.PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .apply {
          if (tourId.isNullOrBlank()) {
            remove("activeTourId")
          } else {
            putString("activeTourId", tourId)
          }
        }
        .apply()
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("TOUR_LOCATION_ID_FAILED", error)
    }
  }

  @ReactMethod
  fun setNotificationDestination(
    destinationId: String?,
    latitude: Double,
    longitude: Double,
    title: String?,
    promise: Promise,
  ) {
    try {
      val preferences = reactContext.getSharedPreferences(
        TourLocationService.PREFS_NAME,
        Context.MODE_PRIVATE,
      )
      val previousId = preferences.getString("notificationDestinationId", null)
      preferences.edit()
        .putString("notificationDestinationId", destinationId.orEmpty())
        .putString("notificationDestinationLatitude", latitude.toString())
        .putString("notificationDestinationLongitude", longitude.toString())
        .putString("notificationDestinationTitle", title.orEmpty())
        .putBoolean(
          "notificationDestinationEntered",
          previousId == destinationId && preferences.getBoolean("notificationDestinationEntered", false),
        )
        .apply()
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("TOUR_DESTINATION_NOTIFICATION_FAILED", error)
    }
  }

  @ReactMethod
  fun clearNotificationDestination(promise: Promise) {
    try {
      reactContext
        .getSharedPreferences(TourLocationService.PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .remove("notificationDestinationId")
        .remove("notificationDestinationLatitude")
        .remove("notificationDestinationLongitude")
        .remove("notificationDestinationTitle")
        .remove("notificationDestinationEntered")
        .apply()
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("TOUR_DESTINATION_NOTIFICATION_CLEAR_FAILED", error)
    }
  }

  @ReactMethod
  fun clearTaskRemovalState(promise: Promise) {
    try {
      reactContext
        .getSharedPreferences(TourLocationService.PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putBoolean("taskRemovedWhileTracking", false)
        .remove("taskRemovedAt")
        .remove("taskRemovedTourId")
        .apply()
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("TOUR_LOCATION_CLEAR_TASK_REMOVAL_FAILED", error)
    }
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences(TourLocationService.PREFS_NAME, Context.MODE_PRIVATE)
      val result = Arguments.createMap()
      result.putBoolean("tracking", prefs.getBoolean("tracking", false))
      result.putBoolean("locationEnabled", TourLocationService.isLocationEnabled(reactContext))
      result.putBoolean(
        "taskRemovedWhileTracking",
        prefs.getBoolean("taskRemovedWhileTracking", false),
      )
      result.putDouble("taskRemovedAt", prefs.getLong("taskRemovedAt", 0L).toDouble())
      prefs.getString("taskRemovedTourId", null)?.let {
        result.putString("taskRemovedTourId", it)
      }
      if (prefs.contains("latitude_e6") && prefs.contains("longitude_e6")) {
        result.putDouble("latitude", prefs.getLong("latitude_e6", 0L).toDouble() / 1_000_000.0)
        result.putDouble("longitude", prefs.getLong("longitude_e6", 0L).toDouble() / 1_000_000.0)
        result.putDouble("accuracy", prefs.getFloat("accuracy", 0f).toDouble())
        result.putDouble("speed", prefs.getFloat("speed", -1f).toDouble())
        result.putDouble("timestamp", prefs.getLong("timestamp", 0L).toDouble())
      }
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("TOUR_LOCATION_STATUS_FAILED", error)
    }
  }

  @ReactMethod
  fun getRecentLocations(sinceTimestamp: Double, promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences(TourLocationService.PREFS_NAME, Context.MODE_PRIVATE)
      val points = org.json.JSONArray(prefs.getString(TourLocationService.TRACE_POINTS_KEY, "[]") ?: "[]")
      val result = Arguments.createArray()
      for (index in 0 until points.length()) {
        val point = points.optJSONObject(index) ?: continue
        val timestamp = point.optLong("timestamp", 0L)
        if (timestamp <= sinceTimestamp.toLong()) continue
        val latitude = point.optDouble("latitude", Double.NaN)
        val longitude = point.optDouble("longitude", Double.NaN)
        if (!latitude.isFinite() || !longitude.isFinite()) continue
        val item = Arguments.createMap()
        item.putDouble("latitude", latitude)
        item.putDouble("longitude", longitude)
        item.putDouble("accuracy", point.optDouble("accuracy", 0.0))
        item.putDouble("speed", point.optDouble("speed", -1.0))
        item.putDouble("timestamp", timestamp.toDouble())
        result.pushMap(item)
      }
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("TOUR_LOCATION_HISTORY_FAILED", error)
    }
  }

  @ReactMethod
  fun startTrackingSession(options: ReadableMap, promise: Promise) {
    val tourId = options.stringOrNull("tourId")
    val userId = options.stringOrNull("userId")
    if (tourId.isNullOrBlank() || userId.isNullOrBlank()) {
      promise.reject("TOUR_TRACKING_INVALID_SESSION", "tourId and userId are required")
      return
    }

    val session = TourTrackingUploader.Session(
      tourId = tourId,
      userId = userId,
      sampleIntervalMs = options.doubleOr("sampleIntervalMs", 15_000.0).toLong(),
      sampleMinDistanceMeters = options.doubleOr("sampleMinDistanceMeters", 20.0).toFloat(),
      heartbeatIntervalMs = options.doubleOr("heartbeatIntervalMs", 60_000.0).toLong(),
      maxAccuracyMeters = options.doubleOr("maxAccuracyMeters", 100.0).toFloat(),
      backgroundGpsIntervalMs = options.doubleOr("backgroundGpsIntervalMs", 10_000.0).toLong(),
      backgroundGpsMinDistanceMeters = options.doubleOr("backgroundGpsMinDistanceMeters", 0.0).toFloat(),
    )
    // TourTrackingUploader is main-thread only (see its class comment).
    mainHandler.post {
      try {
        TourTrackingUploader.startSession(reactContext.applicationContext, session)
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("TOUR_TRACKING_START_FAILED", error)
      }
    }
  }

  @ReactMethod
  fun stopTrackingSession(reason: String, promise: Promise) {
    mainHandler.post {
      try {
        TourTrackingUploader.stopSession(reactContext.applicationContext, reason)
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("TOUR_TRACKING_STOP_FAILED", error)
      }
    }
  }

  private fun ReadableMap.stringOrNull(key: String): String? =
    if (hasKey(key) && !isNull(key)) getString(key) else null

  private fun ReadableMap.doubleOr(key: String, fallback: Double): Double =
    if (hasKey(key) && !isNull(key)) getDouble(key) else fallback

  override fun onCatalystInstanceDestroy() {
    try {
      reactContext.unregisterReceiver(receiver)
    } catch (_: Exception) {
      // Receiver may already have been unregistered during process teardown.
    }
    super.onCatalystInstanceDestroy()
  }
}
