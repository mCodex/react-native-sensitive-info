package com.sensitiveinfo.internal.storage

/**
 * StorageResult.kt
 *
 * Data class for returning encrypted secret results from storage operations.
 *
 * **Structure**:
 * - `value`: The decrypted plaintext secret
 * - `metadata`: Information about how the secret was stored (security level, timestamp, etc)
 *
 * **Usage**:
 * This class is returned from:
 * - HybridSensitiveInfo.setItem() - After storing a secret
 * - HybridSensitiveInfo.getItem() - When retrieving a secret
 * - SecureStorage.getItem() - Internal storage layer
 *
 * **Example**:
 * ```kotlin
 * val result = sensitiveInfo.getItem("authToken", "myapp")
 * if (result != null) {
 *     println("Token: ${result.value}")
 *     println("Security Level: ${result.metadata.securityLevel}")
 *     println("Stored at: ${result.metadata.timestamp}")
 * }
 * ```
 *
 * @property value The decrypted secret value (plaintext)
 * @property metadata Information about storage (security level, access control, timestamp, etc)
 *
 * @see StorageMetadata for metadata details
 */
data class StorageResult(
    /**
     * The decrypted plaintext secret value.
     *
     * This is the original string that was encrypted and stored.
     * Only populated for retrieval operations (getItem).
     * Empty or omitted for storage operations (setItem).
     *
     * @example "jwt-token-xyz" or "api-key-secret"
     */
    val value: String,

    /**
     * Metadata about how and when the secret was stored.
     *
     * Contains:
     * - securityLevel: How the secret was protected ("strongBox", "biometry", "deviceCredential", "software")
     * - accessControl: The access control policy used
     * - backend: Storage backend used ("preferences" for SharedPreferences)
     * - timestamp: Unix timestamp (seconds) when the secret was stored
     */
    val metadata: StorageMetadata
)
