package com.margelo.nitro.sensitiveinfo

import android.app.Activity
import android.content.Intent
import androidx.biometric.BiometricManager
import com.facebook.react.bridge.*

class AndroidBiometricModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {
  private var pendingPromise: Promise? = null

  override fun getName(): String = "AndroidBiometric"

  init {
    reactContext.addActivityEventListener(this)
  }

  @ReactMethod
  fun isAvailable(promise: Promise) {
    val mgr = BiometricManager.from(reactContext)
    val can = mgr.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
    promise.resolve(can == BiometricManager.BIOMETRIC_SUCCESS)
  }

  @ReactMethod
  fun authenticate(options: ReadableMap?, promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Current activity is null")
      return
    }
    if (pendingPromise != null) {
      promise.reject("IN_PROGRESS", "Another authentication is in progress")
      return
    }

  val intent = Intent(activity, TransparentBiometricActivity::class.java)
    options?.let {
      if (it.hasKey("promptTitle")) intent.putExtra("promptTitle", it.getString("promptTitle"))
      if (it.hasKey("promptSubtitle")) intent.putExtra("promptSubtitle", it.getString("promptSubtitle"))
      if (it.hasKey("promptDescription")) intent.putExtra("promptDescription", it.getString("promptDescription"))
      if (it.hasKey("cancelButtonText")) intent.putExtra("cancelButtonText", it.getString("cancelButtonText"))
      if (it.hasKey("allowDeviceCredential")) intent.putExtra("allowDeviceCredential", it.getBoolean("allowDeviceCredential"))
    }

    pendingPromise = promise
    try {
      activity.startActivityForResult(intent, REQUEST_CODE)
    } catch (e: Exception) {
      pendingPromise = null
      promise.reject("LAUNCH_ERROR", e)
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_CODE) return
    val promise = pendingPromise ?: return
    pendingPromise = null

    val success = data?.getBooleanExtra("success", false) ?: false
    val error = data?.getStringExtra("error")
    if (error != null) {
      promise.reject("AUTH_ERROR", error)
    } else {
      promise.resolve(success)
    }
  }

  override fun onNewIntent(intent: Intent) {}

  companion object {
    private const val REQUEST_CODE = 42421
  }
}
