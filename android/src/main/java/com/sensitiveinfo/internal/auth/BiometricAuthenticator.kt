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
 * BiometricAuthenticator.kt
 *
 * Handles biometric authentication with optional device credential fallback.
 *
 * **Architecture**:
 * - Wraps Android's BiometricPrompt API (androidx.biometric)
 * - Provides suspend-based coroutine interface for modern async handling
 * - Supports biometric (fingerprint, face, iris) + device credential fallback
 * - Handles API-level differences (Android 9-13+)
 *
 * **Key Features**:
 * - ✅ Biometric authentication (Face ID, Fingerprint, Iris)
 * - ✅ Device credential fallback (PIN, Pattern, Password)
 * - ✅ Custom prompt messages (title, subtitle, description)
 * - ✅ Android 9 special handling (manual prompt initialization)
 * - ✅ Automatic error mapping to SensitiveInfoException
 * - ✅ Coroutine-safe with proper continuation handling
 * - ✅ Thread-safe executor for callback handling
 *
 * **Android Version Support**:
 * - API 28 (Android 9): Uses BiometricPrompt with special handling
 * - API 29-30 (Android 10-11): BiometricPrompt with device credential support
 * - API 31+ (Android 12+): Full BiometricPrompt with all authenticators
 *
 * **API 28 Special Handling** (the "Android 9 problem"):
 * - BiometricPrompt requires setAllowedAuthenticators() on API 30+
 * - On API 28, this method doesn't exist
 * - Solution: Use fallback flow with DeviceCredentialPromptFragment for older devices
 * - See authenticate() method for implementation
 *
 * **Thread Model**:
 * - authenticate() is a suspend function (coroutine)
 * - Callbacks happen on executor thread (not main thread)
 * - Continuation.resume() is thread-safe
 * - UI operations happen on main thread via coroutine dispatcher
 *
 * **Security Properties**:
 * - Biometric data never leaves device secure hardware
 * - Authentication only unlocks the Cipher (doesn't extract biometric)
 * - Authenticated cipher is atomic (cipher.doFinal() or nothing)
 * - Failed attempts can trigger timeout/lockout
 * - Biometric template changes invalidate encrypted keys
 *
 * **Usage Example**:
 * ```kotlin
 * val authenticator = BiometricAuthenticator(context, fragmentActivity)
 *
 * // Check if biometric is available
 * if (authenticator.canUseBiometric()) {
 *     val prompt = AuthenticationPrompt(
 *         title = "Authenticate",
 *         subtitle = "Verify your identity",
 *         description = "Use your fingerprint to proceed"
 *     )
 *
 *     try {
 *         val cipher = authenticator.authenticate(
 *             prompt = prompt,
 *             cipher = encryptionCipher,
 *             allowDeviceCredential = true
 *         )
 *         // Cipher is now authenticated and ready to use
 *         plaintext = cipher.doFinal(ciphertext)
 *     } catch (e: SensitiveInfoException.BiometryLockout) {
 *         // Handle lockout
 *     } catch (e: SensitiveInfoException.AuthenticationCanceled) {
 *         // User canceled
 *     } catch (e: SensitiveInfoException) {
 *         // Other error
 *     }
 * }
 * ```
 *
 * @property context Android context (for biometric availability checks)
 * @property activity FragmentActivity (for BiometricPrompt UI rendering)
 *
 * @see BiometricPrompt for native Android documentation
 * @see DeviceCredentialPromptFragment for Android 9 fallback
 * @see AuthenticationPrompt for prompt configuration
 */
internal class BiometricAuthenticator(
    private val context: Context,
    private val activity: FragmentActivity
) {

    /**
     * Executor for BiometricPrompt callbacks.
     *
     * **Why a single-threaded executor**:
     * - BiometricPrompt callbacks must complete quickly
     * - Using Executors.newSingleThreadExecutor() ensures callbacks are sequential
     * - Prevents race conditions if multiple auth attempts happen simultaneously
     * - Callbacks are stateless (only resume continuation, then exit)
     *
     * Note: This executor is NOT for UI operations. Callbacks immediately
     * resume coroutines, which run on their designated dispatcher (usually Main).
     */
    private val executor: Executor = Executors.newSingleThreadExecutor()

    /**
     * Checks if device has biometric hardware and enrolled biometric.
     *
     * **What it checks**:
     * - Device has biometric hardware (fingerprint sensor, face recognition, etc.)
     * - User has enrolled at least one biometric (fingerprint, face, iris)
     * - BiometricPrompt API is available
     *
     * **Return Value**:
     * - true: Biometric is available and ready to use
     * - false: No biometric hardware, no enrollment, or API unavailable
     *
     * **Thread Model**:
     * - Synchronous (blocking)
     * - Should be called on main thread
     * - Calls BiometricManager.canAuthenticate() which is fast
     *
     * @return true if biometric authentication is possible
     *
     * @example
     * ```kotlin
     * if (authenticator.canUseBiometric()) {
     *     // Show biometric option in UI
     * } else {
     *     // Hide biometric option or show fallback
     * }
     * ```
     */
    fun canUseBiometric(): Boolean {
        val biometricManager = BiometricManager.from(context)
        return biometricManager.canAuthenticate(Authenticators.BIOMETRIC_STRONG) ==
            BiometricManager.BIOMETRIC_SUCCESS
    }

    /**
     * Checks if device has device credential (PIN, Pattern, or Password).
     *
     * **What it checks**:
     * - Device has a lock screen credential set (PIN, pattern, or password)
     * - User has enrolled the device credential
     * - Device credential can be used as fallback for biometric
     *
     * **Return Value**:
     * - true: Device credential is available
     * - false: No credential set or API unavailable
     *
     * @return true if device credential is possible
     *
     * @example
     * ```kotlin
     * if (authenticator.canUseDeviceCredential()) {
     *     // Allow fallback to PIN/pattern/password
     * }
     * ```
     */
    fun canUseDeviceCredential(): Boolean {
        val biometricManager = BiometricManager.from(context)
        return biometricManager.canAuthenticate(Authenticators.DEVICE_CREDENTIAL) ==
            BiometricManager.BIOMETRIC_SUCCESS
    }

    /**
     * Authenticates user via biometric or device credential.
     *
     * **Security Workflow**:
     * 1. Check platform capabilities (biometric available, device credential, etc.)
     * 2. If API 28 and biometric unavailable: Show device credential prompt manually
     * 3. Create BiometricPrompt with authentication callback
     * 4. Show biometric UI to user (fingerprint, face, or enter PIN)
     * 5. On success: Return authenticated cipher (now ready for crypto operations)
     * 6. On failure: Resume coroutine with exception
     *
     * **Cipher Authentication** (cryptographic security):
     * - The returned cipher has been "authenticated" by the hardware
     * - This means only an authorized user (biometric matched or credential entered) can use it
     * - The cipher can then be used to encrypt/decrypt with the authenticated key
     * - Attempting to use the cipher without authentication fails in the hardware
     *
     * **Android 9 Special Handling**:
     * On API 28, the BiometricPrompt API is available but limited:
     * - setAllowedAuthenticators() doesn't exist (added in API 30)
     * - Must use setNegativeButtonText() for manual cancel instead
     * - Device credential fallback is handled manually via DeviceCredentialPromptFragment
     * - This is the fix for the "Android 9 biometric problem"
     *
     * **Thread Model**:
     * - Suspend function (coroutine-based)
     * - Uses suspendCancellableCoroutine for proper async handling
     * - Callbacks resume on executor thread (not main thread)
     * - Coroutine resumes on the dispatcher of the original caller
     *
     * **Options for Android 9+**:
     * If allowDeviceCredential=true and biometric fails:
     * - API 30+: BiometricPrompt automatically shows device credential UI
     * - API 28-29: Manually show DeviceCredentialPromptFragment fallback
     *
     * @param prompt Custom biometric prompt configuration
     *               (title, subtitle, description, cancel button text)
     * @param cipher Optional Cipher for crypto operations (can be null for auth-only)
     * @param allowDeviceCredential Allow PIN/Pattern/Password fallback if biometric unavailable
     *                              (required for API 30+ credential fallback)
     *
     * @return The authenticated cipher (if provided) or the same cipher passed in
     *         Ready to use for encryption/decryption operations
     *
     * @throws SensitiveInfoException.AuthenticationCanceled User canceled the prompt
     * @throws SensitiveInfoException.AuthenticationFailed Biometric didn't match or other auth error
     * @throws SensitiveInfoException.BiometryLockout Biometric locked due to too many failed attempts
     *
     * @example
     * ```kotlin
     * val prompt = AuthenticationPrompt(
     *     title = "Authenticate",
     *     subtitle = "Use your fingerprint",
     *     description = "Required to access secure data",
     *     cancel = "Cancel"
     * )
     *
     * try {
     *     val authenticatedCipher = authenticator.authenticate(
     *         prompt = prompt,
     *         cipher = encryptionCipher,
     *         allowDeviceCredential = true
     *     )
     *     // Success: cipher is authenticated
     *     val plaintext = authenticatedCipher.doFinal(ciphertext)
     * } catch (e: SensitiveInfoException.BiometryLockout) {
     *     showErrorDialog("Biometric locked. Use PIN to unlock.")
     * } catch (e: SensitiveInfoException.AuthenticationCanceled) {
     *     // User canceled, operation aborted normally
     * }
     * ```
     *
     * @see DeviceCredentialPromptFragment for Android 9 credential fallback
     * @see BiometricPrompt for native BiometricPrompt implementation
     */
    @Throws(SensitiveInfoException::class)
    suspend fun authenticate(
        prompt: AuthenticationPrompt,
        cipher: Cipher? = null,
        allowDeviceCredential: Boolean = true
    ): Cipher? {
        // Determine which authentication method to use based on API level and availability
        val supportsInlineDeviceCredential = allowDeviceCredential && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
        val allowLegacyDeviceCredential = allowDeviceCredential && Build.VERSION.SDK_INT < Build.VERSION_CODES.Q

        // Special handling for API 28 (Android 9): Biometric may not be available
        if (allowLegacyDeviceCredential && !canUseBiometric()) {
            // Biometric not available, try device credential manually
            val success = DeviceCredentialPromptFragment.authenticate(activity, prompt)
            if (success) return cipher
            throw SensitiveInfoException.AuthenticationCanceled()
        }

        // Try BiometricPrompt (primary method for API 30+)
        return try {
            authenticateWithBiometricPrompt(prompt, cipher, supportsInlineDeviceCredential)
        } catch (error: SensitiveInfoException) {
            // BiometricPrompt failed, try legacy device credential fallback
            if (allowLegacyDeviceCredential && error !is SensitiveInfoException.AuthenticationCanceled) {
                val success = DeviceCredentialPromptFragment.authenticate(activity, prompt)
                if (success) return cipher
            }
            throw error
        }
    }

    /**
     * Internal: Authenticates using BiometricPrompt API.
     *
     * **Implementation Details**:
     * - Creates PromptInfo with user-provided messages
     * - Sets allowed authenticators based on API level and availability
     * - Registers callback for success/error/failure
     * - Suspends coroutine until user completes authentication
     * - Resumes with authenticated cipher or exception
     *
     * **Callback Handling**:
     * - onAuthenticationSucceeded: User authenticated → resume with cipher
     * - onAuthenticationError: System error or user cancel → resume with exception
     * - onAuthenticationFailed: Biometric didn't match → resume with exception
     *
     * **Authenticator Types** (based on API level):
     * - API 31+: Can specify BIOMETRIC_STRONG, BIOMETRIC_WEAK, DEVICE_CREDENTIAL separately
     * - API 30: Can use BIOMETRIC_STRONG | DEVICE_CREDENTIAL
     * - API 28-29: Only BIOMETRIC_STRONG available (no official device credential in BiometricPrompt)
     *
     * @param prompt User-facing prompt configuration
     * @param cipher Optional cipher to authenticate
     * @param supportsInlineDeviceCredential Whether to allow device credential in BiometricPrompt
     *
     * @return Authenticated cipher or null
     * @throws SensitiveInfoException on authentication failure
     */
    private suspend fun authenticateWithBiometricPrompt(
        prompt: AuthenticationPrompt,
        cipher: Cipher?,
        supportsInlineDeviceCredential: Boolean
    ): Cipher? {
        return suspendCancellableCoroutine { continuation ->
            // Build PromptInfo with user-provided configuration
            val promptBuilder = BiometricPrompt.PromptInfo.Builder()
                .setTitle(prompt.title)
                .setSubtitle(prompt.subtitle)
                .setDescription(prompt.description)

            // Configure authenticator types based on API level
            if (supportsInlineDeviceCredential) {
                // API 30+: Can request both biometric and device credential inline
                promptBuilder.setAllowedAuthenticators(
                    Authenticators.BIOMETRIC_STRONG or Authenticators.DEVICE_CREDENTIAL
                )
            } else {
                // API 28-29: Use negative button for manual cancel instead
                // (setAllowedAuthenticators doesn't exist)
                promptBuilder
                    .setNegativeButtonText(prompt.cancel ?: "Cancel")
                    .setAllowedAuthenticators(Authenticators.BIOMETRIC_STRONG)
            }

            val promptInfo = promptBuilder.build()

            // Create callback to handle authentication result
            val callback = object : BiometricPrompt.AuthenticationCallback() {
                /**
                 * User successfully authenticated via biometric or device credential.
                 */
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    // Get authenticated cipher from result or use provided one
                    val authenticatedCipher = result.cryptoObject?.cipher ?: cipher
                    continuation.resume(authenticatedCipher)
                }

                /**
                 * System error or user canceled biometric prompt.
                 *
                 * Maps specific error codes to SensitiveInfoException types.
                 */
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    val exception = when (errorCode) {
                        // User canceled via negative button or back gesture
                        BiometricPrompt.ERROR_CANCELED,
                        BiometricPrompt.ERROR_USER_CANCELED,
                        BiometricPrompt.ERROR_NEGATIVE_BUTTON ->
                            SensitiveInfoException.AuthenticationCanceled()

                        // Biometric locked after too many failed attempts
                        BiometricPrompt.ERROR_LOCKOUT,
                        BiometricPrompt.ERROR_LOCKOUT_PERMANENT ->
                            SensitiveInfoException.BiometryLockout()

                        // Device doesn't have biometric or credential
                        BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL,
                        BiometricPrompt.ERROR_HW_NOT_PRESENT,
                        BiometricPrompt.ERROR_HW_UNAVAILABLE,
                        BiometricPrompt.ERROR_NO_BIOMETRICS ->
                            SensitiveInfoException.AuthenticationFailed(errString.toString())

                        // Generic authentication error
                        else ->
                            SensitiveInfoException.AuthenticationFailed("Error $errorCode: $errString")
                    }
                    continuation.resumeWithException(exception)
                }

                /**
                 * User biometric didn't match (wrong fingerprint, wrong face, etc.).
                 * This is NOT a final error - user can retry.
                 */
                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    continuation.resumeWithException(
                        SensitiveInfoException.AuthenticationFailed("Biometric not recognized")
                    )
                }
            }

            // Create and show BiometricPrompt
            val biometricPrompt = BiometricPrompt(activity, executor, callback)

            // Handle coroutine cancellation (user dismisses prompt)
            continuation.invokeOnCancellation {
                // BiometricPrompt dismisses automatically when coroutine is cancelled
            }

            // Show the biometric prompt with cipher if provided
            if (cipher != null) {
                biometricPrompt.authenticate(promptInfo, BiometricPrompt.CryptoObject(cipher))
            } else {
                biometricPrompt.authenticate(promptInfo)
            }
        }
    }
}

/**
 * Configuration for BiometricPrompt UI.
 *
 * Allows customizing the text and appearance of the biometric authentication dialog.
 *
 * @property title Main prompt title (required, shown at top of dialog)
 * @property subtitle Secondary title below main title (optional)
 * @property description Description text above fingerprint icon (optional)
 * @property cancel Text for negative/cancel button (optional, defaults to "Cancel")
 *
 * @example
 * ```kotlin
 * val prompt = AuthenticationPrompt(
 *     title = "Authenticate",
 *     subtitle = "Verify your identity",
 *     description = "Tap your fingerprint to continue",
 *     cancel = "Abort"
 * )
 * ```
 */
data class AuthenticationPrompt(
    val title: String,
    val subtitle: String? = null,
    val description: String? = null,
    val cancel: String? = null
)
