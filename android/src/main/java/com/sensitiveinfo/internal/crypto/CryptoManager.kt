package com.sensitiveinfo.internal.crypto

import android.os.Build
import android.security.keystore.KeyPermanentlyInvalidatedException
import com.sensitiveinfo.internal.util.SensitiveInfoException
import java.security.InvalidKeyException
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec

/**
 * Orchestrates AES-GCM encryption and decryption operations.
 *
 * **Security Workflow**:
 * 1. Generate random IV for each operation
 * 2. Get key from AndroidKeyStore (may trigger biometric)
 * 3. Initialize GCM cipher with key and IV
 * 4. Encrypt/decrypt data
 * 5. Return ciphertext+IV (or plaintext)
 *
 * **AES-GCM Properties**:
 * - Authenticated encryption: Detects tampering
 * - Authentication tag (16 bytes) automatically appended to ciphertext
 * - If tag doesn't match during decryption, operation FAILS (protects against corruption)
 * - Random IV per operation (semantic security)
 *
 * **Error Handling**:
 * - KeyPermanentlyInvalidatedException: Biometric enrollment changed
 * - UserNotAuthenticatedException: Biometric/passcode required but not done
 * - InvalidKeyException: Key corrupted or inaccessible
 *
 * @property keyAlias Name of the key in AndroidKeyStore (e.g., "app_aes_key_123")
 *
 * @see IVManager For IV generation
 * @see KeyGenerator For key management
 * @see https://csrc.nist.gov/publications/detail/sp/800-38d/final for GCM spec
 */
