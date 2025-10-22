package com.sensitiveinfo.internal.auth

import android.content.Context
import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import com.sensitiveinfo.internal.util.SensitiveInfoException
import java.util.concurrent.Executor
import java.util.concurrent.Executors
import javax.crypto.Cipher
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Manages biometric authentication (Face ID, fingerprint, etc).
 *
 * **Architecture**:
 * - Uses BiometricPrompt API (system-managed UI, app can't fake it)
 * - Shows native OS authentication dialog
 * - Returns authenticated Cipher for crypto operations
 * - Handles fallback to device credential (PIN/pattern)
 *
 * **Security Properties**:
 * - BiometricPrompt UI is controlled by OS, not the app
 * - Biometric data never exposed to app
 * - Failed authentication doesn't return Cipher
 * - Device credential fallback always available
 *
 * **Authentication Flow**:
 * 1. Check device capability (is biometric available?)
 * 2. Show BiometricPrompt (OS-managed UI)
 * 3. User authenticates (fingerprint, face, etc)
 * 4. OS returns authenticated Cipher or error
 * 5. Use Cipher for decryption/encryption
 *
 * @see https://developer.android.com/training/sign-in/biometric-auth
 */
class BiometricAuthenticator(
    private val context: Context,
    private val activity: FragmentActivity
) {

    private val executor: Executor = Executors.newSingleThreadExecutor()

    /**
     * Checks if the device supports biometric authentication.
     *
     * **Returns**:
     * - BIOMETRIC_SUCCESS: Device has biometric capability
     * - BIOMETRIC_ERROR_HW_UNAVAILABLE: Hardware not present
     * - BIOMETRIC_ERROR_NO_HARDWARE: Feature not available
     * - BIOMETRIC_ERROR_NONE_ENROLLED: No biometrics registered
     *
     * @return true if biometric is available and enrolled
     *
     * @example
     * ```kotlin
     * if (bioAuth.canUseBiometric()) {
     *     showBiometricOption()
     * } else {
     *     showPasswordOption()
     * }
     * ```
     */
    fun canUseBiometric(): Boolean {
        val biometricManager = BiometricManager.from(context)
        return biometricManager.canAuthenticate(Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS
    }

    /**
     * Checks if device credential authentication is available.
     *
     * Device credential = PIN, pattern, or password set on device.
     *
     * @return true if device has a credential set
     */
    fun canUseDeviceCredential(): Boolean {
        val biometricManager = BiometricManager.from(context)
        val result = biometricManager.canAuthenticate(Authenticators.DEVICE_CREDENTIAL)
        return result == BiometricManager.BIOMETRIC_SUCCESS
    }

    /**
     * Authenticates user and returns a Cipher for cryptographic operations.
     *
     * **Workflow**:
     * 1. Check authentication capability
     * 2. Build prompt with customizable text
     * 3. Show OS biometric dialog (user authenticates)
     * 4. Return authenticated Cipher
     *
     * **Error Handling**:
     * - User cancels → E_AUTH_CANCELED
     * - Wrong biometric → E_AUTH_FAILED
     * - Too many failures → E_BIOMETRY_LOCKOUT
     * - Biometric enrollment changed → E_KEY_INVALIDATED
     *
     * @param prompt Customizable authentication prompt text
     * @param cipher Cipher to authenticate for (for CryptoObject)
     * @param allowDeviceCredential If true, allow PIN/pattern as fallback
     *
     * @return Authenticated Cipher ready for use
     *
     * @throws SensitiveInfoException.AuthenticationCanceled User canceled
     * @throws SensitiveInfoException.AuthenticationFailed Biometric failed
     * @throws SensitiveInfoException.BiometryLockout Too many attempts
     *
     * @example
     * ```kotlin
     * val bioAuth = BiometricAuthenticator(context, activity)
     *
     * val prompt = AuthenticationPrompt(
     *     title = "Unlock Token",
     *     description = "Authenticate to access your token"
     * )
     *
     * try {
     *     val cipher = bioAuth.authenticate(prompt, cipherObject)
     *     // Use cipher for decryption
     * } catch (e: SensitiveInfoException.AuthenticationCanceled) {
     *     // User canceled, close dialog
     * } catch (e: SensitiveInfoException.AuthenticationFailed) {
     *     // Wrong fingerprint, let user retry
     * }
     * ```
     */
    @Throws(SensitiveInfoException::class)
    suspend fun authenticate(
        prompt: AuthenticationPrompt,
        cipher: Cipher? = null,
        allowDeviceCredential: Boolean = true
    ): Cipher? {
        return suspendCancellableCoroutine { continuation ->
            val promptBuilder = BiometricPrompt.PromptInfo.Builder()
                .setTitle(prompt.title)
                .setSubtitle(prompt.subtitle)
                .setDescription(prompt.description)
                .setNegativeButtonText(prompt.cancel ?: "Cancel")

            // Allow biometric and optionally device credential
            // Note: DEVICE_CREDENTIAL flag only available on Android 10 (API 29)+
            // On Android 9 (API 28), use BIOMETRIC_STRONG only
            val authenticators = if (allowDeviceCredential && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                Authenticators.BIOMETRIC_STRONG or Authenticators.DEVICE_CREDENTIAL
            } else {
                Authenticators.BIOMETRIC_STRONG
            }
            promptBuilder.setAllowedAuthenticators(authenticators)

            val promptInfo = promptBuilder.build()

            // Create callback
            val authCallback = object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    // User authenticated successfully
                    // Return the original cipher or null if no cipher was provided
                    continuation.resume(cipher)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    // Handle specific error codes
                    val exception = when (errorCode) {
                        BiometricPrompt.ERROR_CANCELED,
                        BiometricPrompt.ERROR_USER_CANCELED,
                        BiometricPrompt.ERROR_NEGATIVE_BUTTON -> {
                            SensitiveInfoException.AuthenticationCanceled()
                        }
                        BiometricPrompt.ERROR_LOCKOUT,
                        BiometricPrompt.ERROR_LOCKOUT_PERMANENT -> {
                            SensitiveInfoException.BiometryLockout()
                        }
                        BiometricPrompt.ERROR_HW_NOT_PRESENT,
                        BiometricPrompt.ERROR_HW_UNAVAILABLE,
                        BiometricPrompt.ERROR_NO_BIOMETRICS,
                        BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL -> {
                            SensitiveInfoException.AuthenticationFailed(errString.toString())
                        }
                        else -> {
                            SensitiveInfoException.AuthenticationFailed("Error $errorCode: $errString")
                        }
                    }
                    continuation.resumeWithException(exception)
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    // Biometric not recognized (but can retry)
                    continuation.resumeWithException(
                        SensitiveInfoException.AuthenticationFailed("Biometric not recognized")
                    )
                }
            }

            // Handle cancellation
            continuation.invokeOnCancellation {
                // Cleanup if coroutine is cancelled
            }

            // Show prompt
            val biometricPrompt = BiometricPrompt(
                activity,
                executor,
                authCallback
            )

            // Only wrap cipher in CryptoObject if it's not null
            if (cipher != null) {
                biometricPrompt.authenticate(promptInfo, BiometricPrompt.CryptoObject(cipher))
            } else {
                biometricPrompt.authenticate(promptInfo)
            }
        }
    }
}

/**
 * Customizable text for biometric authentication prompt.
 *
 * Shown in the OS-managed biometric dialog.
 *
 * @property title Primary prompt title (required)
 * @property subtitle Secondary subtitle (optional)
 * @property description Detailed explanation (optional)
 * @property cancel Cancel button text (optional, defaults to "Cancel")
 *
 * @example
 * ```kotlin
 * AuthenticationPrompt(
 *     title = "Unlock Your Account",
 *     subtitle = "Biometric authentication required",
 *     description = "Access your secure session token",
 *     cancel = "Cancel"
 * )
 * ```
 */
data class AuthenticationPrompt(
    val title: String,
    val subtitle: String? = null,
    val description: String? = null,
    val cancel: String? = null
)
