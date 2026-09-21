package com.pridethisway

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.SystemClock
import android.view.Surface
import android.view.WindowManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlin.math.abs

class TourHeadingModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), SensorEventListener {

  private val sensorManager =
    reactContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
  private val rotationSensor =
    sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
  private var running = false
  private var lastHeading = Double.NaN
  private var lastEmissionAt = 0L

  override fun getName(): String = "TourHeading"

  @ReactMethod
  fun startHeading(promise: Promise) {
    if (running) {
      promise.resolve(true)
      return
    }
    if (rotationSensor == null) {
      promise.reject("HEADING_UNAVAILABLE", "This device has no compass sensor")
      return
    }
    running = sensorManager.registerListener(
      this,
      rotationSensor,
      SensorManager.SENSOR_DELAY_UI,
    )
    promise.resolve(running)
  }

  @ReactMethod
  fun stopHeading(promise: Promise) {
    stopSensor()
    promise.resolve(true)
  }

  // Required by NativeEventEmitter on Android.
  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Int) = Unit

  override fun onSensorChanged(event: SensorEvent?) {
    if (!running || event?.sensor?.type != Sensor.TYPE_ROTATION_VECTOR) return

    val rotationMatrix = FloatArray(9)
    val adjustedMatrix = FloatArray(9)
    SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)

    @Suppress("DEPRECATION")
    val displayRotation =
      (reactContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager)
        .defaultDisplay.rotation
    val axes = when (displayRotation) {
      Surface.ROTATION_90 -> SensorManager.AXIS_Y to SensorManager.AXIS_MINUS_X
      Surface.ROTATION_180 -> SensorManager.AXIS_MINUS_X to SensorManager.AXIS_MINUS_Y
      Surface.ROTATION_270 -> SensorManager.AXIS_MINUS_Y to SensorManager.AXIS_X
      else -> SensorManager.AXIS_X to SensorManager.AXIS_Y
    }
    SensorManager.remapCoordinateSystem(
      rotationMatrix,
      axes.first,
      axes.second,
      adjustedMatrix,
    )

    val orientation = FloatArray(3)
    SensorManager.getOrientation(adjustedMatrix, orientation)
    val heading = ((Math.toDegrees(orientation[0].toDouble()) % 360) + 360) % 360
    val now = SystemClock.elapsedRealtime()
    val difference = if (lastHeading.isNaN()) {
      360.0
    } else {
      abs(((heading - lastHeading + 540) % 360) - 180)
    }
    if (difference < 1.0 && now - lastEmissionAt < 120) return

    lastHeading = heading
    lastEmissionAt = now
    val payload = Arguments.createMap().apply {
      putDouble("heading", heading)
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("TourHeadingEvent", payload)
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  private fun stopSensor() {
    if (running) sensorManager.unregisterListener(this)
    running = false
    lastHeading = Double.NaN
  }

  override fun onCatalystInstanceDestroy() {
    stopSensor()
    super.onCatalystInstanceDestroy()
  }
}
