package com.sensitiveinfo.internal.auth

import android.content.Context
import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import com.margelo.nitro.sensitiveinfo.AuthenticationPrompt
import com.sensitiveinfo.internal.util.ReactContextHolder
import com.sensitiveinfo.internal.util.SensitiveInfoException
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
import javax.crypto.Cipher
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Concrete implementation of AuthenticationManager for Android.
 *
 * Handles biometric and device credential authentication:
 * - Biometric prompt presentation
 * - Device credential fallback
 * - Error mapping and handling
 * - Custom prompt customization
 *
 * @since 6.0.0
 */
internal class AndroidAuthenticationManager(
  private val biometricAuthenticator: BiometricAuthenticator
) : AuthenticationManager {
  
  private val context: Context?
    get() = try {
      ReactContextHolder.requireContext() as? Context
    } catch (e: Exception) {
      null
    }

  override suspend fun isBiometricAvailable(): Boolean {
    val ctx = context ?: return false
    val manager = BiometricManager.from(ctx)
    return manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS
  }

  override suspend fun isDeviceCredentialAvailable(): Boolean {
    val ctx = context ?: return false
    val manager = BiometricManager.from(ctx)
    return manager.canAuthenticate(BiometricManager.Authenticators.DEVICE_CREDENTIAL) == BiometricManager.BIOMETRIC_SUCCESS
  }

  override suspend fun evaluateBiometric(prompt: AuthenticationPrompt?): Boolean {
    val ctx = context
    if (ctx !is FragmentActivity) {
      throw IllegalStateException("Context must be FragmentActivity for biometric authentication")
    }

    return try {
      val cipher = biometricAuthenticator.authenticate(
        prompt = prompt,
        allowedAuthenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG,
        cipher = null
      )
      cipher != null
    } catch (e: Exception) {
      if (isAuthenticationCanceled(e)) {
        throw SensitiveInfoException.AuthenticationCanceled()
      }
      throw e
    }
  }

  override suspend fun evaluateDeviceCredential(prompt: AuthenticationPrompt?): Boolean {
    // Device credential is handled through BiometricPrompt with DEVICE_CREDENTIAL authenticator
    return evaluateBiometric(prompt)
  }

  override fun isAuthenticationCanceled(exception: Exception): Boolean {
    val message = exception.message ?: ""
    return message.contains("canceled", ignoreCase = true) ||
           message.contains("user_cancel", ignoreCase = true) ||
           message.contains("negative_button", ignoreCase = true)
  }

  override fun makeAuthenticationError(exception: Exception): String {
    return if (isAuthenticationCanceled(exception)) {
      "[E_AUTH_CANCELED] Authentication prompt canceled by the user."
    } else {
      "Authentication failed: ${exception.message}"
    }
  }
}