class CryptoManager(
    private val keyAlias: String
) {

    companion object {
        private const val CIPHER_ALGORITHM = "AES/GCM/NoPadding"
        private const val GCM_TAG_LENGTH_BITS = 128  // 16 bytes, standard for GCM
        private const val TIMEOUT_SECONDS = 10L
    }

    /**
     * Encrypts plaintext using AES-256-GCM with a randomly generated IV.
     *
     * **Critical Security Decisions**:
     * 1. NEW random IV generated for EVERY call (fixes v5 fixed IV vulnerability)
     * 2. Semantic security: Same plaintext → Different ciphertext
     * 3. Authentication tag included (tampering detection)
     *
     * **Workflow**:
     * 1. Generate random 12-byte IV
     * 2. Retrieve AES-256 key from AndroidKeyStore
     * 3. Initialize GCM cipher with key and IV
     * 4. Encrypt plaintext → ciphertext + auth tag
     * 5. Return (ciphertext+tag, IV)
     *
     * **Storage Pattern**:
     * Store both IV and ciphertext together (IV is not secret):
     * ```json
     * {
     *   "iv": "Base64EncodedIV",
     *   "ciphertext": "Base64EncodedCiphertext"
     * }
     * ```
     *
     * @param plaintext String to encrypt (will be UTF-8 encoded)
     * @return EncryptionResult containing ciphertext + IV
     *
     * @throws SensitiveInfoException.KeyInvalidated If biometric enrollment changed
     * @throws SensitiveInfoException.EncryptionFailed If encryption fails
     * @throws SensitiveInfoException.KeystoreUnavailable If key not accessible
     *
     * @example
     * ```kotlin
     * val crypto = CryptoManager("auth_token_key")
     *
     * val plaintext = "secret-jwt-token-abc123xyz"
     * val result = crypto.encrypt(plaintext)
     *
     * // Store both for later decryption
     * storage.save(
     *     key = "token",
     *     iv = IVManager.encodeToBase64(result.iv),
     *     ciphertext = Base64.encodeToString(result.ciphertext, Base64.NO_WRAP)
     * )
     * ```
     */
    @Throws(SensitiveInfoException::class)
    fun encrypt(plaintext: String): EncryptionResult {
        return try {
            // Step 1: Generate random IV for this operation
            val iv = IVManager.generateRandomIV()

            // Step 2: Retrieve key (may trigger biometric authentication)
            val key = KeyGenerator.getKey(keyAlias)

            // Step 3: Initialize GCM cipher
            val cipher = Cipher.getInstance(CIPHER_ALGORITHM)
            val spec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)
            cipher.init(Cipher.ENCRYPT_MODE, key, spec)

            // Step 4: Encrypt plaintext
            val plaintextBytes = plaintext.toByteArray(Charsets.UTF_8)
            val ciphertext = cipher.doFinal(plaintextBytes)

            // Step 5: Return result with IV
            // Note: Ciphertext already includes authentication tag (last 16 bytes)
            EncryptionResult(
                ciphertext = ciphertext,
                iv = iv
            )
        } catch (e: SensitiveInfoException) {
            throw e
        } catch (e: KeyPermanentlyInvalidatedException) {
            // Biometric enrollment changed - key is invalidated
            throw SensitiveInfoException.KeyInvalidated(keyAlias)
        } catch (e: Exception) {
            when {
                e.message?.contains("User not authenticated") == true -> {
                    throw SensitiveInfoException.EncryptionFailed(
                        "Authentication required but not completed: ${e.message}",
                        e
                    )
                }
                e is InvalidKeyException -> {
                    throw SensitiveInfoException.EncryptionFailed(
                        "Invalid key: ${e.message}",
                        e
                    )
                }
                else -> {
                    throw SensitiveInfoException.EncryptionFailed(
                        "Encryption failed: ${e.message}",
                        e
                    )
                }
            }
        }
    }

    /**
     * Decrypts ciphertext that was encrypted with [encrypt].
     *
     * **Decryption Workflow**:
     * 1. Validate IV size (must be 12 bytes for GCM)
     * 2. Retrieve AES-256 key from AndroidKeyStore
     * 3. Initialize GCM cipher with key and IV
     * 4. Decrypt ciphertext → plaintext
     * 5. Verify authentication tag (automatically by GCM)
     *
     * **Automatic Security Checks**:
     * - If authentication tag doesn't match, decryption FAILS
     * - This detects tampering, corruption, or wrong key
     * - If tag fails, you get DecryptionFailed exception (not corrupted plaintext)
     *
     * **Retrieved IV Usage**:
     * The IV used here MUST be the same IV that was generated during encryption.
     * If a different IV is used, decryption will FAIL (auth tag won't verify).
     *
     * @param ciphertext Encrypted data (includes 16-byte authentication tag at end)
     * @param iv Initialization vector (12 bytes) from encryption operation
     * @return Decrypted plaintext string
     *
     * @throws SensitiveInfoException.KeyInvalidated If biometric enrollment changed
     * @throws SensitiveInfoException.DecryptionFailed If decryption fails or tag doesn't match
     * @throws SensitiveInfoException.KeystoreUnavailable If key not accessible
     *
     * @example
     * ```kotlin
     * val crypto = CryptoManager("auth_token_key")
     *
     * // Retrieve stored data
     * val stored = storage.load()  // Contains iv + ciphertext
     * val iv = IVManager.decodeFromBase64(stored.iv)
     * val ciphertext = Base64.decode(stored.ciphertext, Base64.NO_WRAP)
     *
     * // Decrypt
     * val plaintext = crypto.decrypt(ciphertext, iv)
     * // plaintext: "secret-jwt-token-abc123xyz"
     *
     * // If ciphertext was tampered with:
     * val tamperedCiphertext = ciphertext.copyOf().apply { this[0] = this[0].inc() }
     * try {
     *   crypto.decrypt(tamperedCiphertext, iv)  // FAILS - auth tag doesn't match
     * } catch (e: SensitiveInfoException.DecryptionFailed) {
     *   println("Tampering detected!")
     * }
     * ```
     */
    @Throws(SensitiveInfoException::class)
    fun decrypt(ciphertext: ByteArray, iv: ByteArray): String {
        return try {
            // Step 1: Validate IV
            if (!IVManager.isValidIV(iv)) {
                throw SensitiveInfoException.DecryptionFailed(
                    "Invalid IV size: expected ${12}, got ${iv.size}"
                )
            }

            // Step 2: Retrieve key
            val key = KeyGenerator.getKey(keyAlias)

            // Step 3: Initialize GCM cipher with SAME IV from encryption
            val cipher = Cipher.getInstance(CIPHER_ALGORITHM)
            val spec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)
            cipher.init(Cipher.DECRYPT_MODE, key, spec)

            // Step 4: Decrypt ciphertext
            // If tag doesn't match, this will throw an exception
            val plaintextBytes = cipher.doFinal(ciphertext)

            // Step 5: Convert back to string
            String(plaintextBytes, Charsets.UTF_8)
        } catch (e: SensitiveInfoException) {
            throw e
        } catch (e: KeyPermanentlyInvalidatedException) {
            // Biometric enrollment changed
            throw SensitiveInfoException.KeyInvalidated(keyAlias)
        } catch (e: Exception) {
            when {
                e.message?.contains("User not authenticated") == true -> {
                    throw SensitiveInfoException.DecryptionFailed(
                        "Authentication required but not completed: ${e.message}",
                        e
                    )
                }
                e.message?.contains("Tag verification failed") == true -> {
                    throw SensitiveInfoException.DecryptionFailed(
                        "Authentication tag verification failed (tampering or wrong IV)",
                        e
                    )
                }
                e is InvalidKeyException -> {
                    throw SensitiveInfoException.DecryptionFailed(
                        "Invalid key: ${e.message}",
                        e
                    )
                }
                else -> {
                    throw SensitiveInfoException.DecryptionFailed(
                        "Decryption failed: ${e.message}",
                        e
                    )
                }
            }
        }
    }

    /**
     * Invalidates the key associated with this CryptoManager.
     *
     * Used when the user wants to clear sensitive data or rotate keys.
     *
     * **Warning**: This is irreversible. All ciphertexts encrypted with this key
     * will become inaccessible.
     *
     * @throws SensitiveInfoException.KeystoreUnavailable If deletion fails
     */
    @Throws(SensitiveInfoException::class)
    fun invalidateKey() {
        KeyGenerator.deleteKey(keyAlias)
    }
}
