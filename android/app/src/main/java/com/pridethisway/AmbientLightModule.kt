package com.pridethisway

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class AmbientLightModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), SensorEventListener {

  private val sensorManager =
    reactContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
  private val lightSensor = sensorManager.getDefaultSensor(Sensor.TYPE_LIGHT)
  private var running = false

  override fun getName(): String = "AmbientLight"

  @ReactMethod
  fun start(promise: Promise) {
    if (running) {
      promise.resolve(true)
      return
    }
    if (lightSensor == null) {
      promise.resolve(false)
      return
    }
    // Some sensors deliver their first value during registration. Mark the
    // listener active first so that initial reading reaches JavaScript.
    running = true
    running = sensorManager.registerListener(
      this,
      lightSensor,
      SensorManager.SENSOR_DELAY_NORMAL,
    )
    promise.resolve(running)
  }

  @ReactMethod
  fun stop(promise: Promise) {
    stopSensor()
    promise.resolve(true)
  }

  // Required by NativeEventEmitter on Android.
  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Int) = Unit

  override fun onSensorChanged(event: SensorEvent?) {
    if (!running || event?.sensor?.type != Sensor.TYPE_LIGHT) return
    val lux = event.values.firstOrNull()?.toDouble() ?: return
    if (!lux.isFinite() || lux < 0) return

    val payload = Arguments.createMap().apply {
      putDouble("lux", lux)
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("AmbientLightEvent", payload)
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  private fun stopSensor() {
    if (running) sensorManager.unregisterListener(this)
    running = false
  }

  override fun onCatalystInstanceDestroy() {
    stopSensor()
    super.onCatalystInstanceDestroy()
  }
}
