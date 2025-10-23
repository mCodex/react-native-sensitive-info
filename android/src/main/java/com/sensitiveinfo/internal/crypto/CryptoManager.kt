package com.sensitiveinfo.internal.crypto

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import android.security.keystore.UserNotAuthenticatedException
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
private const val TAG = "CryptoManager"

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
     * 2. Determine authentication strategy based on Android version
     * 3. If authentication required:
     *    - **Android 10+ (API 29+)** → Authenticate *with* a cipher (keystore gated)
     *    - **Android 7-9 (API 24-28)** → Authenticate *before* crypto (app gated)
     * 4. Initialize AES-GCM cipher and encrypt
     * 5. Return ciphertext + IV (12-byte GCM nonce)
     *
     * **Universal Authentication Model**:
     * - Android 10+ benefits from hardware-backed key authentication via `CryptoObject`
     * - Android 7-9 perform a manual biometric/credential prompt before using the key
     * - Both paths guarantee that the caller experiences an authentication UI whenever
     *   `AccessResolution.requiresAuthentication == true`
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

            // Step 2: Prepare cipher and authentication strategy
            val cipher = Cipher.getInstance(TRANSFORMATION)
            val requiresAuth = resolution.requiresAuthentication
            val supportsKeystoreAuth = requiresAuth && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            val resolvedPrompt = prompt ?: AuthenticationPrompt(title = "Authenticate")

            val workingCipher = when {
                !requiresAuth -> {
                    cipher.init(Cipher.ENCRYPT_MODE, key)
                    cipher
                }
                supportsKeystoreAuth -> {
                    // Android 10+: Authenticate WITH cipher (keystore-gated auth)
                    authenticateAndEncrypt(
                        cipher = cipher,
                        key = key,
                        prompt = resolvedPrompt,
                        mode = Cipher.ENCRYPT_MODE,
                        resolution = resolution
                    )
                }
                else -> {
                    // Android 7-9: Authenticate BEFORE cipher init (app-gated auth)
                    val auth = authenticator ?: throw SensitiveInfoException.EncryptionFailed(
                        "Biometric authenticator unavailable",
                        IllegalStateException("No authenticator configured")
                    )
                    val deviceCredentialAllowed =
                        (resolution.allowedAuthenticators and Authenticators.DEVICE_CREDENTIAL) != 0
                    auth.authenticate(
                        prompt = resolvedPrompt,
                        cipher = null,
                        allowDeviceCredential = deviceCredentialAllowed
                    )
                    cipher.init(Cipher.ENCRYPT_MODE, key)
                    cipher
                }
            }

            val iv = workingCipher.iv
                ?: throw SensitiveInfoException.EncryptionFailed(
                    "Cipher did not generate IV",
                    Exception("cipher.iv returned null")
                )
            val ciphertext = workingCipher.doFinal(plaintext)

            EncryptionResult(ciphertext = ciphertext, iv = iv)
        } catch (e: SensitiveInfoException) {
            throw e
        } catch (e: KeyPermanentlyInvalidatedException) {
            // Key was invalidated (e.g., biometric enrollment changed)
            deleteKey(alias)
            throw SensitiveInfoException.KeyInvalidated(alias)
        } catch (e: UserNotAuthenticatedException) {
            // Android 13+: User must authenticate before key can be used
            // This often happens if cipher was initialized but auth timed out
            throw SensitiveInfoException.EncryptionFailed(
                "Authentication required but not completed: Device credential or biometric needed",
                e
            )
        } catch (e: Exception) {
            // Check if this is the "Key user not authenticated" error from old key format
            // The error can appear at various levels in the cause chain
            val isBadKeyError = e.message?.contains("Key user not authenticated") == true ||
                    checkCauseChainForKeyError(e)
            
            if (isBadKeyError && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                // Android 13+: Old key format (with AUTH_DEVICE_CREDENTIAL) is incompatible
                // Delete it so a new key gets created with correct format

                deleteKey(alias)
                
                // Retry with new key
                return try {
                    encrypt(alias, plaintext, resolution, prompt)
                } catch (retryError: Exception) {
    
                    throw SensitiveInfoException.EncryptionFailed(
                        "Encryption failed after key recreation: ${retryError.message}",
                        retryError
                    )
                }
            }
            
        
            val exceptionType = e::class.simpleName ?: "Unknown"
            val causeChain = buildCauseChain(e)
            
            throw SensitiveInfoException.EncryptionFailed(
                "Encryption failed: $exceptionType - ${e.message ?: "Unknown error"}\n$causeChain",
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
     * 1. Validate IV and fetch key from AndroidKeyStore
     * 2. Determine authentication strategy based on Android version
     * 3. If authentication required:
     *    - **Android 10+ (API 29+)** → Authenticate *with* the decrypt cipher
     *    - **Android 7-9 (API 24-28)** → Authenticate *before* initializing the cipher
     * 4. Initialize AES-GCM cipher with stored IV
     * 5. Decrypt (verifies GCM tag automatically)
     *
     * **Universal Authentication Model** mirrors encrypt(): caller always sees an
     * authentication prompt when required, while the keystore flow remains stable on
     * older devices.
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

            // Step 3: Prepare cipher and authentication strategy
            val cipher = Cipher.getInstance(TRANSFORMATION)
            val spec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)
            val requiresAuth = resolution.requiresAuthentication
            val supportsKeystoreAuth = requiresAuth && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            val resolvedPrompt = prompt ?: AuthenticationPrompt(title = "Authenticate")

            val workingCipher = when {
                !requiresAuth -> {
                    cipher.init(Cipher.DECRYPT_MODE, key, spec)
                    cipher
                }
                supportsKeystoreAuth -> {
                    // Android 10+: Authenticate WITH cipher (keystore-gated auth)
                    authenticateAndDecrypt(
                        cipher = cipher,
                        key = key,
                        spec = spec,
                        prompt = resolvedPrompt,
                        mode = Cipher.DECRYPT_MODE,
                        resolution = resolution
                    )
                }
                else -> {
                    // Android 7-9: Authenticate BEFORE cipher init (app-gated auth)
                    val auth = authenticator ?: throw SensitiveInfoException.DecryptionFailed(
                        "Biometric authenticator unavailable",
                        IllegalStateException("No authenticator configured")
                    )
                    val deviceCredentialAllowed =
                        (resolution.allowedAuthenticators and Authenticators.DEVICE_CREDENTIAL) != 0
                    auth.authenticate(
                        prompt = resolvedPrompt,
                        cipher = null,
                        allowDeviceCredential = deviceCredentialAllowed
                    )
                    cipher.init(Cipher.DECRYPT_MODE, key, spec)
                    cipher
                }
            }

            // Step 5: Decrypt and verify auth tag (fails if tag doesn't match)
            workingCipher.doFinal(ciphertext)
        } catch (e: SensitiveInfoException) {
            throw e
        } catch (e: KeyPermanentlyInvalidatedException) {
            // Key was invalidated (e.g., biometric enrollment changed)
            deleteKey(alias)
            throw SensitiveInfoException.KeyInvalidated(alias)
        } catch (e: UserNotAuthenticatedException) {
            // Android 13+: User must authenticate before key can be used
            throw SensitiveInfoException.DecryptionFailed(
                "Authentication required but not completed: Device credential or biometric needed",
                e
            )
        } catch (e: UnrecoverableKeyException) {
            throw SensitiveInfoException.DecryptionFailed(
                "Key is unrecoverable (wrong password or key corrupted)",
                e
            )
        } catch (e: Exception) {
            // Check if this is the "Key user not authenticated" error from old key format
            val isBadKeyError = e.message?.contains("Key user not authenticated") == true ||
                    (e.cause?.message?.contains("No operation auth token received") == true)
            
            if (isBadKeyError && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                // Android 13+: Old key format (with AUTH_DEVICE_CREDENTIAL) is incompatible
                // Delete it so a new key gets created with correct format

                deleteKey(alias)
                
                // Cannot retry decrypt - we don't have the plaintext anymore
                throw SensitiveInfoException.DecryptionFailed(
                    "Key was incompatible with Android 13+ authentication model and has been deleted. " +
                    "Please re-encrypt data with new key format.",
                    e
                )
            }
            
            val exceptionType = e::class.simpleName ?: "Unknown"
            val causeChain = buildCauseChain(e)
            
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
                        "Decryption failed: $exceptionType - ${e.message ?: "Unknown error"}\n$causeChain",
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
     * Authenticates and encrypts using keystore-gated authentication (Android 10+).
     *
     * **Why separate method**:
     * - DRY: Avoids repeating cipher/a
     * - SRP: Single responsibility—handle keystore auth ceremony
     * - Testability: Can mock/test authentication flow independently
     *
     * **Workflow**:
     * 1. Initialize cipher (puts it in a pre-authenticated state)
     * 2. Authenticate WITH the cipher as CryptoObject (keystore validates the prompt)
     * 3. Return the authenticated cipher ready for encryption
     *
     * **Key insight**: The cipher must be initialized BEFORE authentication on Android 10+,
     * so the keystore can wrap it with authentication. This is the opposite of Android 9.
     */
    private suspend fun authenticateAndEncrypt(
        cipher: Cipher,
        key: SecretKey,
        prompt: AuthenticationPrompt,
        mode: Int,
        resolution: AccessResolution
    ): Cipher {
        val auth = authenticator ?: throw SensitiveInfoException.EncryptionFailed(
            "Biometric authenticator unavailable",
            IllegalStateException("No authenticator configured")
        )
    
        return try {
            // Initialize cipher for the keystore-gated auth flow
            cipher.init(mode, key)
            
            // On Android 13+, device credential is excluded from the key itself,
            // so we should NOT allow it in BiometricPrompt (only biometric).
            // On Android 10-12, device credential is in the key, so we can allow it.
            val deviceCredentialAllowed =
                (resolution.allowedAuthenticators and Authenticators.DEVICE_CREDENTIAL) != 0 &&
                Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            
            // Pass cipher as CryptoObject so keystore can generate auth token
            val authenticatedCipher = auth.authenticate(
                prompt = prompt,
                cipher = cipher,
                allowDeviceCredential = deviceCredentialAllowed
            )
            authenticatedCipher ?: cipher
        } catch (e: Exception) {
            throw e
        }
    }

    /**
     * Authenticates and decrypts using keystore-gated authentication (Android 10+).
     *
     * **Why separate method**:
     * - DRY: Avoids repeating cipher/a
     * - SRP: Single responsibility—handle keystore auth ceremony
     * - Testability: Can mock/test authentication flow independently
     *
     * **Workflow**:
     * 1. Initialize cipher with IV spec (puts it in a pre-authenticated state)
     * 2. Authenticate WITH the cipher as CryptoObject (keystore validates the prompt)
     * 3. Return the authenticated cipher ready for decryption
     *
     * **Key insight**: Same as encrypt() but with IV spec for GCM mode.
     */
    private suspend fun authenticateAndDecrypt(
        cipher: Cipher,
        key: SecretKey,
        spec: GCMParameterSpec,
        prompt: AuthenticationPrompt,
        mode: Int,
        resolution: AccessResolution
    ): Cipher {
        val auth = authenticator ?: throw SensitiveInfoException.DecryptionFailed(
            "Biometric authenticator unavailable",
            IllegalStateException("No authenticator configured")
        )
    
        return try {
            // Initialize cipher with GCM spec for the keystore-gated auth flow
            cipher.init(mode, key, spec)
            
            // On Android 13+, device credential is excluded from the key itself,
            // so we should NOT allow it in BiometricPrompt (only biometric).
            // On Android 10-12, device credential is in the key, so we can allow it.
            val deviceCredentialAllowed =
                (resolution.allowedAuthenticators and Authenticators.DEVICE_CREDENTIAL) != 0 &&
                Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            
            // Pass cipher as CryptoObject so keystore can generate auth token
            val authenticatedCipher = auth.authenticate(
                prompt = prompt,
                cipher = cipher,
                allowDeviceCredential = deviceCredentialAllowed
            )
            authenticatedCipher ?: cipher
        } catch (e: Exception) {
            throw e
        }
    }

    /**
     * Authenticates using app-gated authentication (Android 7-9).
     *
     * **Why separate method**:
     * - DRY: Avoids repeating a
     * - SRP: Single responsibility—handle app-level auth ceremony
     * - Clarity: Name signals "we auth BEFORE crypto, not with crypto"
     *
     * **Workflow**:
     * 1. Show BiometricPrompt WITHOUT cipher (app manages the UI)
     * 2. User authenticates via biometric or device credential
     * 3. Return (cipher init happens after this returns)
     */
    private suspend fun authenticateAppGated(
        prompt: AuthenticationPrompt,
        allowDeviceCredential: Boolean
    ) {
        val auth = authenticator ?: throw SensitiveInfoException.EncryptionFailed(
            "Biometric authenticator unavailable",
            IllegalStateException("No authenticator configured")
        )
        auth.authenticate(
            prompt = prompt,
            cipher = null,
            allowDeviceCredential = allowDeviceCredential
        )
    }

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
            if (resolution.useStrongBox) {
                // Fallback: retry without StrongBox support
                return generateKey(alias, resolution.copy(useStrongBox = false))
            }
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

    /**
     * Helper function to build a detailed exception cause chain for debugging.
     *
     * @param throwable The exception to analyze
     * @return A formatted string showing the exception class names and messages in chain
     */
    private fun buildCauseChain(throwable: Throwable): String {
        val chain = mutableListOf<String>()
        var current: Throwable? = throwable
        var depth = 0
        val maxDepth = 5  // Limit depth to avoid overly long strings

        while (current != null && depth < maxDepth) {
            val className = current::class.simpleName ?: "Unknown"
            val message = current.message?.take(100) ?: "(no message)"
            chain.add("  [$depth] $className: $message")
            current = current.cause
            depth++
        }

        return if (chain.isEmpty()) "(empty cause chain)" else chain.joinToString("\n")
    }

    /**
     * Helper function to detect "Key user not authenticated" error in exception cause chain.
     *
     * On Android 13+, this error can be wrapped in multiple layers:
     * IllegalBlockSizeException → KeyStoreException → (underlying error)
     *
     * @param throwable The exception to check
     * @return true if "Key user not authenticated" is found anywhere in the cause chain
     */
    private fun checkCauseChainForKeyError(throwable: Throwable): Boolean {
        var current: Throwable? = throwable
        var depth = 0
        val maxDepth = 10  // Check up to 10 levels deep

        while (current != null && depth < maxDepth) {
            if (current.message?.contains("Key user not authenticated") == true ||
                current.message?.contains("No operation auth token received") == true) {
                return true
            }
            current = current.cause
            depth++
        }

        return false
    }
}
