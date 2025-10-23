package com.sensitiveinfo.internal.crypto

import android.os.Build
import android.security.keystore.KeyPermanentlyInvalidatedException
import com.sensitiveinfo.internal.util.SensitiveInfoException
import java.security.InvalidKeyException
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec

private const val LEGACY_TRANSFORMATION = "AES/GCM/NoPadding"
private const val LEGACY_TAG_LENGTH_BITS = 128

/**
 * Compatibility crypto implementation that mirrors the v5 storage engine.
 *
 * Used during migration so we can read previously stored entries (and, when necessary,
 * re-encrypt them before persisting with the modern metadata-rich format).
 *
 * The logic intentionally matches commit 495dd7f08c077f5744e56803e45f54787df3dab3:
 * - Android 9 (API 28) lets the cipher allocate the IV because hardware-gated keys reject
 *   caller-provided IVs.
 * - Android 10+ (API 29+) generates a random IV via [IVManager] to maximise forward secrecy.
 */
internal class LegacyCryptoManager(private val keyAlias: String) {

    /**
     * Encrypts raw bytes using the legacy rules so we can round-trip secrets that were never
     * migrated. New callers should prefer [CryptoManager].
     */
    @Throws(SensitiveInfoException::class)
    fun encrypt(plaintext: ByteArray): EncryptionResult {
        return try {
            val key = KeyGenerator.getKey(keyAlias)
            val cipher = Cipher.getInstance(LEGACY_TRANSFORMATION)

            if (Build.VERSION.SDK_INT == Build.VERSION_CODES.P) {
                cipher.init(Cipher.ENCRYPT_MODE, key)
                val iv = cipher.iv
                    ?: throw SensitiveInfoException.EncryptionFailed("Cipher did not expose IV")
                val ciphertext = cipher.doFinal(plaintext)
                EncryptionResult(ciphertext = ciphertext, iv = iv)
            } else {
                val iv = IVManager.generateRandomIV()
                val spec = GCMParameterSpec(LEGACY_TAG_LENGTH_BITS, iv)
                cipher.init(Cipher.ENCRYPT_MODE, key, spec)
                val ciphertext = cipher.doFinal(plaintext)
                EncryptionResult(ciphertext = ciphertext, iv = iv)
            }
        } catch (error: SensitiveInfoException) {
            throw error
        } catch (invalidated: KeyPermanentlyInvalidatedException) {
            throw SensitiveInfoException.KeyInvalidated(keyAlias)
        } catch (other: Exception) {
            val message = other.message ?: "Unknown error"
            when {
                message.contains("User not authenticated", ignoreCase = true) ->
                    throw SensitiveInfoException.EncryptionFailed("Authentication required", other)
                message.contains("not permitted", ignoreCase = true) ->
                    throw SensitiveInfoException.EncryptionFailed("Caller IV rejected on this API level", other)
                other is InvalidKeyException ->
                    throw SensitiveInfoException.EncryptionFailed("Invalid key: ${other.message}", other)
                else ->
                    throw SensitiveInfoException.EncryptionFailed("Encryption failed: $message", other)
            }
        }
    }

    /**
     * Decrypts bytes produced by [encrypt] (or by the historical implementation shipped in v5).
     */
    @Throws(SensitiveInfoException::class)
    fun decrypt(ciphertext: ByteArray, iv: ByteArray): ByteArray {
        return try {
            if (!IVManager.isValidIV(iv)) {
                throw SensitiveInfoException.DecryptionFailed(
                    "Invalid IV size: expected 12, got ${iv.size}"
                )
            }

            val key = KeyGenerator.getKey(keyAlias)
            val cipher = Cipher.getInstance(LEGACY_TRANSFORMATION)
            val spec = GCMParameterSpec(LEGACY_TAG_LENGTH_BITS, iv)
            cipher.init(Cipher.DECRYPT_MODE, key, spec)
            val plaintext = cipher.doFinal(ciphertext)
            if (plaintext.isEmpty()) {
                throw SensitiveInfoException.DecryptionFailed("Legacy cipher produced empty output")
            }
            plaintext
        } catch (error: SensitiveInfoException) {
            throw error
        } catch (invalidated: KeyPermanentlyInvalidatedException) {
            throw SensitiveInfoException.KeyInvalidated(keyAlias)
        } catch (other: Exception) {
            val message = other.message ?: "Unknown error"
            when {
                message.contains("User not authenticated", ignoreCase = true) ->
                    throw SensitiveInfoException.DecryptionFailed("Authentication required", other)
                message.contains("Tag verification failed", ignoreCase = true) ->
                    throw SensitiveInfoException.DecryptionFailed("GCM tag verification failed", other)
                message.contains("Only GCMParameterSpec supported", ignoreCase = true) ->
                    throw SensitiveInfoException.DecryptionFailed("GCMParameterSpec required", other)
                other is InvalidKeyException ->
                    throw SensitiveInfoException.DecryptionFailed("Invalid key: ${other.message}", other)
                else ->
                    throw SensitiveInfoException.DecryptionFailed("Decryption failed: $message", other)
            }
        }
    }

    fun invalidateKey() {
        try {
            KeyGenerator.deleteKey(keyAlias)
        } catch (_: Exception) {
            // Best effort: legacy engine treated key deletion as optional cleanup.
        }
    }
}
