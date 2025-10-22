package com.sensitiveinfo.internal

import android.content.Context
import com.sensitiveinfo.internal.auth.BiometricAuthenticator
import com.sensitiveinfo.internal.auth.AuthenticationPrompt
import com.sensitiveinfo.internal.storage.SecureStorage
import com.sensitiveinfo.internal.storage.StorageResult
import com.sensitiveinfo.internal.storage.StorageMetadata
import com.sensitiveinfo.internal.util.ActivityContextHolder
import com.sensitiveinfo.internal.util.SensitiveInfoException
import com.sensitiveinfo.internal.util.AccessControlResolver
import javax.crypto.Cipher

/**
 * HybridSensitiveInfo.kt
 *
 * Unified API for secure storage with biometric authentication on Android.
 *
 * This is the Android equivalent of iOS's HybridSensitiveInfo.swift
 *
 * **Architecture**:
 * 1. User calls setItem/getItem with optional authenticationPrompt
 * 2. HybridSensitiveInfo checks if biometric is required
 * 3. If biometric needed: Call BiometricAuthenticator.authenticate()
 * 4. User sees biometric prompt (Face ID/Touch ID or fingerprint)
 * 5. After authentication: Proceed with storage/retrieval
 * 6. Data is encrypted/decrypted in SecureStorage
 *
 * **Key Features**:
 * - ✅ Explicit biometric prompts (via BiometricPrompt API)
 * - ✅ Custom prompt messages (title, subtitle, description)
 * - ✅ Biometric + device credential fallback
 * - ✅ Secure encryption (AES-256-GCM)
 * - ✅ Hardware-backed keys (AndroidKeyStore)
 * - ✅ Hardware attestation where available
 *
 * **Difference from iOS**:
 * - iOS: Keychain handles biometric automatically on retrieval
 * - Android: Must explicitly show BiometricPrompt during setItem
 * - Both: Support custom authentication prompts
 *
 * **Permissions Required**:
 * - USE_BIOMETRIC (Android 10+, alternative to FINGERPRINT)
 * - USE_FINGERPRINT (Android 6-9, deprecated)
 * - USE_FACE_UNLOCK (some devices)
 * - USE_IRIS (some devices)
 *
 * **API**:
 * - setItem(key, value, service, accessControl, authenticationPrompt)
 * - getItem(key, service)
 * - deleteItem(key, service)
 * - hasItem(key, service)
 * - getAllItems(service)
 * - clearService(service)
 *
 * @property context Android context for storage and biometric
 *
 * @see BiometricAuthenticator for authentication
 * @see SecureStorage for encryption/storage
 * @see ActivityContextHolder for Activity reference
 * @see AuthenticationPrompt for custom prompt configuration
 */
class HybridSensitiveInfo(private val context: Context) {
    
    private val storage = SecureStorage(context)

