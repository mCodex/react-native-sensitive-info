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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * SensitiveInfoModule.kt
 *
 * React Native bridge module for secure storage with biometric authentication.
 *
 * Exposes the following methods to JavaScript:
 * - setItem(key, value, options, promise)
 * - getItem(key, options, promise)
 * - deleteItem(key, options, promise)
 * - hasItem(key, options, promise)
 * - getAllItems(options, promise)
 * - clearService(options, promise)
 *
 * **Error Handling**:
 * Each method has an error code and message that map to JavaScript exceptions.
 * Common error codes:
 * - E_BIOMETRIC_NOT_AVAILABLE: Device doesn't support biometric
 * - E_BIOMETRIC_LOCKOUT: Too many failed attempts
 * - E_USER_CANCELLED: User cancelled authentication
 * - E_ENCRYPTION_FAILED: Encryption/storage failed
 * - E_DECRYPTION_FAILED: Decryption failed
 * - E_ACTIVITY_UNAVAILABLE: Activity context not available
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
 * @see HybridSensitiveInfo for storage implementation
 * @see BiometricAuthenticator for authentication
 */
class SensitiveInfoModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val sensitiveInfo = HybridSensitiveInfo(reactContext)
    private val coroutineScope = CoroutineScope(Dispatchers.Main)

    override fun getName(): String = "SensitiveInfo"

    /**
     * Stores a secret in secure storage with optional biometric protection.
     *
     * **Workflow**:
     * 1. Parse options for service, accessControl, and authenticationPrompt
     * 2. Call HybridSensitiveInfo.setItem()
     * 3. If biometric is configured: Show biometric prompt
     * 4. After authentication: Store encrypted value
     * 5. Return metadata to JavaScript
     *
     * **Options**:
     * ```kotlin
     * {
     *     "service": String? = null,  // Namespace for secrets (defaults to app package)
     *     "accessControl": String? = null,  // Security policy ("secureEnclaveBiometry", etc)
     *     "authenticationPrompt": {
     *         "title": String,
     *         "subtitle": String? = null,
     *         "description": String? = null,
     *         "cancel": String? = null
     *     }
     * }
     * ```
     *
     * **Result**:
     * ```kotlin
     * {
     *     "securityLevel": String,  // "biometry", "deviceCredential", or "software"
     *     "accessControl": String,  // Policy used
     *     "backend": String,  // "preferences"
     *     "timestamp": Number  // Unix timestamp
     * }
     * ```
     *
     * @param key Secret identifier
     * @param value Secret value to store
     * @param options Configuration options
     * @param promise Callback for success/error
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
                // Parse options
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

                // Store the value
                val result = sensitiveInfo.setItem(
                    key = key,
                    value = value,
                    service = service,
                    accessControl = accessControl,
                    authenticationPrompt = authenticationPrompt
                )

                // Return metadata to JavaScript
                val resultMap = Arguments.createMap().apply {
                    putString("securityLevel", result.metadata.securityLevel)
                    putString("accessControl", result.metadata.accessControl)
                    putString("backend", result.metadata.backend)
                    putDouble("timestamp", result.metadata.timestamp.toDouble())
                }

                promise.resolve(resultMap)
            } catch (e: SensitiveInfoException) {
                // Return error with code and message
                promise.reject(e.code, e.message)
            } catch (e: Exception) {
                promise.reject("E_UNKNOWN_ERROR", e.message ?: "Unknown error")
            }
        }
    }

    /**
     * Retrieves and decrypts a stored secret.
     *
     * **Options**:
     * ```kotlin
     * {
     *     "service": String? = null  // Namespace for secrets (defaults to app package)
     * }
     * ```
     *
     * **Result** (on success):
     * ```kotlin
     * {
     *     "value": String,  // Decrypted secret
     *     "metadata": {
     *         "securityLevel": String,  // How it was protected
     *         "accessControl": String,  // Policy used
     *         "backend": String,  // "preferences"
     *         "timestamp": Number  // When it was stored
     *     }
     * }
     * ```
     *
     * **Error** (on not found):
     * - error.code = "E_NOT_FOUND"
     *
     * @param key Secret identifier
     * @param options Configuration options
     * @param promise Callback for success/error
     */
    @ReactMethod
    fun getItem(
        key: String,
        options: ReadableMap?,
        promise: Promise
    ) {
        coroutineScope.launch {
            try {
                // Parse options
                val service = options?.getString("service")

                // Retrieve the value
                val result = sensitiveInfo.getItem(key, service)

                if (result != null) {
                    // Return value and metadata
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
                    // Not found - reject with special code
                    promise.reject(
                        "E_NOT_FOUND",
                        "Secret '$key' not found in service '$service'"
                    )
                }
            } catch (e: SensitiveInfoException) {
                promise.reject(e.code, e.message)
            } catch (e: Exception) {
                promise.reject("E_UNKNOWN_ERROR", e.message ?: "Unknown error")
            }
        }
    }

    /**
     * Deletes a stored secret.
     *
     * @param key Secret identifier
     * @param options Configuration options
     * @param promise Callback for success/error
     */
    @ReactMethod
    fun deleteItem(
        key: String,
        options: ReadableMap?,
        promise: Promise
    ) {
        try {
            // Parse options
            val service = options?.getString("service")

            // Delete the item
            sensitiveInfo.deleteItem(key, service)

            promise.resolve(null)
        } catch (e: SensitiveInfoException) {
            promise.reject(e.code, e.message)
        } catch (e: Exception) {
            promise.reject("E_UNKNOWN_ERROR", e.message ?: "Unknown error")
        }
    }

    /**
     * Checks if a secret exists.
     *
     * @param key Secret identifier
     * @param options Configuration options
     * @param promise Callback with boolean result
     */
    @ReactMethod
    fun hasItem(
        key: String,
        options: ReadableMap?,
        promise: Promise
    ) {
        try {
            // Parse options
            val service = options?.getString("service")

            // Check if exists
            val exists = sensitiveInfo.hasItem(key, service)

            promise.resolve(exists)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    /**
     * Retrieves all secret keys in a service.
     *
     * Does NOT return the actual values, only key names.
     *
     * @param options Configuration options
     * @param promise Callback with list of keys
     */
    @ReactMethod
    fun getAllItems(
        options: ReadableMap?,
        promise: Promise
    ) {
        try {
            // Parse options
            val service = options?.getString("service")

            // Get all keys
            val keys = sensitiveInfo.getAllItems(service)

            val array = Arguments.createArray().apply {
                keys.forEach { pushString(it) }
            }

            promise.resolve(array)
        } catch (e: Exception) {
            promise.resolve(Arguments.createArray())
        }
    }

    /**
     * Deletes all secrets in a service namespace.
     *
     * **Warning**: This is irreversible!
     *
     * @param options Configuration options
     * @param promise Callback for success/error
     */
    @ReactMethod
    fun clearService(
        options: ReadableMap?,
        promise: Promise
    ) {
        try {
            // Parse options
            val service = options?.getString("service")

            // Clear all items in service
            sensitiveInfo.clearService(service)

            promise.resolve(null)
        } catch (e: SensitiveInfoException) {
            promise.reject(e.code, e.message)
        } catch (e: Exception) {
            promise.reject("E_UNKNOWN_ERROR", e.message ?: "Unknown error")
        }
    }
}
