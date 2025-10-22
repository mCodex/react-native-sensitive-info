package com.sensitiveinfo.internal.crypto

/**
 * Result of an encryption operation containing both ciphertext and IV.
 *
 * Since IVs must be randomly generated per encryption operation, the result
 * includes both:
 * - ciphertext: The encrypted data (kept secret)
 * - iv: The initialization vector used (can be stored/sent in plaintext)
 *
 * **Storage Pattern**:
 * ```
 * // Do this: Store IV alongside ciphertext
 * {
 *   "iv": "9P6xL5K3mN8xQ2vV7dA9",          // Base64-encoded
 *   "ciphertext": "X7kL9mQ4pJ2vT8xR5nC1..."  // Base64-encoded
 * }
 *
 * // Not this: Don't store IV separately or try to reuse it
 * ```
 *
 * **Retrieval Pattern**:
 * ```kotlin
 * val stored = loadFromPreferences()  // Contains both iv and ciphertext
 * val iv = IVManager.decodeFromBase64(stored.iv)
 * val ciphertext = Base64.decode(stored.ciphertext, Base64.NO_WRAP)
 * val plaintext = decryptAES(key, ciphertext, iv)
 * ```
 *
 * @property ciphertext Raw encrypted bytes (already includes authentication tag for GCM)
 * @property iv Raw initialization vector bytes (12 bytes for AES-GCM)
 *
 * @see IVManager For IV generation
 * @see CryptoManager For encryption/decryption
 */
data class EncryptionResult(
    /**
     * The encrypted data.
     *
     * For AES-GCM, this includes the authentication tag (16 bytes appended),
     * which protects against tampering.
     *
     * **Security guarantee**: If ciphertext is modified, decryption will FAIL.
     * The authentication tag prevents returning corrupted plaintext.
     */
    val ciphertext: ByteArray,

    /**
     * The initialization vector used for encryption.
     *
     * **Important**: This IV should be stored alongside the ciphertext.
     * Without the IV, the ciphertext cannot be decrypted.
     *
     * **Security**: The IV is NOT secret. It's safe to store in plaintext
     * alongside the ciphertext in SharedPreferences or a database.
     *
     * Size: 12 bytes (96 bits) for AES-GCM
     */
    val iv: ByteArray
) {
    /**
     * Ensures proper equality comparison for byte arrays.
     *
     * Two EncryptionResults are equal if both ciphertext and IV match.
     */
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is EncryptionResult) return false

        if (!ciphertext.contentEquals(other.ciphertext)) return false
        if (!iv.contentEquals(other.iv)) return false

        return true
    }

    /**
     * Hash code based on ciphertext and IV contents.
     */
    override fun hashCode(): Int {
        var result = ciphertext.contentHashCode()
        result = 31 * result + iv.contentHashCode()
        return result
    }

    /**
     * String representation (masks sensitive data).
     */
    override fun toString(): String {
        return "EncryptionResult(" +
            "ciphertext=${ciphertext.size} bytes, " +
            "iv=${iv.size} bytes" +
            ")"
    }
}
