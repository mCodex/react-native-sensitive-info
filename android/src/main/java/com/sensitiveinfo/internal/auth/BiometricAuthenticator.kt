package com.sensitiveinfo.internal.auth

import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.margelo.nitro.sensitiveinfo.AuthenticationPrompt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import com.sensitiveinfo.internal.util.ReactContextHolder
import com.sensitiveinfo.internal.util.SensitiveInfoException
import javax.crypto.Cipher
import kotlin.coroutines.cancellation.CancellationException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Coroutine-friendly wrapper around `BiometricPrompt` used by the Keystore flows.
 *
 * The helper always executes prompts on the main dispatcher and returns the cipher configured for
 * the successful authentication. Cancellation propagates back to the calling coroutine, matching
 * the surface used by the Nitro Promise bridge.
 */
internal class BiometricAuthenticator {
  private val applicationContext get() = ReactContextHolder.requireContext()

  /**
   * Prompts the user for biometric/device-credential authentication and returns the cipher once it
   * can be used. The coroutine cooperatively cancels when the caller abandons the operation.
   */
  suspend fun authenticate(
    prompt: AuthenticationPrompt?,
    allowedAuthenticators: Int,
    cipher: Cipher?
  ): Cipher? {
    val activity = currentFragmentActivity()
    val effectivePrompt = prompt ?: AuthenticationPrompt(DEFAULT_TITLE, null, null, DEFAULT_CANCEL)
    val allowDeviceCredential = allowedAuthenticators and BiometricManager.Authenticators.DEVICE_CREDENTIAL != 0
    val supportsInlineDeviceCredential = allowDeviceCredential && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
    val allowLegacyDeviceCredential = allowDeviceCredential && Build.VERSION.SDK_INT < Build.VERSION_CODES.Q

    return withContext(Dispatchers.Main) {
      if (cipher == null && allowLegacyDeviceCredential && !canUseBiometric()) {
        DeviceCredentialPromptFragment.authenticate(activity, effectivePrompt)
        null
      } else {
        try {
          authenticateWithBiometricPrompt(
            activity = activity,
            prompt = effectivePrompt,
            allowedAuthenticators = allowedAuthenticators,
            supportsInlineDeviceCredential = supportsInlineDeviceCredential,
            cipher = cipher
          )
        } catch (error: Throwable) {
          if (error is CancellationException) throw error
          if (allowLegacyDeviceCredential) {
            DeviceCredentialPromptFragment.authenticate(activity, effectivePrompt)
            return@withContext cipher
          }
          throw error
        }
      }
    }
  }

  private suspend fun authenticateWithBiometricPrompt(
    activity: FragmentActivity,
    prompt: AuthenticationPrompt,
    allowedAuthenticators: Int,
    supportsInlineDeviceCredential: Boolean,
    cipher: Cipher?
  ): Cipher? {
    return suspendCancellableCoroutine { continuation ->
      val executor = ContextCompat.getMainExecutor(activity)
      val promptInfo = buildPromptInfo(prompt, allowedAuthenticators, supportsInlineDeviceCredential)
      val biometricPrompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
          val authCipher = result.cryptoObject?.cipher ?: cipher
          continuation.resume(authCipher)
        }

        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
          if (
            errorCode == BiometricPrompt.ERROR_CANCELED ||
            errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
            errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON
          ) {
            continuation.resumeWithException(SensitiveInfoException.AuthenticationCanceled())
          } else {
            continuation.resumeWithException(IllegalStateException(errString.toString()))
          }
        }

        override fun onAuthenticationFailed() {
          // Keep waiting for another attempt.
        }
      })

      continuation.invokeOnCancellation {
        biometricPrompt.cancelAuthentication()
      }

      if (cipher != null) {
        val cryptoObject = BiometricPrompt.CryptoObject(cipher)
        biometricPrompt.authenticate(promptInfo, cryptoObject)
      } else {
        biometricPrompt.authenticate(promptInfo)
      }
    }
  }

  private fun buildPromptInfo(
    prompt: AuthenticationPrompt,
    allowedAuthenticators: Int,
    supportsInlineDeviceCredential: Boolean
  ): BiometricPrompt.PromptInfo {
    val builder = BiometricPrompt.PromptInfo.Builder()
      .setTitle(prompt.title)

    prompt.subtitle?.let(builder::setSubtitle)
    prompt.description?.let(builder::setDescription)

    var promptAuthenticators = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      allowedAuthenticators
    } else {
      allowedAuthenticators and (BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL)
    }

    if (promptAuthenticators == 0) {
      promptAuthenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG
    }

    val allowsDeviceCredential = promptAuthenticators and BiometricManager.Authenticators.DEVICE_CREDENTIAL != 0

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      builder.setAllowedAuthenticators(promptAuthenticators)
      if (!allowsDeviceCredential) {
        builder.setNegativeButtonText(prompt.cancel ?: DEFAULT_CANCEL)
      }
    } else {
      if (allowsDeviceCredential && supportsInlineDeviceCredential && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        @Suppress("DEPRECATION")
        builder.setDeviceCredentialAllowed(true)
      } else {
        builder.setNegativeButtonText(prompt.cancel ?: DEFAULT_CANCEL)
      }
    }

    return builder.build()
  }

  private fun canUseBiometric(): Boolean {
    val biometricManager = BiometricManager.from(applicationContext)
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val strong = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
      if (strong == BiometricManager.BIOMETRIC_SUCCESS) {
        true
      } else {
        biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK) == BiometricManager.BIOMETRIC_SUCCESS
      }
    } else {
      @Suppress("DEPRECATION")
      biometricManager.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS
    }
  }

  private fun currentFragmentActivity(): FragmentActivity {
    val activity = ReactContextHolder.currentActivity()
      ?: throw IllegalStateException("Unable to show authentication prompt: no active React activity.")
    return activity
  }

  companion object {
    private const val DEFAULT_TITLE = "Authenticate"
    private const val DEFAULT_CANCEL = "Cancel"
  }
}
