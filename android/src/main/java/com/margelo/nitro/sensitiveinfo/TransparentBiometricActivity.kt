package com.margelo.nitro.sensitiveinfo

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import androidx.fragment.app.FragmentActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat

class TransparentBiometricActivity : FragmentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
  // No special UI setup needed

    val mgr = BiometricManager.from(this)
    val can = mgr.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
    if (can != BiometricManager.BIOMETRIC_SUCCESS) {
      finishWith(false, "BIOMETRIC_UNAVAILABLE")
      return
    }

    val executor = ContextCompat.getMainExecutor(this)
    val promptInfo = BiometricPrompt.PromptInfo.Builder()
      .setTitle(intent.getStringExtra("promptTitle") ?: "Authenticate")
      .setSubtitle(intent.getStringExtra("promptSubtitle"))
      .setDescription(intent.getStringExtra("promptDescription"))
      .apply {
        val allowCredential = intent.getBooleanExtra("allowDeviceCredential", false)
        if (allowCredential) {
          setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL)
        } else {
          setNegativeButtonText(intent.getStringExtra("cancelButtonText") ?: "Cancel")
        }
      }
      .build()

  val prompt = BiometricPrompt(this, executor, object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
        finishWith(false, errString.toString())
      }
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        finishWith(true, null)
      }
      override fun onAuthenticationFailed() {
        // keep prompt open
      }
    })

    prompt.authenticate(promptInfo)
  }

  private fun finishWith(success: Boolean, error: String?) {
    val data = Intent()
    data.putExtra("success", success)
    if (error != null) data.putExtra("error", error)
    setResult(Activity.RESULT_OK, data)
    finish()
  }
}
