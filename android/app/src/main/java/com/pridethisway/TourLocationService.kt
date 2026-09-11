package com.pridethisway

import android.Manifest
import android.app.Activity
import android.app.Application
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.util.Log
import androidx.core.content.ContextCompat

class TourLocationService : Service() {

  private lateinit var locationManager: LocationManager
  private val handler = Handler(Looper.getMainLooper())
  private var updatesRequested = false
  private var requestedInBackgroundMode = false
  private var appInForeground = true

  // Tells when the tour UI leaves or returns to the screen (Home, Recents,
  // another app). Pause, not stop: Recents keeps the app as a live, started
  // preview, so pause is the only callback before the user can swipe it away.
  private val activityCallbacks = object : Application.ActivityLifecycleCallbacks {
    override fun onActivityResumed(activity: Activity) = onAppVisibilityChanged(true)
    override fun onActivityPaused(activity: Activity) = onAppVisibilityChanged(false)
    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
    override fun onActivityStarted(activity: Activity) = Unit
    override fun onActivityStopped(activity: Activity) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
    override fun onActivityDestroyed(activity: Activity) = Unit
  }

  private val showLeftAppWarning = Runnable { updateTourNotification(appVisible = false) }

  private val locationListener = object : LocationListener {
    override fun onLocationChanged(location: Location) {
      if (!isUsableLocation(location)) return
      val now = System.currentTimeMillis()
      getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
        .putBoolean("tracking", true)
        .putBoolean("locationEnabled", true)
        .putLong("latitude_e6", (location.latitude * 1_000_000.0).toLong())
        .putLong("longitude_e6", (location.longitude * 1_000_000.0).toLong())
        .putFloat("accuracy", location.accuracy)
        .putLong("timestamp", now)
        .apply()

      emitLocation(
        type = "update",
        enabled = true,
        location = location,
        timestamp = now,
      )
      TourTrackingUploader.onLocation(this@TourLocationService, location)
    }

    override fun onProviderDisabled(provider: String) {
      if (!isLocationEnabled(this@TourLocationService)) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
          .putBoolean("locationEnabled", false)
          .apply()
        TourTrackingUploader.onLocationUnavailable(this@TourLocationService)
        emitLocation(
          type = "unavailable",
          enabled = false,
          location = null,
          timestamp = System.currentTimeMillis(),
        )
      }
    }
  }

  private val providerPoll = object : Runnable {
    override fun run() {
      val enabled = isLocationEnabled(this@TourLocationService)
      val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
      prefs.edit().putBoolean("tracking", true).putBoolean("locationEnabled", enabled).apply()

      if (enabled && !updatesRequested) {
        requestUpdates()
      } else if (!enabled && updatesRequested) {
        removeUpdates()
      }

      if (!enabled) {
        emitLocation(type = "unavailable", enabled = false, location = null, timestamp = System.currentTimeMillis())
      }
      TourTrackingUploader.onTick(this@TourLocationService, enabled)
      handler.postDelayed(this, 2_000L)
    }
  }

  override fun onCreate() {
    super.onCreate()
    locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
    createNotificationChannel()
    startForegroundWithLocationType()
    // A running tour replaces an earlier "tracking stopped" alert.
    getSystemService(NotificationManager::class.java).cancel(ALERT_NOTIFICATION_ID)
    application.registerActivityLifecycleCallbacks(activityCallbacks)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopTracking()
      stopSelf()
      return START_NOT_STICKY
    }

    getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
      .putBoolean("tracking", true)
      .putBoolean("locationEnabled", isLocationEnabled(this))
      .putBoolean("taskRemovedWhileTracking", false)
      .apply()
    requestUpdates()
    handler.removeCallbacks(providerPoll)
    handler.post(providerPoll)
    // Not sticky: once the app is closed or killed, tracking must not restart
    // on its own without the tour UI.
    return START_NOT_STICKY
  }

  private fun requestUpdates() {
    if (updatesRequested || !hasLocationPermission()) return
    if (!isLocationEnabled(this)) {
      emitLocation(type = "unavailable", enabled = false, location = null, timestamp = System.currentTimeMillis())
      return
    }

    try {
      // Full navigation rate while the tour UI is visible; a lighter rate when
      // only the Firestore upload needs fixes (see TOUR_TRACKING_CONFIG).
      val backgroundMode = !appInForeground
      val (intervalMs, minDistanceMeters) = if (backgroundMode) {
        TourTrackingUploader.backgroundGpsRequest(this)
      } else {
        FOREGROUND_GPS_INTERVAL_MS to FOREGROUND_GPS_MIN_DISTANCE_METERS
      }
      val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
      providers.filter { provider ->
        try { locationManager.isProviderEnabled(provider) } catch (_: Exception) { false }
      }.forEach { provider ->
        locationManager.requestLocationUpdates(
          provider,
          intervalMs,
          minDistanceMeters,
          locationListener,
          Looper.getMainLooper(),
        )
      }
      updatesRequested = true
      requestedInBackgroundMode = backgroundMode
    } catch (_: SecurityException) {
      emitLocation(type = "unavailable", enabled = false, location = null, timestamp = System.currentTimeMillis())
    }
  }

  private fun removeUpdates() {
    if (!updatesRequested) return
    try {
      locationManager.removeUpdates(locationListener)
    } catch (_: SecurityException) {
      // Permission may have been revoked while the service was running.
    }
    updatesRequested = false
  }

  private fun applyGpsMode() {
    if (updatesRequested && requestedInBackgroundMode != !appInForeground) {
      removeUpdates()
      requestUpdates()
    }
  }

  private fun onAppVisibilityChanged(visible: Boolean) {
    if (appInForeground == visible) return
    Log.d(TAG, "Tour UI visible=$visible")
    appInForeground = visible
    applyGpsMode()
    handler.removeCallbacks(showLeftAppWarning)
    if (visible) {
      updateTourNotification(appVisible = true)
    } else {
      // Skip pauses that end right away, such as a system dialog flashing by.
      handler.postDelayed(showLeftAppWarning, LEFT_APP_WARNING_DELAY_MS)
    }
  }

  private fun stopTracking() {
    handler.removeCallbacks(providerPoll)
    removeUpdates()
    getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
      .putBoolean("tracking", false)
      .putBoolean("taskRemovedWhileTracking", false)
      .apply()
  }

  private fun hasLocationPermission(): Boolean =
    ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
      ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

  private fun isUsableLocation(location: Location): Boolean =
    location.latitude.isFinite() && location.longitude.isFinite() && location.accuracy <= 100f

  private fun emitLocation(type: String, enabled: Boolean, location: Location?, timestamp: Long) {
    val intent = Intent(EVENT_ACTION).setPackage(packageName)
      .putExtra("type", type)
      .putExtra("locationEnabled", enabled)
      .putExtra("timestamp", timestamp)
    if (location != null) {
      intent.putExtra("latitude", location.latitude)
        .putExtra("longitude", location.longitude)
        .putExtra("accuracy", location.accuracy.toDouble())
    }
    sendBroadcast(intent)
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java)
    // Android requires a notification while this foreground service runs; MIN
    // keeps it out of the status bar and collapsed at the bottom of the shade.
    // A channel's importance cannot be lowered after creation, so the earlier
    // LOW channel is replaced.
    manager.deleteNotificationChannel(LEGACY_CHANNEL_ID)
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Active tour location", NotificationManager.IMPORTANCE_MIN)
    )
    manager.createNotificationChannel(
      NotificationChannel(ALERT_CHANNEL_ID, "Tour tracking alerts", NotificationManager.IMPORTANCE_HIGH)
    )
  }

  private fun startForegroundWithLocationType() {
    val notification = buildTourNotification(appVisible = true)
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  /**
   * The single notification of a running tour. Android requires one while
   * this service runs: it stays quiet while the tour UI is visible and turns
   * into a heads-up warning when the user leaves the app, so closing the app
   * from Recents (which stops tracking) is never a surprise.
   */
  private fun buildTourNotification(appVisible: Boolean): Notification {
    val title = if (appVisible) "Tour in progress" else "Your tour is still running"
    val text = if (appVisible) {
      "Location is active for your tour. Closing the app from recent apps stops tracking."
    } else {
      "Keep Pride This Way open in the background. If you close it from recent apps, location tracking will stop."
    }
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, if (appVisible) CHANNEL_ID else ALERT_CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
        .setPriority(if (appVisible) Notification.PRIORITY_MIN else Notification.PRIORITY_HIGH)
    }
    return builder
      .setContentTitle(title)
      .setContentText(text)
      .setStyle(Notification.BigTextStyle().bigText(text))
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .apply { launchAppIntent()?.let(::setContentIntent) }
      .build()
  }

  private fun updateTourNotification(appVisible: Boolean) {
    // Same id as the foreground notification: replaced, never a second one.
    getSystemService(NotificationManager::class.java)
      .notify(NOTIFICATION_ID, buildTourNotification(appVisible))
  }

  private fun launchAppIntent(): PendingIntent? =
    packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or
          (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0),
      )
    }

  private fun showTourAlert(title: String, text: String) {
    if (Build.VERSION.SDK_INT >= 33 &&
      ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      return
    }
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, ALERT_CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this).setPriority(Notification.PRIORITY_HIGH)
    }
    val notification = builder
      .setContentTitle(title)
      .setContentText(text)
      .setStyle(Notification.BigTextStyle().bigText(text))
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setAutoCancel(true)
      // Own group: otherwise Android bundles it with the silent ongoing tour
      // notification and the warning is hidden inside that bundle.
      .setGroup(ALERT_GROUP_KEY)
      .apply { launchAppIntent()?.let(::setContentIntent) }
      .build()
    getSystemService(NotificationManager::class.java).notify(ALERT_NOTIFICATION_ID, notification)
  }

  override fun onDestroy() {
    application.unregisterActivityLifecycleCallbacks(activityCallbacks)
    handler.removeCallbacks(showLeftAppWarning)
    // An update posted while stopping would otherwise outlive the service.
    getSystemService(NotificationManager::class.java).cancel(NOTIFICATION_ID)
    stopTracking()
    super.onDestroy()
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // Closing the app from Recents ends location tracking. Android does not
    // let an app block or confirm that swipe, so the user was warned when the
    // app left the screen (onAppVisibilityChanged) and is told now. The tour
    // itself stays active and tracking resumes when the app is reopened.
    TourTrackingUploader.stopSession(this, "app_closed")
    stopTracking()
    handler.removeCallbacks(showLeftAppWarning)
    showTourAlert(
      "Location tracking stopped",
      "You closed Pride This Way, so your tour location is no longer tracked. Open the app to continue your tour.",
    )
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
    super.onTaskRemoved(rootIntent)
  }

  override fun onBind(intent: Intent?): IBinder? = null

  companion object {
    const val ACTION_START = "com.pridethisway.TOUR_LOCATION_START"
    const val ACTION_STOP = "com.pridethisway.TOUR_LOCATION_STOP"
    const val EVENT_ACTION = "com.pridethisway.TOUR_LOCATION_EVENT"
    const val JS_EVENT = "TourLocationEvent"
    const val PREFS_NAME = "tour_location_state"
    private const val CHANNEL_ID = "active_tour_location_min"
    private const val LEGACY_CHANNEL_ID = "active_tour_location"
    private const val NOTIFICATION_ID = 4201

    private const val TAG = "TourLocationService"
    private const val ALERT_CHANNEL_ID = "tour_tracking_alerts"
    private const val ALERT_NOTIFICATION_ID = 4202
    private const val ALERT_GROUP_KEY = "com.pridethisway.TOUR_TRACKING_ALERT"
    private const val LEFT_APP_WARNING_DELAY_MS = 700L

    // Navigation rate while the tour UI is visible.
    private const val FOREGROUND_GPS_INTERVAL_MS = 1_000L
    private const val FOREGROUND_GPS_MIN_DISTANCE_METERS = 1f

    fun isLocationEnabled(context: Context): Boolean {
      val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return false
      return try {
        // Some vendor Android builds briefly report a provider as enabled
        // after the quick-settings master Location tile has been turned off.
        // LOCATION_MODE is the authoritative fallback for that cold-relaunch
        // window and prevents JS from waiting forever for a fix.
        val secureLocationEnabled = try {
          Settings.Secure.getInt(
            context.contentResolver,
            Settings.Secure.LOCATION_MODE,
          ) != Settings.Secure.LOCATION_MODE_OFF
        } catch (_: Exception) {
          null
        }

        if (secureLocationEnabled == false) {
          return false
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          manager.isLocationEnabled
        } else {
          secureLocationEnabled ?: (
            manager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
              manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
          )
        }
      } catch (_: Settings.SettingNotFoundException) {
        false
      } catch (_: Exception) {
        false
      }
    }
  }
}