    /**
     * Stores a secret in secure storage with optional biometric protection.
     *
     * **Workflow**:
     * 1. Check if biometric authentication is required
     * 2. If yes and authenticationPrompt provided: Show BiometricPrompt
     * 3. Wait for user to authenticate via biometric/credential
     * 4. After authentication: Store encrypted value in SecureStorage
     * 5. Return metadata about what was stored
     *
     * **Biometric Flow**:
     * - If accessControl includes "biometric" and authenticationPrompt provided:
     *   - Get FragmentActivity from ActivityContextHolder
     *   - Create BiometricAuthenticator with Activity
     *   - Call authenticate(prompt, cipher, allowDeviceCredential)
     *   - BiometricPrompt shows Face ID/Touch ID/Fingerprint
     *   - User authenticates (or cancels)
     *   - On success: Continue with storage
     *   - On error: Throw exception to caller
     *
     * - If authenticationPrompt NOT provided:
     *   - BiometricPrompt will be shown by system automatically when needed
     *   - But no custom message will be displayed
     *   - Recommended: Always provide authenticationPrompt
     *
     * **Example**:
     * ```kotlin
     * val sensitiveInfo = HybridSensitiveInfo(context)
     *
     * // Store with biometric - user will see Face ID prompt
     * val result = sensitiveInfo.setItem(
     *     key = "auth-token",
     *     value = "jwt-token-xyz",
     *     service = "myapp",
     *     accessControl = "secureEnclaveBiometry",
     *     authenticationPrompt = AuthenticationPrompt(
     *         title = "Authenticate",
     *         subtitle = "Please scan your fingerprint",
     *         description = "Required to store authentication token"
     *     )
     * )
     *
     * println("Stored: ${result.metadata.securityLevel}")
     * // Output: "Stored: biometry"
     * ```
     *
     * @param key Unique identifier for the secret
     * @param value Secret value to encrypt and store
     * @param service Service namespace (defaults to package name)
     * @param accessControl Access control policy (defaults to "secureEnclaveBiometry")
     * @param authenticationPrompt Custom prompt shown during biometric auth (optional)
     *
     * @return StorageResult with metadata about the stored secret
     *
     * @throws SensitiveInfoException.BiometricNotAvailable if biometric requested but not available
     * @throws SensitiveInfoException.BiometricLockout if too many failed attempts
     * @throws SensitiveInfoException.UserCancelled if user cancels biometric prompt
     * @throws SensitiveInfoException.EncryptionFailed if encryption fails
     * @throws SensitiveInfoException.KeystoreUnavailable if AndroidKeyStore unavailable
     *
     * @see AuthenticationPrompt for prompt customization
     * @see BiometricAuthenticator for biometric implementation
     * @see SecureStorage for storage implementation
     */
    suspend fun setItem(
        key: String,
        value: String,
        service: String? = null,
        accessControl: String? = null,
        authenticationPrompt: AuthenticationPrompt? = null
    ): StorageResult {
        // Validate inputs
        if (key.isEmpty()) {
            throw SensitiveInfoException.InvalidConfiguration("key", "Cannot be empty")
        }
        if (value.isEmpty()) {
            throw SensitiveInfoException.InvalidConfiguration("value", "Cannot be empty")
        }

        try {
            // Resolve access control configuration
            val accessControlConfig = AccessControlResolver.resolve(accessControl)

            // If biometric is required, authenticate user first
            if (accessControlConfig.requireBiometric && authenticationPrompt != null) {
                val activity = ActivityContextHolder.getActivity()
                    ?: throw SensitiveInfoException.ActivityUnavailable(
                        "FragmentActivity is not available. Make sure to call ActivityContextHolder.setActivity(this) in MainActivity.onCreate()"
                    )

                // Create biometric authenticator
                val biometricAuthenticator = BiometricAuthenticator(context, activity)

                // Check if biometric is available
                if (!biometricAuthenticator.canUseBiometric()) {
                    throw SensitiveInfoException.BiometricNotAvailable(
                        "Biometric authentication is not available on this device"
                    )
                }

                // Show biometric prompt to user
                // This will throw an exception if user cancels or authentication fails
                authenticateBiometric(biometricAuthenticator, authenticationPrompt)
            }

            // Store the encrypted value
            val storageMetadata = storage.setItem(
                key = key,
                value = value,
                service = service,
                accessControl = accessControl
            )

            return StorageResult(
                value = "",
                metadata = storageMetadata
            )
        } catch (e: SensitiveInfoException) {
            throw e
        } catch (e: Exception) {
            throw SensitiveInfoException.EncryptionFailed("Failed to store item: ${e.message}", e)
        }
    }

