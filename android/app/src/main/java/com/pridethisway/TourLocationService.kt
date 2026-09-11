package com.pridethisway

import android.Manifest
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
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import androidx.core.content.ContextCompat

class TourLocationService : Service() {

  private lateinit var locationManager: LocationManager
  private val handler = Handler(Looper.getMainLooper())
  private var updatesRequested = false

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
    }

    override fun onProviderDisabled(provider: String) {
      if (!isLocationEnabled(this@TourLocationService)) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
          .putBoolean("locationEnabled", false)
          .apply()
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
      handler.postDelayed(this, 2_000L)
    }
  }

  override fun onCreate() {
    super.onCreate()
    locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
    createNotificationChannel()
    startForegroundWithLocationType()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopTracking(clearTaskRemovalState = true)
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
    return START_STICKY
  }

  private fun requestUpdates() {
    if (updatesRequested || !hasLocationPermission()) return
    if (!isLocationEnabled(this)) {
      emitLocation(type = "unavailable", enabled = false, location = null, timestamp = System.currentTimeMillis())
      return
    }

    try {
      val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
      providers.filter { provider ->
        try { locationManager.isProviderEnabled(provider) } catch (_: Exception) { false }
      }.forEach { provider ->
        locationManager.requestLocationUpdates(
          provider,
          1_000L,
          1f,
          locationListener,
          Looper.getMainLooper(),
        )
      }
      updatesRequested = true
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

  private fun stopTracking(clearTaskRemovalState: Boolean) {
    handler.removeCallbacks(providerPoll)
    removeUpdates()
    getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().apply {
      putBoolean("tracking", false)
      if (clearTaskRemovalState) {
        putBoolean("taskRemovedWhileTracking", false)
        remove("taskRemovedAt")
        remove("taskRemovedTourId")
        remove("activeTourId")
      }
    }.apply()
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
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Active tour location", NotificationManager.IMPORTANCE_LOW)
    )
    manager.createNotificationChannel(
      NotificationChannel(
        TASK_REMOVED_CHANNEL_ID,
        "Tour status updates",
        NotificationManager.IMPORTANCE_DEFAULT,
      )
    )
  }

  private fun startForegroundWithLocationType() {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or
          (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0),
      )
    }
    val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
        .setContentTitle("Tour in progress")
        .setContentText("Location is active for routing. Open the app to pause the tour.")
        .setSmallIcon(android.R.drawable.ic_menu_mylocation)
        .setOngoing(true)
        .setCategory(Notification.CATEGORY_SERVICE)
        .apply { contentIntent?.let(::setContentIntent) }
        .build()
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
        .setContentTitle("Tour in progress")
        .setContentText("Location is active for routing. Open the app to pause the tour.")
        .setSmallIcon(android.R.drawable.ic_menu_mylocation)
        .setOngoing(true)
        .setCategory(Notification.CATEGORY_SERVICE)
        .apply { contentIntent?.let(::setContentIntent) }
        .build()
    }

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

  override fun onDestroy() {
    // Keep the task-removal marker until the next launch has reconciled the
    // tour. A normal explicit pause clears it before stopping the service.
    stopTracking(clearTaskRemovalState = false)
    super.onDestroy()
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // This runs only when the Android task is actually removed from Recents;
    // screen lock and a normal Home/background transition do not trigger it.
    handler.removeCallbacks(providerPoll)
    removeUpdates()

    val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
    val activeTourId = prefs.getString("activeTourId", null)
    prefs.edit()
      .putBoolean("tracking", false)
      .putBoolean("taskRemovedWhileTracking", true)
      .putLong("taskRemovedAt", System.currentTimeMillis())
      .apply {
        if (!activeTourId.isNullOrBlank()) {
          putString("taskRemovedTourId", activeTourId)
        }
      }
      .apply()

    showTaskRemovedNotification()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
    stopSelf()

    super.onTaskRemoved(rootIntent)
  }

  private fun showTaskRemovedNotification() {
    if (
      Build.VERSION.SDK_INT >= 33 &&
      ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
        PackageManager.PERMISSION_GRANTED
    ) {
      return
    }

    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(
        this,
        1,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or
          (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0),
      )
    }
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, TASK_REMOVED_CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    val notification = builder
      .setContentTitle("Tour paused")
      .setContentText("Location tracking stopped because the app was removed. Tap to resume your tour.")
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setAutoCancel(true)
      .setCategory(Notification.CATEGORY_STATUS)
      .apply { contentIntent?.let(::setContentIntent) }
      .build()

    getSystemService(NotificationManager::class.java)
      .notify(TASK_REMOVED_NOTIFICATION_ID, notification)
  }

  override fun onBind(intent: Intent?): IBinder? = null

  companion object {
    const val ACTION_START = "com.pridethisway.TOUR_LOCATION_START"
    const val ACTION_STOP = "com.pridethisway.TOUR_LOCATION_STOP"
    const val EVENT_ACTION = "com.pridethisway.TOUR_LOCATION_EVENT"
    const val JS_EVENT = "TourLocationEvent"
    const val PREFS_NAME = "tour_location_state"
    private const val CHANNEL_ID = "active_tour_location"
    private const val TASK_REMOVED_CHANNEL_ID = "tour_status_updates"
    private const val NOTIFICATION_ID = 4201
    private const val TASK_REMOVED_NOTIFICATION_ID = 4202

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
