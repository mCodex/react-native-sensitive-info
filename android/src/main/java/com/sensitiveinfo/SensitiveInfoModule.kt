package com.sensitiveinfo

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.Arguments
import com.sensitiveinfo.internal.HybridSensitiveInfo
import com.sensitiveinfo.internal.auth.AuthenticationPrompt
import com.sensitiveinfo.internal.util.SensitiveInfoException
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * SensitiveInfoModule.kt
 *
 * React Native bridge module for secure storage with biometric authentication.
 *
 * **Architecture**:
 * - Implements the React Native TurboModule interface
 * - Acts as a bridge between JavaScript and native Android code
 * - Delegates all storage logic to HybridSensitiveInfo
 * - Uses coroutines for async operations with proper thread handling
 *
 * **Key Features**:
 * - ✅ Biometric-protected storage (Face ID, Touch ID, Fingerprint)
 * - ✅ Device credential fallback (PIN, Pattern, Password)
 * - ✅ AES-256-GCM encryption with hardware-backed keys
 * - ✅ Support for Android 9+ (API 28+)
 * - ✅ Fabric Architecture compatible (New React Native)
 * - ✅ Comprehensive error handling with specific error codes
 *
 * **Exposed Methods**:
 * - setItem(key, value, options, promise) → Store encrypted value
 * - getItem(key, options, promise) → Retrieve and decrypt value
 * - deleteItem(key, options, promise) → Delete stored value
 * - hasItem(key, options, promise) → Check if key exists
 * - getAllItems(options, promise) → List all keys in service
 * - clearService(options, promise) → Delete all values in service
 *
 * **Error Codes** (mapped to JavaScript):
 * - E_NOT_FOUND: Secret key not found
 * - E_KEY_INVALIDATED: Key was invalidated (biometric enrollment changed)
 * - E_AUTH_CANCELED: User canceled biometric authentication
 * - E_AUTH_FAILED: Biometric authentication failed (wrong fingerprint, etc)
 * - E_BIOMETRY_LOCKOUT: Biometric locked (too many failed attempts)
 * - E_KEYSTORE_UNAVAILABLE: Android KeyStore not accessible
 * - E_ENCRYPTION_FAILED: Encryption operation failed
 * - E_DECRYPTION_FAILED: Decryption operation failed
 * - E_INVALID_CONFIGURATION: Invalid parameter or configuration
 * - E_BIOMETRIC_NOT_AVAILABLE: Device doesn't support biometric
 * - E_ACTIVITY_UNAVAILABLE: Activity context not available
 * - E_UNKNOWN_ERROR: Unexpected error
 *
 * **Usage from JavaScript**:
 * ```typescript
 * import { NativeModules } from 'react-native';
 * const { SensitiveInfo } = NativeModules;
 *
 * // Store with biometric protection
 * SensitiveInfo.setItem(
 *     'auth-token',
 *     'jwt-token-xyz',
 *     {
 *         service: 'myapp',
 *         accessControl: 'secureEnclaveBiometry',
 *         authenticationPrompt: {
 *             title: 'Authenticate',
 *             subtitle: 'Please scan your fingerprint',
 *             description: 'Required to store your token'
 *         }
 *     },
 *     (result) => {
 *         console.log('Stored:', result.securityLevel);
 *     },
 *     (error) => {
 *         console.error('Failed:', error.code, error.message);
 *     }
 * );
 *
 * // Retrieve stored value
 * SensitiveInfo.getItem(
 *     'auth-token',
 *     { service: 'myapp' },
 *     (result) => {
 *         console.log('Token:', result.value);
 *     },
 *     (error) => {
 *         if (error.code === 'E_NOT_FOUND') {
 *             console.log('Token not stored yet');
 *         }
 *     }
 * );
 * ```
 *
 * @property reactContext The React application context
 * @see HybridSensitiveInfo for storage implementation details
 * @see BiometricAuthenticator for authentication implementation
 * @see CryptoManager for encryption/decryption
 */
class SensitiveInfoModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val sensitiveInfo: HybridSensitiveInfo
    private val coroutineScope = CoroutineScope(Dispatchers.Main)

    init {
        val activity = reactContext.currentActivity as? FragmentActivity
        sensitiveInfo = HybridSensitiveInfo(
            context = reactContext,
            activity = activity
        )
    }

    override fun getName(): String = "SensitiveInfo"

    /**
     * Stores a secret in secure storage with optional biometric protection.
     *
     * **Security Workflow**:
     * 1. Parse and validate options (service, accessControl, authenticationPrompt)
     * 2. Delegate to HybridSensitiveInfo.setItem() (suspend function)
     * 3. If biometric configured: BiometricAuthenticator shows system prompt
     * 4. User authenticates via Face ID, Fingerprint, or Device Credential
     * 5. On success: Value is encrypted with AES-256-GCM and stored
     * 6. On error: Appropriate exception is caught and mapped to error code
     * 7. Metadata returned to JavaScript
     *
     * **Thread Model**:
     * - Executed on Dispatchers.Main for UI interactions (biometric prompt)
     * - Coroutine-safe (suspend function compatible)
     * - Non-blocking JS thread
     *
     * **Android 9 Special Handling**:
     * - On API 28: Biometric prompt requires manual initialization via BiometricPrompt API
     * - DeviceCredentialPromptFragment provides fallback for older devices
     * - See BiometricAuthenticator for implementation details
     *
     * **Options Object** (JavaScript):
     * ```javascript
     * {
     *     // Optional namespace for secrets (defaults to app package name)
     *     service: 'myapp',
     *
     *     // Security policy: 'secureEnclaveBiometry', 'biometryCurrentSet', 'biometryAny',
     *     // 'devicePasscode', 'none'
     *     accessControl: 'secureEnclaveBiometry',
     *
     *     // Optional: Custom biometric prompt messages (Android 9+)
     *     authenticationPrompt: {
     *         title: 'Authenticate',
     *         subtitle: 'Please scan your fingerprint',
     *         description: 'Required to store authentication token',
     *         cancel: 'Cancel'
     *     }
     * }
     * ```
     *
     * **Return Value** (JavaScript):
     * ```javascript
     * {
     *     // Actual security level applied ("strongBox", "biometry", "deviceCredential", "software")
     *     securityLevel: 'biometry',
     *
     *     // Access control policy that was used
     *     accessControl: 'secureEnclaveBiometry',
     *
     *     // Storage backend ("preferences" = SharedPreferences)
     *     backend: 'preferences',
     *
     *     // UNIX timestamp (seconds) when stored
     *     timestamp: 1697942400
     * }
     * ```
     *
     * **Error Cases**:
     * - E_ENCRYPTION_FAILED: AES encryption failed or key generation failed
     * - E_BIOMETRY_LOCKOUT: Too many failed biometric attempts
     * - E_AUTH_CANCELED: User canceled biometric prompt
     * - E_ACTIVITY_UNAVAILABLE: Fragment activity not available (biometric required)
     * - E_INVALID_CONFIGURATION: Invalid key or value (empty strings)
     * - E_KEYSTORE_UNAVAILABLE: Android KeyStore not accessible
     * - E_UNKNOWN_ERROR: Unexpected error (shouldn't happen)
     *
     * **Example from JavaScript**:
     * ```javascript
     * // Simple storage without biometric
     * NativeModules.SensitiveInfo.setItem(
     *     'apiKey',
     *     'secret-api-key-xyz',
     *     { service: 'myapp' },
     *     (result) => console.log('Stored:', result.securityLevel),
     *     (error) => console.error('Error:', error.code, error.message)
     * );
     *
     * // Storage with biometric authentication (Android 9+)
     * NativeModules.SensitiveInfo.setItem(
     *     'authToken',
     *     'jwt-token-abc-123',
     *     {
     *         service: 'myapp',
     *         accessControl: 'secureEnclaveBiometry',
     *         authenticationPrompt: {
     *             title: 'Authenticate',
     *             subtitle: 'Verify your identity',
     *             description: 'Tap your fingerprint to store the auth token',
     *             cancel: 'Cancel'
     *         }
     *     },
     *     (result) => console.log('Token stored securely!'),
     *     (error) => {
     *         if (error.code === 'E_BIOMETRY_LOCKOUT') {
     *             console.error('Biometric locked. Try again later.');
     *         } else if (error.code === 'E_AUTH_CANCELED') {
     *             console.log('User canceled authentication');
     *         } else {
     *             console.error('Storage failed:', error.message);
     *         }
     *     }
     * );
     * ```
     *
     * @param key Unique identifier for the secret (e.g., 'auth-token', 'apiKey')
     * @param value The plaintext value to encrypt and store (will be UTF-8 encoded)
     * @param options Optional configuration object (service, accessControl, authenticationPrompt)
     * @param promise React Native promise for async result callback
     *
     * @see HybridSensitiveInfo.setItem for implementation
     * @see BiometricAuthenticator for authentication flow
     * @see CryptoManager for encryption details
     */
    @ReactMethod
    fun setItem(
        key: String,
        value: String,
        options: ReadableMap?,
        promise: Promise
    ) {
        coroutineScope.launch {
            try {
                // Parse options from JavaScript
                val service = options?.getString("service")
                val accessControl = options?.getString("accessControl")
                val authPromptMap = options?.getMap("authenticationPrompt")
                val authenticationPrompt = authPromptMap?.let {
                    AuthenticationPrompt(
                        title = it.getString("title") ?: "Authenticate",
                        subtitle = it.getString("subtitle"),
                        description = it.getString("description"),
                        cancel = it.getString("cancel")
                    )
                }

                // Perform encryption and storage (suspend function)
                val result = sensitiveInfo.setItem(
                    key = key,
                    value = value,
                    service = service,
                    accessControl = accessControl,
                    authenticationPrompt = authenticationPrompt
                )

                // Prepare result map for JavaScript
                val resultMap = Arguments.createMap().apply {
                    putString("securityLevel", result.metadata.securityLevel)
                    putString("accessControl", result.metadata.accessControl)
                    putString("backend", result.metadata.backend)
                    putDouble("timestamp", result.metadata.timestamp.toDouble())
                }

                promise.resolve(resultMap)
            } catch (e: SensitiveInfoException) {
                // Map exception to error code for JavaScript
                promise.reject(e.code, e.message)
            } catch (e: Exception) {
                // Catch unexpected errors
                promise.reject("E_UNKNOWN_ERROR", e.message ?: "Unknown error")
            }
        }
    }

    /**
     * Retrieves and decrypts a stored secret.
     *
     * **Security Workflow**:
     * 1. Parse options (service namespace)
     * 2. Look up secret in SecureStorage
     * 3. Check if biometric protection was applied during storage
     * 4. If biometric required: Android OS automatically shows biometric prompt
     *    (triggered internally by AndroidKeyStore, not by this code)
     * 5. After authentication: Decrypt AES-256-GCM ciphertext
     * 6. Return plaintext value and metadata
     *
     * **Android Biometric Behavior**:
     * - Unlike iOS where we explicitly call authenticate(),
     *   on Android the biometric prompt is triggered automatically
     *   when accessing a biometric-protected AndroidKeyStore key
     * - The user doesn't see any additional prompt - it's handled by AndroidKeyStore
     * - If user cancels or fails, an exception is thrown
     *
     * **Thread Model**:
     * - Executed on Dispatchers.Main
     * - Coroutine-safe (suspend function compatible)
     * - May show system biometric prompt (non-blocking)
     *
     * **Options Object** (JavaScript):
     * ```javascript
     * {
     *     // Optional namespace (defaults to app package name)
     *     service: 'myapp'
     * }
     * ```
     *
     * **Return Value on Success** (JavaScript):
     * ```javascript
     * {
     *     // The decrypted plaintext value
     *     value: 'jwt-token-xyz',
     *
     *     // Metadata about how the value was stored
     *     metadata: {
     *         securityLevel: 'biometry',        // How it was protected
     *         accessControl: 'secureEnclaveBiometry',
     *         backend: 'preferences',
     *         timestamp: 1697942400            // When it was stored
     *     }
     * }
     * ```
     *
     * **Error Cases**:
     * - E_NOT_FOUND: Key doesn't exist (normal case)
     * - E_DECRYPTION_FAILED: Decryption failed (corruption or wrong key)
     * - E_KEY_INVALIDATED: Biometric enrollment changed after storage
     * - E_BIOMETRY_LOCKOUT: Too many failed biometric attempts
     * - E_AUTH_CANCELED: User canceled biometric authentication
     * - E_KEYSTORE_UNAVAILABLE: Key not found in AndroidKeyStore
     * - E_UNKNOWN_ERROR: Unexpected error
     *
     * **Example from JavaScript**:
     * ```javascript
     * // Retrieve token
     * NativeModules.SensitiveInfo.getItem(
     *     'authToken',
     *     { service: 'myapp' },
     *     (result) => {
     *         console.log('Token retrieved:', result.value);
     *         console.log('Security level:', result.metadata.securityLevel);
     *         console.log('Stored at:', new Date(result.metadata.timestamp * 1000));
     *     },
     *     (error) => {
     *         if (error.code === 'E_NOT_FOUND') {
     *             console.log('No token stored yet');
     *         } else if (error.code === 'E_KEY_INVALIDATED') {
     *             console.log('Stored biometric no longer valid (enrollment changed)');
     *         } else if (error.code === 'E_BIOMETRY_LOCKOUT') {
     *             console.log('Biometric locked. Try again later.');
     *         } else {
     *             console.error('Retrieval failed:', error.message);
     *         }
     *     }
     * );
     * ```
     *
     * @param key Secret identifier to retrieve
     * @param options Optional configuration object (service)
     * @param promise React Native promise for async result callback
     *
     * @see HybridSensitiveInfo.getItem for implementation
     * @see CryptoManager for decryption details
     */
    @ReactMethod
    fun getItem(
        key: String,
        options: ReadableMap?,
        promise: Promise
    ) {
        coroutineScope.launch {
            try {
                // Parse options from JavaScript
                val service = options?.getString("service")

                // Retrieve the value (may trigger biometric prompt)
                val result = sensitiveInfo.getItem(key, service)

                if (result != null) {
                    // Prepare result map with value and metadata
                    val resultMap = Arguments.createMap().apply {
                        putString("value", result.value)

                        val metadataMap = Arguments.createMap().apply {
                            putString("securityLevel", result.metadata.securityLevel)
                            putString("accessControl", result.metadata.accessControl)
                            putString("backend", result.metadata.backend)
                            putDouble("timestamp", result.metadata.timestamp.toDouble())
                        }
                        putMap("metadata", metadataMap)
                    }

                    promise.resolve(resultMap)
                } else {
                    // Not found - reject with E_NOT_FOUND
                    promise.reject(
                        "E_NOT_FOUND",
                        "Secret '$key' not found in service '$service'"
                    )
                }
            } catch (e: SensitiveInfoException) {
                // Map known exception to error code
                promise.reject(e.code, e.message)
            } catch (e: Exception) {
                // Catch unexpected errors
                promise.reject("E_UNKNOWN_ERROR", e.message ?: "Unknown error")
            }
        }
    }

    /**
     * Deletes a stored secret and its associated encryption key.
     *
     * **Security Operation**:
     * 1. Remove secret from SharedPreferences
     * 2. Delete associated key from Android KeyStore
     * 3. Key deletion is permanent and irreversible
     *
     * **Thread Model**:
     * - Synchronous operation (blocking)
     * - No biometric prompt required
     * - Key deletion happens immediately
     *
     * **Options Object** (JavaScript):
     * ```javascript
     * {
     *     service: 'myapp'  // Optional: namespace (defaults to app package)
     * }
     * ```
     *
     * **Return Value**:
     * - null on success
     * - promise.reject on error
     *
     * **Error Cases**:
     * - E_KEYSTORE_UNAVAILABLE: Failed to delete key from keystore
     * - E_UNKNOWN_ERROR: Unexpected error
     *
     * **Important Notes**:
     * - After deletion, the ciphertext becomes inaccessible
     * - The associated key is permanently removed from the device
     * - This is irreversible - there's no way to recover the secret after deletion
     * - If deletion fails for the key, the SharedPreferences entry is still removed
     *
     * **Example from JavaScript**:
     * ```javascript
     * NativeModules.SensitiveInfo.deleteItem(
     *     'authToken',
     *     { service: 'myapp' },
     *     () => console.log('Token deleted'),
     *     (error) => console.error('Deletion failed:', error.message)
     * );
     * ```
     *
     * @param key Secret identifier to delete
     * @param options Optional configuration object (service)
     * @param promise React Native promise for async result callback
     *
     * @see HybridSensitiveInfo.deleteItem for implementation
     */
    @ReactMethod
    fun deleteItem(
        key: String,
        options: ReadableMap?,
        promise: Promise
    ) {
        try {
            // Parse options from JavaScript
            val service = options?.getString("service")

            // Delete the item from storage and keystore
            sensitiveInfo.deleteItem(key, service)

            promise.resolve(null)
        } catch (e: SensitiveInfoException) {
            // Map known exception to error code
            promise.reject(e.code, e.message)
        } catch (e: Exception) {
            // Catch unexpected errors
            promise.reject("E_UNKNOWN_ERROR", e.message ?: "Unknown error")
        }
    }

    /**
     * Checks if a secret exists without retrieving it.
     *
     * **Purpose**:
     * - Quick existence check without triggering biometric prompt
     * - Useful for UI logic (show "Sign In" vs "Sign Out")
     * - No decryption happens, so no biometric required
     *
     * **Thread Model**:
     * - Synchronous operation (blocking)
     * - No biometric prompt
     * - Local preferences lookup only
     *
     * **Options Object** (JavaScript):
     * ```javascript
     * {
     *     service: 'myapp'  // Optional: namespace (defaults to app package)
     * }
     * ```
     *
     * **Return Value**:
     * - true if the secret exists
     * - false if not found or on any error
     *
     * **Example from JavaScript**:
     * ```javascript
     * NativeModules.SensitiveInfo.hasItem(
     *     'authToken',
     *     { service: 'myapp' },
     *     (hasToken) => {
     *         if (hasToken) {
     *             console.log('Token is stored');
     *         } else {
     *             console.log('Token not found, need to login');
     *         }
     *     }
     * );
     * ```
     *
     * @param key Secret identifier to check
     * @param options Optional configuration object (service)
     * @param promise React Native promise returning boolean
     *
     * @see HybridSensitiveInfo.hasItem for implementation
     */
    @ReactMethod
    fun hasItem(
        key: String,
        options: ReadableMap?,
        promise: Promise
    ) {
        try {
            // Parse options from JavaScript
            val service = options?.getString("service")

            // Check existence (fast, no decryption)
            val exists = sensitiveInfo.hasItem(key, service)

            promise.resolve(exists)
        } catch (e: Exception) {
            // On any error, return false (safe default)
            promise.resolve(false)
        }
    }

    /**
     * Retrieves all secret keys in a service namespace.
     *
     * **Important**: Only returns KEY NAMES, not the actual values.
     * Values must be retrieved individually using getItem().
     *
     * **Thread Model**:
     * - Synchronous operation (blocking)
     * - No biometric prompt
     * - Local preferences lookup only
     *
     * **Options Object** (JavaScript):
     * ```javascript
     * {
     *     service: 'myapp'  // Optional: namespace (defaults to app package)
     * }
     * ```
     *
     * **Return Value** (JavaScript):
     * ```javascript
     * // Array of key names
     * ['authToken', 'refreshToken', 'apiKey']
     * ```
     *
     * **Example from JavaScript**:
     * ```javascript
     * NativeModules.SensitiveInfo.getAllItems(
     *     { service: 'myapp' },
     *     (keys) => {
     *         console.log('Stored secrets:', keys);
     *         // Usage: keys.forEach(key => NativeModules.SensitiveInfo.getItem(key, ...))
     *     },
     *     (error) => console.error('Failed to list keys:', error.message)
     * );
     * ```
     *
     * @param options Optional configuration object (service)
     * @param promise React Native promise returning string array
     *
     * @see HybridSensitiveInfo.getAllItems for implementation
     */
    @ReactMethod
    fun getAllItems(
        options: ReadableMap?,
        promise: Promise
    ) {
        try {
            // Parse options from JavaScript
            val service = options?.getString("service")

            // Get all keys in this service
            val keys = sensitiveInfo.getAllItems(service)

            val array = Arguments.createArray().apply {
                keys.forEach { pushString(it) }
            }

            promise.resolve(array)
        } catch (e: Exception) {
            // On any error, return empty array
            promise.resolve(Arguments.createArray())
        }
    }

    /**
     * Deletes ALL secrets in a service namespace.
     *
     * **⚠️ WARNING**: This is IRREVERSIBLE! All secrets in the service will be deleted.
     *
     * **Security Operation**:
     * 1. Find all secrets in the service namespace
     * 2. Delete each secret from SharedPreferences
     * 3. Delete associated keys from Android KeyStore
     * 4. All data loss is permanent
     *
     * **Thread Model**:
     * - Synchronous operation (blocking)
     * - No biometric prompt required
     * - May take a few milliseconds for large numbers of keys
     *
     * **Options Object** (JavaScript):
     * ```javascript
     * {
     *     service: 'myapp'  // Optional: namespace (defaults to app package)
     * }
     * ```
     *
     * **Use Cases**:
     * - User logout: Clear all auth tokens
     * - Data migration: Clear old data before syncing
     * - Testing: Clear test data between test runs
     * - App uninstall: Clear everything (happens automatically)
     *
     * **Error Cases**:
     * - E_KEYSTORE_UNAVAILABLE: Failed to clean up keys
     * - E_UNKNOWN_ERROR: Unexpected error
     *
     * **Example from JavaScript**:
     * ```javascript
     * // Clear all secrets on logout
     * NativeModules.SensitiveInfo.clearService(
     *     { service: 'myapp' },
     *     () => console.log('All secrets cleared on logout'),
     *     (error) => console.error('Cleanup failed:', error.message)
     * );
     * ```
     *
     * @param options Optional configuration object (service)
     * @param promise React Native promise for completion callback
     *
     * @see HybridSensitiveInfo.clearService for implementation
     */
    @ReactMethod
    fun clearService(
        options: ReadableMap?,
        promise: Promise
    ) {
        try {
            // Parse options from JavaScript
            val service = options?.getString("service")

            // Clear all items in service (IRREVERSIBLE!)
            sensitiveInfo.clearService(service)

            promise.resolve(null)
        } catch (e: SensitiveInfoException) {
            // Map known exception to error code
            promise.reject(e.code, e.message)
        } catch (e: Exception) {
            // Catch unexpected errors
            promise.reject("E_UNKNOWN_ERROR", e.message ?: "Unknown error")
        }
    }
}
