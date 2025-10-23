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
    val accessControl: String,      // "secureEnclaveBiometry", "devicePasscode", etc
    val version: Int? = null,
    val authenticators: Int? = null,
    val requiresAuthentication: Boolean? = null,
    val invalidateOnEnrollment: Boolean? = null,
    val useStrongBox: Boolean? = null
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
        val builder = StringBuilder()
        builder.append('{')
        builder.append("\"key\":\"").append(key).append('\"')
        builder.append(',').append("\"service\":\"").append(service).append('\"')
        builder.append(',').append("\"ciphertext\":\"").append(ciphertext).append('\"')
        builder.append(',').append("\"iv\":\"").append(iv).append('\"')
        builder.append(',').append("\"timestamp\":").append(timestamp)
        builder.append(',').append("\"securityLevel\":\"").append(securityLevel).append('\"')
        builder.append(',').append("\"accessControl\":\"").append(accessControl).append('\"')
        version?.let { builder.append(',').append("\"version\":").append(it) }
        authenticators?.let { builder.append(',').append("\"authenticators\":").append(it) }
        requiresAuthentication?.let {
            builder.append(',').append("\"requiresAuthentication\":").append(it)
        }
        invalidateOnEnrollment?.let {
            builder.append(',').append("\"invalidateOnEnrollment\":").append(it)
        }
        useStrongBox?.let { builder.append(',').append("\"useStrongBox\":").append(it) }
        builder.append('}')
        return builder.toString()
    }

    companion object {
        /**
         * Parses JSON back to PersistedEntry.
         *
         * Uses manual JSON parsing (no external dependencies) for reliability.
         *
         * @param json JSON string
         * @return Parsed entry, or null if parsing fails
         */
        fun fromJson(json: String): PersistedEntry? {
            return try {
                // Manual JSON parsing to avoid external dependencies
                val cleanJson = json.trim()
                if (!cleanJson.startsWith("{") || !cleanJson.endsWith("}")) {
                    return null
                }

                // Extract fields using regex
                val keyMatch = "\"key\":\"([^\"]*)\"".toRegex().find(cleanJson)?.groupValues?.get(1) ?: return null
                val serviceMatch = "\"service\":\"([^\"]*)\"".toRegex().find(cleanJson)?.groupValues?.get(1) ?: return null
                val ciphertextMatch = "\"ciphertext\":\"([^\"]*)\"".toRegex().find(cleanJson)?.groupValues?.get(1) ?: return null
                val ivMatch = "\"iv\":\"([^\"]*)\"".toRegex().find(cleanJson)?.groupValues?.get(1) ?: return null
                val timestampMatch = "\"timestamp\":(\\d+)".toRegex().find(cleanJson)?.groupValues?.get(1)?.toLong() ?: return null
                val securityLevelMatch = "\"securityLevel\":\"([^\"]*)\"".toRegex().find(cleanJson)?.groupValues?.get(1) ?: return null
                val accessControlMatch = "\"accessControl\":\"([^\"]*)\"".toRegex().find(cleanJson)?.groupValues?.get(1) ?: return null
                val versionMatch = "\"version\":(\\d+)".toRegex().find(cleanJson)?.groupValues?.get(1)?.toInt()
                val authenticatorsMatch = "\"authenticators\":(\\d+)".toRegex().find(cleanJson)?.groupValues?.get(1)?.toInt()
                val requiresAuthMatch = "\"requiresAuthentication\":(true|false)".toRegex().find(cleanJson)?.groupValues?.get(1)?.toBoolean()
                val invalidateMatch = "\"invalidateOnEnrollment\":(true|false)".toRegex().find(cleanJson)?.groupValues?.get(1)?.toBoolean()
                val strongBoxMatch = "\"useStrongBox\":(true|false)".toRegex().find(cleanJson)?.groupValues?.get(1)?.toBoolean()

                PersistedEntry(
                    key = keyMatch,
                    service = serviceMatch,
                    ciphertext = ciphertextMatch,
                    iv = ivMatch,
                    timestamp = timestampMatch,
                    securityLevel = securityLevelMatch,
                    accessControl = accessControlMatch,
                    version = versionMatch,
                    authenticators = authenticatorsMatch,
                    requiresAuthentication = requiresAuthMatch,
                    invalidateOnEnrollment = invalidateMatch,
                    useStrongBox = strongBoxMatch
                )
            } catch (e: Exception) {
                null
            }
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
