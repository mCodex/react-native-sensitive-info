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
import javax.crypto.Cipher
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
  suspend fun authenticate(
    prompt: AuthenticationPrompt?,
    allowedAuthenticators: Int,
    cipher: Cipher
  ): Cipher {
    val activity = currentFragmentActivity()
    return withContext(Dispatchers.Main) {
      suspendCancellableCoroutine { continuation ->
        val executor = ContextCompat.getMainExecutor(activity)
        val promptInfo = buildPromptInfo(prompt, allowedAuthenticators)
        val biometricPrompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
          override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
            val authCipher = result.cryptoObject?.cipher
              ?: return continuation.resumeWithException(IllegalStateException("Missing cipher from authentication result."))
            continuation.resume(authCipher)
          }

          override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
            if (errorCode == BiometricPrompt.ERROR_CANCELED ||
              errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
              errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON
            ) {
              continuation.cancel()
            } else {
              continuation.resumeWithException(IllegalStateException(errString.toString()))
            }
          }

          override fun onAuthenticationFailed() {
            // Keep waiting for a successful attempt.
          }
        })

        continuation.invokeOnCancellation {
          biometricPrompt.cancelAuthentication()
        }

        val cryptoObject = BiometricPrompt.CryptoObject(cipher)
        biometricPrompt.authenticate(promptInfo, cryptoObject)
      }
    }
  }

  private fun buildPromptInfo(prompt: AuthenticationPrompt?, allowedAuthenticators: Int): BiometricPrompt.PromptInfo {
    val builder = BiometricPrompt.PromptInfo.Builder()
      .setTitle(prompt?.title ?: DEFAULT_TITLE)

    prompt?.subtitle?.let(builder::setSubtitle)
    prompt?.description?.let(builder::setDescription)

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
        builder.setNegativeButtonText(prompt?.cancel ?: DEFAULT_CANCEL)
      }
    } else {
      if (allowsDeviceCredential) {
        @Suppress("DEPRECATION")
        builder.setDeviceCredentialAllowed(true)
      } else {
        builder.setNegativeButtonText(prompt?.cancel ?: DEFAULT_CANCEL)
      }
    }

    return builder.build()
  }

  private fun currentFragmentActivity(): FragmentActivity {
    val activity = ReactContextHolder.currentActivity()
      ?: throw IllegalStateException("Unable to show authentication prompt: no active React activity.")
    if (activity !is FragmentActivity) {
      throw IllegalStateException("Current activity does not support FragmentManager required for biometric prompts.")
    }
    return activity
  }

  companion object {
    private const val DEFAULT_TITLE = "Authenticate"
    private const val DEFAULT_CANCEL = "Cancel"
  }
}
