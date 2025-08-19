package com.margelo.nitro.sensitiveinfo

import android.app.Activity
import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactContext
import com.margelo.nitro.core.Promise
import androidx.fragment.app.FragmentActivity

class HybridBiometricPromptView(private val context: Context) : HybridBiometricPromptViewSpec() {
  // Props
  override var promptTitle: String? = null
  override var promptSubtitle: String? = null
  override var promptDescription: String? = null
  override var cancelButtonText: String? = null
  override var allowDeviceCredential: Boolean? = null

  override val view = android.view.View(context)

  override fun show(): Promise<Boolean> = Promise.async {
  val activity = (context as? ReactContext)?.currentActivity as? FragmentActivity
      ?: throw IllegalStateException("Current Activity is null")

    val mgr = BiometricManager.from(context)
    val can = mgr.canAuthenticate(
      if ((allowDeviceCredential ?: false))
        BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
      else
        BiometricManager.Authenticators.BIOMETRIC_STRONG
    )
    if (can != BiometricManager.BIOMETRIC_SUCCESS) return@async false

    // Synchronize result back to Promise
    val latch = java.util.concurrent.CountDownLatch(1)
    var success = false
    var error: Exception? = null

    val executor = ContextCompat.getMainExecutor(context)
    val callback = object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
        error = Exception(errString.toString())
        latch.countDown()
      }
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        success = true
        latch.countDown()
      }
      override fun onAuthenticationFailed() {
        // ignore
      }
    }

    val prompt = BiometricPrompt(activity, executor, callback)
    val builder = BiometricPrompt.PromptInfo.Builder()
      .setTitle(promptTitle ?: "Authenticate")
      .setSubtitle(promptSubtitle)
      .setDescription(promptDescription)

    if (allowDeviceCredential == true) {
      builder.setAllowedAuthenticators(
        BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
      )
    } else {
      builder.setNegativeButtonText(cancelButtonText ?: "Cancel")
    }

    activity.runOnUiThread {
      prompt.authenticate(builder.build())
    }

    latch.await()
    if (error != null) throw error as Exception
    success
  }
}
