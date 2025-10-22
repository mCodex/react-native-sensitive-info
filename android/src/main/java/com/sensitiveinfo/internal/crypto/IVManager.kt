package com.sensitiveinfo.internal.crypto

import android.util.Base64
import java.security.SecureRandom

/**
 * Generates and manages Initialization Vectors (IVs) for AES-GCM encryption.
 *
 * **CRITICAL SECURITY**: This fixes the v5 vulnerability where a FIXED IV was used.
 *
 * Why this matters:
 * - v5: Fixed IV → Same plaintext = Same ciphertext → Pattern analysis attacks
 * - v6: Random IV → Same plaintext = Different ciphertext → No patterns (semantically secure)
 *
 * Per NIST SP 800-38D Section 5.2.1.1:
 * "The IVs used in GCM must be generated in a manner such that the probability
 *  of repetition is negligible."
 *
 * Implementation:
 * 1. Generate NEW 12-byte (96-bit) IV for EVERY encryption operation
 * 2. Use SecureRandom (cryptographically secure, not Math.random or Random)
 * 3. Store IV alongside ciphertext (IV is NOT secret)
 * 4. Retrieve IV during decryption
 * 5. IV should NEVER be reused with same key
 *
 * IV Size:
 * - 12 bytes (96 bits) is NIST recommended size for GCM
 * - Allows 2^96 unique values (astronomically large)
 * - Probability of collision with SecureRandom is negligible
 * - Do NOT use 16 bytes or other sizes without explicit reason
 *
 * @see https://csrc.nist.gov/publications/detail/sp/800-38d/final
 */
object IVManager {

    /**
     * Standard IV size for AES-GCM: 12 bytes (96 bits).
     *
     * Per NIST recommendations, 96-bit IVs are optimal for GCM mode.
     * This size balances:
     * - Security: ~2^96 unique values (collision probability negligible)
     * - Performance: Faster than 128-bit or 256-bit options
     * - Compatibility: Standard across implementations
     */
    private const val IV_SIZE_BYTES = 12
    private const val SECURE_RANDOM_ALGORITHM = "SHA1PRNG"

    /**
     * Generates a random IV for AES-GCM encryption.
     *
     * **CRITICAL**: A NEW IV is generated for EVERY encryption operation.
     * Reusing IVs with the same key completely breaks GCM security.
     *
     * This is the core fix for v5's fixed IV vulnerability:
     *
     * ```
     * // v5 (WRONG - Fixed IV)
     * val iv = ByteArray(12) { 0x00.toByte() }  // Same every time!
     * Plaintext1 + IV0 → Ciphertext1
     * Plaintext1 + IV0 → Ciphertext1 (SAME!) ← Vulnerable to pattern analysis
     *
     * // v6 (CORRECT - Random IV)
     * val iv = IVManager.generateRandomIV()    // Different every time
     * Plaintext1 + IVa → CiphertextA
     * Plaintext1 + IVb → CiphertextB (DIFFERENT!) ← Semantically secure
     * ```
     *
     * @return New random 12-byte IV suitable for AES-GCM encryption
     *
     * @throws IllegalStateException If SecureRandom initialization fails
     *
     * @example
     * ```kotlin
     * val iv = IVManager.generateRandomIV()
     * assert(iv.size == 12)
     *
     * val iv2 = IVManager.generateRandomIV()
     * assert(!iv.contentEquals(iv2))  // IVs should be different
     * ```
     */
    @Throws(IllegalStateException::class)
    fun generateRandomIV(): ByteArray {
        return try {
            val iv = ByteArray(IV_SIZE_BYTES)
            val random = SecureRandom.getInstance(SECURE_RANDOM_ALGORITHM)
            random.nextBytes(iv)
            iv
        } catch (e: Exception) {
            throw IllegalStateException("Failed to generate IV: ${e.message}", e)
        }
    }

    /**
     * Encodes IV to Base64 for storage/transmission.
     *
     * IVs are not secret (can be stored in plaintext), but Base64 encoding
     * is used for compatibility and readability.
     *
     * @param iv Raw IV bytes (typically 12 bytes)
     * @return Base64-encoded IV string
     *
     * @example
     * ```kotlin
     * val iv = IVManager.generateRandomIV()
     * val encoded = IVManager.encodeToBase64(iv)
     * // encoded: "9P6xL5K3mN8xQ2vV7dA9"
     * ```
     */
    fun encodeToBase64(iv: ByteArray): String {
        return Base64.encodeToString(iv, Base64.NO_WRAP)
    }

    /**
     * Decodes IV from Base64 string.
     *
     * Used when retrieving stored IV for decryption operations.
     *
     * @param encoded Base64-encoded IV string
     * @return Raw IV bytes
     *
     * @throws IllegalArgumentException If Base64 string is invalid
     *
     * @example
     * ```kotlin
     * val encoded = "9P6xL5K3mN8xQ2vV7dA9"
     * val iv = IVManager.decodeFromBase64(encoded)
     * assert(iv.size == 12)
     * ```
     */
    @Throws(IllegalArgumentException::class)
    fun decodeFromBase64(encoded: String): ByteArray {
        return try {
            Base64.decode(encoded, Base64.NO_WRAP)
        } catch (e: Exception) {
            throw IllegalArgumentException("Invalid Base64 IV: ${e.message}", e)
        }
    }

    /**
     * Validates that an IV is the correct size for AES-GCM.
     *
     * @param iv IV bytes to validate
     * @return true if IV is exactly 12 bytes, false otherwise
     */
    fun isValidIV(iv: ByteArray): Boolean {
        return iv.size == IV_SIZE_BYTES
    }
}
