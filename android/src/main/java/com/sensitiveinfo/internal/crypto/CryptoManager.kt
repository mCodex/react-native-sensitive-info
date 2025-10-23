package com.sensitiveinfo.internal.crypto

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import androidx.biometric.BiometricManager.Authenticators
import com.sensitiveinfo.internal.auth.BiometricAuthenticator
import com.sensitiveinfo.internal.auth.AuthenticationPrompt
import com.sensitiveinfo.internal.util.SensitiveInfoException
import java.security.KeyStore
import java.security.UnrecoverableKeyException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

private const val ANDROID_KEY_STORE = "AndroidKeyStore"
private const val TRANSFORMATION = "AES/GCM/NoPadding"
private const val GCM_TAG_LENGTH_BITS = 128

/**
 * Manages AES-256-GCM encryption/decryption with AndroidKeyStore.
 *
 * **Design Principles:**
 * 1. **Single Encryption Path**: Encrypt works the same for all Android versions
 * 2. **Single Decryption Path**: Decrypt works the same for all Android versions
 * 3. **Consistent IV Handling**: GCMParameterSpec ALWAYS used, never IvParameterSpec
 * 4. **Metadata Drives Decryption**: Persisted metadata fully describes how to decrypt
 * 5. **API-Level Decisions Centralized**: KeyAuthenticationStrategy handles all version differences
 *
 * **Architecture:**
 * - encrypt() → create/get key → init cipher → authenticate if needed → encrypt
 * - decrypt() → get existing key → init cipher → authenticate if needed → decrypt
 * - Both paths use GCMParameterSpec with stored IV
 * - BiometricAuthenticator handles only prompt UI, not key management
 */