    /**
     * Retrieves and decrypts a stored secret.
     *
     * **Workflow**:
     * 1. Look up secret in SecureStorage
     * 2. Check if secret requires biometric protection
     * 3. If biometric required: Android OS will prompt during decryption
     * 4. Return decrypted value and metadata
     *
     * **Note**: Unlike iOS where we explicitly call authenticate(),
     * on Android the biometric prompt is triggered automatically
     * by AndroidKeyStore when accessing a biometric-protected key.
     *
     * **Example**:
     * ```kotlin
     * val sensitiveInfo = HybridSensitiveInfo(context)
     *
     * val result = sensitiveInfo.getItem("auth-token", "myapp")
     * if (result != null) {
     *     println("Token: ${result.value}")
     *     println("Security: ${result.metadata.securityLevel}")
     *     // If biometric was required during store:
     *     // - OS shows biometric prompt automatically
     *     // - User authenticates
     *     // - Value is returned if successful
     * } else {
     *     println("Token not found")
     * }
     * ```
     *
     * @param key Unique identifier for the secret
     * @param service Service namespace (defaults to package name)
     *
     * @return StorageResult with decrypted value, or null if not found
     *
     * @throws SensitiveInfoException.DecryptionFailed if decryption fails
     * @throws SensitiveInfoException.KeyInvalidated if biometric enrollment changed
     * @throws SensitiveInfoException.UserCancelled if user cancels biometric prompt
     * @throws SensitiveInfoException.KeystoreUnavailable if key not accessible
     */
    fun getItem(key: String, service: String? = null): StorageResult? {
        if (key.isEmpty()) {
            throw SensitiveInfoException.InvalidConfiguration("key", "Cannot be empty")
        }

        return try {
            val storageResult = storage.getItem(key, service)
            storageResult?.let { result ->
                StorageResult(
                    value = result.value,
                    metadata = StorageMetadata(
                        securityLevel = result.metadata.securityLevel,
                        accessControl = result.metadata.accessControl,
                        backend = result.metadata.backend,
                        timestamp = result.metadata.timestamp
                    )
                )
            }
        } catch (e: SensitiveInfoException) {
            throw e
        } catch (e: Exception) {
            throw SensitiveInfoException.DecryptionFailed("Failed to retrieve item: ${e.message}", e)
        }
    }

    /**
     * Deletes a stored secret and its associated key.
     *
     * @param key Unique identifier for the secret
     * @param service Service namespace
     *
     * @throws SensitiveInfoException if deletion fails
     */
    fun deleteItem(key: String, service: String? = null) {
        if (key.isEmpty()) {
            throw SensitiveInfoException.InvalidConfiguration("key", "Cannot be empty")
        }

        try {
            storage.deleteItem(key, service)
        } catch (e: SensitiveInfoException) {
            throw e
        } catch (e: Exception) {
            throw SensitiveInfoException.KeystoreUnavailable("Failed to delete item: ${e.message}", e)
        }
    }

    /**
     * Checks if a secret exists in storage.
     *
     * @param key Unique identifier for the secret
     * @param service Service namespace
     *
     * @return true if the secret exists, false otherwise
     */
    fun hasItem(key: String, service: String? = null): Boolean {
        if (key.isEmpty()) {
            throw SensitiveInfoException.InvalidConfiguration("key", "Cannot be empty")
        }

        return try {
            storage.hasItem(key, service)
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Retrieves all secret keys in a service namespace.
     *
     * Does NOT return the actual values, only the key names.
     *
     * @param service Service namespace
     *
     * @return List of key names (empty list if service has no items)
     */
    fun getAllItems(service: String? = null): List<String> {
        return try {
            storage.getAllItems(service)
        } catch (e: Exception) {
            emptyList()
        }
    }

    /**
     * Deletes all secrets in a service namespace.
     *
     * **Warning**: This is irreversible!
     *
     * @param service Service namespace
     *
     * @throws SensitiveInfoException if cleanup fails
     */
    fun clearService(service: String? = null) {
        try {
            storage.clearService(service)
        } catch (e: SensitiveInfoException) {
            throw e
        } catch (e: Exception) {
            throw SensitiveInfoException.KeystoreUnavailable("Failed to clear service: ${e.message}", e)
        }
    }

    /**
     * Internal helper to authenticate with BiometricPrompt.
     *
     * Calls the suspend-based BiometricAuthenticator.authenticate() function
     * which handles the coroutine<->callback bridge internally.
     *
     * @param biometricAuthenticator The authenticator instance
     * @param prompt The authentication prompt configuration
     *
     * @throws SensitiveInfoException if authentication fails or is cancelled
     */
    private suspend fun authenticateBiometric(
        biometricAuthenticator: BiometricAuthenticator,
        prompt: AuthenticationPrompt
    ) {
        // Create a dummy cipher for the crypto object
        // (not used since we just need to trigger authentication)
        val cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
        
        // Call the suspend function which handles all the callback logic
        biometricAuthenticator.authenticate(
            prompt = prompt,
            cipher = cipher,
            allowDeviceCredential = true
        )
    }
}
