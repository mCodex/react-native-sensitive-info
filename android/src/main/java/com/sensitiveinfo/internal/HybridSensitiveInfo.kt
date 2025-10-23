package com.sensitiveinfo.internal

import android.content.Context
import androidx.fragment.app.FragmentActivity
import com.sensitiveinfo.internal.storage.SecureStorage
import com.sensitiveinfo.internal.storage.StorageResult
import com.sensitiveinfo.internal.storage.StorageMetadata
import com.sensitiveinfo.internal.util.SensitiveInfoException
import com.sensitiveinfo.internal.util.ActivityContextHolder
import com.sensitiveinfo.internal.auth.AuthenticationPrompt

/**
 * HybridSensitiveInfo.kt
 *
 * Unified API for secure storage with biometric authentication on Android.
 *
 * This is the Android equivalent of iOS's HybridSensitiveInfo.swift,
 * providing a high-level interface that bridges native Android APIs (AndroidKeyStore,
 * BiometricPrompt, SharedPreferences) with React Native's TurboModule system.
 *
 * **Architecture** (Layered Design):
 * ```
 * ┌─────────────────────────────────────┐
 * │  React Native (JavaScript)          │
 * └────────────────┬────────────────────┘
 *                  │
 * ┌────────────────▼────────────────────┐
 * │  SensitiveInfoModule (TurboModule)  │  ← Native bridge
 * │  - Parses JS options                │
 * │  - Manages coroutines               │
 * │  - Returns results to JS            │
 * └────────────────┬────────────────────┘
 *                  │
 * ┌────────────────▼────────────────────┐
 * │  HybridSensitiveInfo (YOU ARE HERE) │  ← High-level API
 * │  - Validates inputs                 │
 * │  - Coordinates biometric + storage  │
 * │  - Maps between domains             │
 * └────────────────┬────────────────────┘
 *                  │
 * ┌─────────────┬──▼──┬─────────────────┐
 * │ SecureStore │ Bio │ Exception       │  ← Implementation details
 * │ - Encrypt   │Auth │ - Maps errors   │
 * │ - Decrypt   │     │   to JS codes   │
 * │ - Persist   │     │                 │
 * └─────────────┴─────┴─────────────────┘
 * ```
 *
 * **Key Differences from iOS**:
 * - iOS: Keychain automatically shows biometric prompt during retrieval
 * - Android: Must explicitly show BiometricPrompt during storage (setItem)
 * - Both: Support custom authentication prompts
 * - Both: Use random IV per operation (semantic security)
 * - Both: Support fallback to device credential
 *
 * **Security Features**:
 * - ✅ AES-256-GCM encryption (authenticated encryption)
 * - ✅ Random IV per operation (no replay attacks)
 * - ✅ Hardware-backed keys (AndroidKeyStore)
 * - ✅ Optional StrongBox (dedicated security processor on API 28+)
 * - ✅ Biometric gating (key only accessible after biometric auth)
 * - ✅ Device credential fallback (PIN, Pattern, Password)
 * - ✅ Automatic key invalidation on biometric enrollment change
 *
 * **Permissions Required** (AndroidManifest.xml):
 * ```xml
 * <!-- Android 11+ (API 30+): Use USE_BIOMETRIC instead -->
 * <uses-permission android:name="android.permission.USE_BIOMETRIC" />
 *
 * <!-- Android 6-10 (API 23-29): Deprecated but still needed for old devices -->
 * <uses-permission android:name="android.permission.USE_FINGERPRINT" />
 * ```
 *
 * **Error Codes** (mapped to JavaScript):
 * - E_NOT_FOUND: Secret not found (normal, not an error)
 * - E_ENCRYPTION_FAILED: Encryption failed (storage, key gen, or IO error)
 * - E_DECRYPTION_FAILED: Decryption failed (corruption, wrong key, or tampering)
 * - E_KEY_INVALIDATED: Biometric enrollment changed after storage
 * - E_BIOMETRY_LOCKOUT: Biometric locked (too many failed attempts)
 * - E_AUTH_CANCELED: User canceled biometric prompt
 * - E_INVALID_CONFIGURATION: Invalid parameter (empty key/value)
 * - E_KEYSTORE_UNAVAILABLE: AndroidKeyStore unavailable or key deleted
 * - E_ACTIVITY_UNAVAILABLE: FragmentActivity not available (needed for biometric)
 *
 * **Suspend Function Design**:
 * - setItem() is a suspend function: May show biometric prompt (blocking until user acts)
 * - getItem() is a suspend function: May show biometric prompt during key access
 * - deleteItem() is synchronous: No biometric needed for deletion
 * - hasItem() is synchronous: Just a local preferences lookup
 *
 * **Example Usage**:
 * ```kotlin
 * // From SensitiveInfoModule
 * val sensitiveInfo = HybridSensitiveInfo(context, fragmentActivity)
 *
 * // Store a secret with biometric protection
 * val result = sensitiveInfo.setItem(
 *     key = "authToken",
 *     value = "jwt-token-xyz",
 *     service = "myapp",
 *     accessControl = "secureEnclaveBiometry",
 *     authenticationPrompt = AuthenticationPrompt(
 *         title = "Authenticate",
 *         subtitle = "Verify your fingerprint",
 *         description = "Required to store authentication token"
 *     )
 * )
 *
 * println("Security level: ${result.metadata.securityLevel}")
 * // Output: "Security level: biometry"
 *
 * // Retrieve the secret (may show biometric prompt)
 * val retrieved = sensitiveInfo.getItem("authToken", "myapp")
 * println("Token: ${retrieved?.value}")
 * ```
 *
 * @property context Android context (for storage and biometric availability checks)
 * @property activity Optional FragmentActivity (required if using biometric)
 *
 * @see SecureStorage for storage implementation
 * @see BiometricAuthenticator for authentication implementation
 * @see CryptoManager for encryption/decryption
 * @see SensitiveInfoException for error types
 */
class HybridSensitiveInfo(
    private val context: Context,
    private val activity: FragmentActivity? = null
) {
    
    /**
     * Delegate for all storage operations.
     *
     * SecureStorage handles:
     * - Encryption/decryption via CryptoManager
     * - Persistence to SharedPreferences
     * - Metadata tracking
     * - Migration of legacy entries
     */
    private val storage = SecureStorage(
        context = context,
        activity = activity
    )

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
     *
     * @return StorageResult with metadata about the stored secret
     *
     * @throws SensitiveInfoException.BiometricNotAvailable if biometric requested but not available
     * @throws SensitiveInfoException.BiometricLockout if too many failed attempts
     * @throws SensitiveInfoException.UserCancelled if user cancels biometric prompt
     * @throws SensitiveInfoException.EncryptionFailed if encryption fails
     * @throws SensitiveInfoException.KeystoreUnavailable if AndroidKeyStore unavailable
     *
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
            // Delegate to storage and await the suspend function
            val storageMetadata = storage.setItem(
                key = key,
                value = value,
                service = service,
                accessControl = accessControl,
                prompt = authenticationPrompt
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
    suspend fun getItem(key: String, service: String? = null): StorageResult? {
        if (key.isEmpty()) {
            throw SensitiveInfoException.InvalidConfiguration("key", "Cannot be empty")
        }

        return try {
            // storage.getItem() already returns StorageResult with metadata
            storage.getItem(key, service)
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
}

