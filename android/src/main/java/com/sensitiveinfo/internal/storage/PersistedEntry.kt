package com.sensitiveinfo.internal.storage

import android.util.Base64
import java.io.Serializable

/**
 * Persisted data model for a stored secret.
 *
 * Represents everything needed to decrypt a stored secret:
 * - Ciphertext (encrypted data)
 * - IV (initialization vector)
 * - Metadata (when stored, what security level, etc)
 *
 * **Storage Format (JSON)**:
 * ```json
 * {
 *   "key": "auth-token",
 *   "service": "myapp",
 *   "ciphertext": "X7kL9mQ4pJ2vT8xR5nC1...",
 *   "iv": "9P6xL5K3mN8xQ2vV7dA9",
 *   "timestamp": 1697942400,
 *   "securityLevel": "biometry",
 *   "accessControl": "secureEnclaveBiometry"
 * }
 * ```
 *
 * @property key Unique key identifier (e.g., "auth-token")
 * @property service Service namespace (e.g., "myapp")
 * @property ciphertext Base64-encoded AES-GCM ciphertext
 * @property iv Base64-encoded initialization vector (12 bytes)
 * @property timestamp UNIX timestamp when stored (seconds)
 * @property securityLevel Actual security level applied
 * @property accessControl Requested access control policy
 */
data class PersistedEntry(
    val key: String,
    val service: String,
    val ciphertext: String,  // Base64-encoded
    val iv: String,           // Base64-encoded
    val timestamp: Long,
    val securityLevel: String,      // "biometry", "deviceCredential", "software"
    val accessControl: String       // "secureEnclaveBiometry", "devicePasscode", etc
) : Serializable {

    /**
     * Unique storage key combining service + key.
     *
     * Used as the SharedPreferences key to store/retrieve this entry.
     */
    fun getStorageKey(): String {
        return "$service::$key"
    }

    /**
     * Serializes to JSON for storage.
     *
     * @return JSON string representation
     */
    fun toJson(): String {
        // TODO: Use proper JSON library (Moshi, Gson, kotlinx.serialization)
        // For now, use simple string concatenation
        return """{
            "key":"$key",
            "service":"$service",
            "ciphertext":"$ciphertext",
            "iv":"$iv",
            "timestamp":$timestamp,
            "securityLevel":"$securityLevel",
            "accessControl":"$accessControl"
        }""".replace(Regex("\\s+"), "")
    }

    companion object {
        /**
         * Parses JSON back to PersistedEntry.
         *
         * @param json JSON string
         * @return Parsed entry, or null if parsing fails
         */
        fun fromJson(json: String): PersistedEntry? {
            // TODO: Implement proper JSON parsing
            return null
        }
    }
}

/**
 * Metadata about the storage environment.
 *
 * Describes what security features are applied to stored data.
 */
data class StorageMetadata(
    val securityLevel: String,           // What was actually achieved
    val accessControl: String,           // What was requested
    val backend: String,                 // "keystore", "preferences", etc
    val timestamp: Long,                 // When was it stored
    val isSynchronizable: Boolean = false  // iOS/Android specific
)