internal class CryptoManager(
    private val authenticator: BiometricAuthenticator?
) {
    private val keyStore: KeyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }

    /**
     * Encrypts plaintext and returns ciphertext + IV.
     *
     * **Workflow:**
     * 1. Get or create key using the resolution
     * 2. Initialize AES-GCM cipher (generates random IV)
     * 3. If authentication required, show BiometricPrompt
     * 4. Encrypt data
     * 5. Return ciphertext + IV
     *
     * @param alias Unique key identifier
     * @param plaintext Data to encrypt (UTF-8 string converted to bytes)
     * @param resolution Access control configuration (biometric, StrongBox, etc.)
     * @param prompt Optional biometric prompt configuration
     * @return EncryptionResult with ciphertext and IV
     *
     * @throws SensitiveInfoException.EncryptionFailed if encryption fails
     * @throws SensitiveInfoException.KeyInvalidated if biometric enrollment changed
     */
    suspend fun encrypt(
        alias: String,
        plaintext: ByteArray,
        resolution: AccessResolution,
        prompt: AuthenticationPrompt?
    ): EncryptionResult {
        return try {
            // Step 1: Get or create key with proper authentication configuration
            val key = getOrCreateKey(alias, resolution)

            // Step 2: Initialize cipher (generates random IV automatically)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, key)

            // Step 3: Get the IV that was generated
            val iv = cipher.iv
                ?: throw SensitiveInfoException.EncryptionFailed(
                    "Cipher did not generate IV",
                    Exception("cipher.iv returned null")
                )

            // Step 4: If authentication is required, show biometric prompt
            val readyCipher = if (resolution.requiresAuthentication) {
                val resolvedPrompt = prompt ?: AuthenticationPrompt(title = "Authenticate")
                val deviceCredentialAllowed =
                    (resolution.allowedAuthenticators and Authenticators.DEVICE_CREDENTIAL) != 0
                authenticator?.authenticate(
                    prompt = resolvedPrompt,
                    cipher = cipher,
                    allowDeviceCredential = deviceCredentialAllowed
                ) ?: throw SensitiveInfoException.EncryptionFailed(
                    "Biometric authenticator unavailable",
                    IllegalStateException("No authenticator configured")
                )
            } else {
                cipher
            }

            // Step 5: Encrypt the plaintext
            val ciphertext = readyCipher.doFinal(plaintext)

            EncryptionResult(ciphertext = ciphertext, iv = iv)
        } catch (e: SensitiveInfoException) {
            throw e
        } catch (e: KeyPermanentlyInvalidatedException) {
            // Key was invalidated (e.g., biometric enrollment changed)
            deleteKey(alias)
            throw SensitiveInfoException.KeyInvalidated(alias)
        } catch (e: Exception) {
            throw SensitiveInfoException.EncryptionFailed(
                "Encryption failed: ${e.message}",
                e
            )
        }
    }

    /**
     * Ensures a key exists for the provided alias and access resolution without performing any
     * cryptographic operations. Useful for pre-provisioning keys ahead of time.
     */
    @Throws(SensitiveInfoException::class)
    fun ensureKey(
        alias: String,
        resolution: AccessResolution
    ) {
        getOrCreateKey(alias, resolution)
    }

    /**
     * Decrypts ciphertext using stored IV and key from alias.
     *
     * **Workflow:**
     * 1. Get existing key from keystore
     * 2. Initialize AES-GCM cipher with stored IV
     * 3. If authentication required, show BiometricPrompt
     * 4. Decrypt data (automatically verifies GCM auth tag)
     * 5. Return plaintext
     *
     * @param alias Unique key identifier (must match encryption)
     * @param ciphertext Encrypted data (includes 16-byte GCM auth tag)
     * @param iv Initialization vector (12 bytes, from encryption)
     * @param resolution Access control configuration (must match what was stored)
     * @param prompt Optional biometric prompt configuration
     * @return Decrypted plaintext as bytes
     *
     * @throws SensitiveInfoException.DecryptionFailed if decryption fails
     * @throws SensitiveInfoException.KeyInvalidated if key was invalidated
     * @throws SensitiveInfoException.KeystoreUnavailable if key not found
     */
    suspend fun decrypt(
        alias: String,
        ciphertext: ByteArray,
        iv: ByteArray,
        resolution: AccessResolution,
        prompt: AuthenticationPrompt?
    ): ByteArray {
        return try {
            // Step 1: Validate IV size
            if (iv.size != 12) {
                throw SensitiveInfoException.DecryptionFailed(
                    "Invalid IV size: expected 12 bytes, got ${iv.size}"
                )
            }

            // Step 2: Get existing key (must exist, don't create new one)
            val key = try {
                getKey(alias)
            } catch (e: Exception) {
                throw SensitiveInfoException.KeystoreUnavailable(
                    "Decryption key not found: $alias",
                    e
                )
            }

            // Step 3: Initialize cipher with stored IV
            val cipher = Cipher.getInstance(TRANSFORMATION)
            val spec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)
            cipher.init(Cipher.DECRYPT_MODE, key, spec)

            // Step 4: If authentication is required, show biometric prompt
            val readyCipher = if (resolution.requiresAuthentication) {
                val resolvedPrompt = prompt ?: AuthenticationPrompt(title = "Authenticate")
                val deviceCredentialAllowed =
                    (resolution.allowedAuthenticators and Authenticators.DEVICE_CREDENTIAL) != 0
                authenticator?.authenticate(
                    prompt = resolvedPrompt,
                    cipher = cipher,
                    allowDeviceCredential = deviceCredentialAllowed
                ) ?: throw SensitiveInfoException.DecryptionFailed(
                    "Biometric authenticator unavailable",
                    IllegalStateException("No authenticator configured")
                )
            } else {
                cipher
            }

            // Step 5: Decrypt and verify auth tag (fails if tag doesn't match)
            readyCipher.doFinal(ciphertext)
        } catch (e: SensitiveInfoException) {
            throw e
        } catch (e: KeyPermanentlyInvalidatedException) {
            // Key was invalidated (e.g., biometric enrollment changed)
            deleteKey(alias)
            throw SensitiveInfoException.KeyInvalidated(alias)
        } catch (e: UnrecoverableKeyException) {
            throw SensitiveInfoException.DecryptionFailed(
                "Key is unrecoverable (wrong password or key corrupted)",
                e
            )
        } catch (e: Exception) {
            when {
                e.message?.contains("Tag verification failed") == true ->
                    throw SensitiveInfoException.DecryptionFailed(
                        "GCM tag verification failed (tampering or wrong IV)",
                        e
                    )
                e.message?.contains("not found") == true ->
                    throw SensitiveInfoException.KeystoreUnavailable(
                        "Key $alias not found in keystore",
                        e
                    )
                else ->
                    throw SensitiveInfoException.DecryptionFailed(
                        "Decryption failed: ${e.message}",
                        e
                    )
            }
        }
    }

    /**
     * Reconstructs AccessResolution from persisted metadata.
     *
     * **Purpose:**
     * When decrypting a stored entry, we need to know exactly how it was encrypted
     * (what authentication was required, StrongBox settings, etc.).
     * This information is stored in persisted metadata.
     *
     * @param accessControl The access control policy that was used
     * @param securityLevel The security tier that was applied
     * @param authenticators Bitmap of allowed authenticators
     * @param requiresAuth Whether authentication is required
     * @param invalidateOnEnrollment Whether to invalidate on biometric enrollment change
     * @param useStrongBox Whether StrongBox was used
     * @return AccessResolution that matches how the key was created
     */
    fun buildResolutionForPersisted(
        accessControl: com.sensitiveinfo.internal.util.AccessControl,
        securityLevel: com.sensitiveinfo.internal.util.SecurityLevel,
        authenticators: Int,
        requiresAuth: Boolean,
        invalidateOnEnrollment: Boolean,
        useStrongBox: Boolean
    ): AccessResolution {
        return AccessResolution(
            accessControl = accessControl,
            securityLevel = securityLevel,
            requiresAuthentication = requiresAuth,
            allowedAuthenticators = authenticators,
            useStrongBox = useStrongBox,
            invalidateOnEnrollment = invalidateOnEnrollment
        )
    }

    /**
     * Deletes a key from AndroidKeyStore.
     *
     * Once deleted, all ciphertexts encrypted with this key become inaccessible.
     * This is permanent and irreversible.
     *
     * @param alias Key to delete
     */
    fun deleteKey(alias: String) {
        try {
            keyStore.deleteEntry(alias)
        } catch (_: Throwable) {
            // Best effort - even if deletion fails, continue
        }
    }

    // ============================================================================
    // PRIVATE HELPERS
    // ============================================================================

    /**
     * Gets existing key or creates new one if doesn't exist.
     *
     * @param alias Unique key identifier
     * @param resolution Determines key creation parameters
     * @return SecretKey, newly created or retrieved from keystore
     */
    private fun getOrCreateKey(
        alias: String,
        resolution: AccessResolution
    ): SecretKey {
        synchronized(keyStore) {
            // Check if key already exists
            val existing = try {
                val entry = keyStore.getEntry(alias, null)
                when (entry) {
                    is KeyStore.SecretKeyEntry -> entry.secretKey as? SecretKey
                    else -> null
                }
            } catch (_: Throwable) {
                null
            }

            if (existing != null) {
                return existing
            }

            // Create new key
            return generateKey(alias, resolution)
        }
    }

    /**
     * Gets existing key from keystore (doesn't create).
     *
     * @param alias Key identifier
     * @return SecretKey if found
     * @throws UnrecoverableKeyException if not found
     */
    private fun getKey(alias: String): SecretKey {
        return try {
            val entry = keyStore.getEntry(alias, null)
            when (entry) {
                is KeyStore.SecretKeyEntry -> entry.secretKey as? SecretKey
                    ?: throw UnrecoverableKeyException("Entry is not a SecretKeyEntry")
                else -> throw UnrecoverableKeyException("No entry found for alias: $alias")
            }
        } catch (e: UnrecoverableKeyException) {
            throw e
        } catch (e: Exception) {
            throw UnrecoverableKeyException("Failed to retrieve key: ${e.message}")
        }
    }

    /**
     * Generates new AES-256 key in AndroidKeyStore.
     *
     * **Security properties:**
     * - 256-bit AES key (maximum security)
     * - AES/GCM mode (authenticated encryption)
     * - Random IV per operation (semantic security)
     * - Hardware-backed via AndroidKeyStore
     * - Optional StrongBox (dedicated security processor on API 28+)
     * - Optional biometric/credential gating via KeyAuthenticationStrategy
     *
     * @param alias Unique key identifier (will be stored with this name)
     * @param resolution Specifies authentication, StrongBox, etc.
     * @return Newly generated SecretKey
     * @throws SensitiveInfoException if generation fails
     */
    private fun generateKey(
        alias: String,
        resolution: AccessResolution
    ): SecretKey {
        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE)
        val purposes = KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT

        val builder = KeyGenParameterSpec.Builder(alias, purposes)
            .setKeySize(256)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)

        // Apply API-level-appropriate authentication configuration
        try {
            KeyAuthenticationStrategy.applyToKeyGeneration(builder, resolution)
        } catch (e: SensitiveInfoException) {
            throw e
        }

        // Use StrongBox if available and requested
        if (resolution.useStrongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                builder.setIsStrongBoxBacked(true)
            } catch (e: StrongBoxUnavailableException) {
                // StrongBox not available, continue without it
                // This is not a fatal error - the key will just be software-backed
            } catch (_: Throwable) {
                // Silently continue on other errors
            }
        }

        // Invalidate key on biometric enrollment change (if requested)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            builder.setInvalidatedByBiometricEnrollment(resolution.invalidateOnEnrollment)
        }

        // Generate the key
        return try {
            keyGenerator.init(builder.build())
            keyGenerator.generateKey()
        } catch (e: StrongBoxUnavailableException) {
            throw SensitiveInfoException.EncryptionFailed(
                "StrongBox unavailable for this key",
                e
            )
        } catch (e: Exception) {
            throw SensitiveInfoException.EncryptionFailed(
                "Key generation failed: ${e.message}",
                e
            )
        }
    }
}
