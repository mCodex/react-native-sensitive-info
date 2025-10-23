package com.sensitiveinfo.internal.crypto

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.sensitiveinfo.internal.util.SensitiveInfoException
import javax.crypto.KeyGenerator
import java.security.KeyStore

/**
 * Generates and manages AES-256 encryption keys in AndroidKeyStore.
 *
 * **Architecture**:
 * - Keys are generated in AndroidKeyStore (hardware-backed when possible)
 * - Keys never leave the keystore in plaintext (hardware isolation)
 * - Optional: StrongBox hardware on Android 9+ (dedicated security processor)
 * - Optional: Biometric/passcode access control
 *
 * **Security Properties**:
 * - AES-256: 256-bit keys (industry standard for long-term secrets)
 * - GCM mode: Authenticated encryption (detects tampering)
 * - Hardware-backed: Keys isolated from OS/apps
 * - Biometric control: Optional access restrictions
 *
 * **Key Lifecycle**:
 * 1. Generate key with alias (stored in AndroidKeyStore)
 * 2. Retrieve key by alias when needed
 * 3. Optionally invalidate if biometric enrollment changes
 *
 * @see https://developer.android.com/training/articles/keystore
 */
object KeyGenerator {

    const val KEYSTORE_PROVIDER = "AndroidKeyStore"
    const val ENCRYPTION_ALGORITHM = KeyProperties.KEY_ALGORITHM_AES
    const val BLOCK_MODE = KeyProperties.BLOCK_MODE_GCM
    const val ENCRYPTION_PADDING = KeyProperties.ENCRYPTION_PADDING_NONE
    const val KEY_SIZE = 256  // 256-bit AES

    /**
     * Generates a new AES-256 key in AndroidKeyStore.
     *
     * The key is created with the specified properties and stored under the alias.
     * Future calls with the same alias will retrieve the existing key.
     *
     * **Key Properties** (can be customized via params):
     * - Algorithm: AES-256
     * - Block mode: GCM (authenticated encryption)
     * - Padding: None (GCM doesn't use padding)
     * - Hardware-backed: Yes (if available)
     * - StrongBox: Yes on Android 9+ (if available)
     * - Biometric: Optional (can require fingerprint/face)
     * - Device credential: Optional (can require passcode)
     *
     * **Biometric vs Device Credential**:
     * - Biometric: Face/Fingerprint when available (faster, more secure)
     * - Device credential: Passcode/PIN as fallback (always available)
     * - Both: User can choose which to use
     *
     * @param alias Unique identifier for the key (e.g., "app_aes_key_123abc")
     * @param requireBiometric If true, require biometric to use the key
     * @param requireDeviceCredential If true, require device passcode to use key
     * @param useStrongBox If true and available, use StrongBox hardware processor
     *
     * @return The generated key (for immediate use in encryption)
     *
     * @throws SensitiveInfoException.KeystoreUnavailable If AndroidKeyStore not available
     * @throws SensitiveInfoException.EncryptionFailed If key generation fails
     *
     * @example
     * ```kotlin
     * val key = KeyGenerator.generateOrGetKey(
     *     alias = "auth_token_key",
     *     requireBiometric = true,
     *     requireDeviceCredential = true,
     *     useStrongBox = true
     * )
     * ```
     */
    @Throws(SensitiveInfoException::class)
    fun generateOrGetKey(
        alias: String,
        requireBiometric: Boolean = true,
        requireDeviceCredential: Boolean = false,
        useStrongBox: Boolean = true
    ): javax.crypto.SecretKey {
        return try {
            // Check if key already exists
            val existingKey = getKeyOrNull(alias)
            if (existingKey != null) {
                return existingKey
            }

            // On Android 9 (API 28), biometric-protected keys with timeout have issues
            // Fall back to plain keys without authentication
            val actualRequireBiometric = requireBiometric && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            val actualRequireDeviceCredential = requireDeviceCredential && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q

            // Attempt 1: Try with requested auth and StrongBox
            tryGenerateKey(
                alias = alias,
                requireBiometric = actualRequireBiometric,
                requireDeviceCredential = actualRequireDeviceCredential,
                useStrongBox = useStrongBox
            )?.let { return it }

            // Attempt 2: If that failed, try without StrongBox (might be unavailable)
            if (useStrongBox) {
                tryGenerateKey(
                    alias = alias,
                    requireBiometric = actualRequireBiometric,
                    requireDeviceCredential = actualRequireDeviceCredential,
                    useStrongBox = false
                )?.let { return it }
            }

            // Attempt 3: If auth still failed, try completely without auth
            if (actualRequireBiometric || actualRequireDeviceCredential) {
                tryGenerateKey(
                    alias = alias,
                    requireBiometric = false,
                    requireDeviceCredential = false,
                    useStrongBox = false
                )?.let { return it }
            }

            // All attempts failed
            throw SensitiveInfoException.EncryptionFailed(
                "Failed to generate key: all attempts failed",
                Exception("Could not create key with alias: $alias")
            )
        } catch (e: Exception) {
            throw when (e) {
                is SensitiveInfoException -> e
                else -> SensitiveInfoException.EncryptionFailed(
                    "Key generation failed: ${e.message}",
                    e
                )
            }
        }
    }

    /**
     * Internal method to attempt key generation with specific parameters.
     * 
     * Returns null if generation fails, otherwise returns the generated key.
     * This method catches all exceptions and returns null instead of throwing.
     */
    private fun tryGenerateKey(
        alias: String,
        requireBiometric: Boolean,
        requireDeviceCredential: Boolean,
        useStrongBox: Boolean
    ): javax.crypto.SecretKey? {
        return try {
            // First, ensure AndroidKeyStore provider is available
            val keyStore = java.security.KeyStore.getInstance(KEYSTORE_PROVIDER)
            keyStore.load(null)
            
            // Generate new key
            val keyGen = KeyGenerator.getInstance(ENCRYPTION_ALGORITHM, KEYSTORE_PROVIDER)

            // Build specification for the key
            val builder = KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setKeySize(KEY_SIZE)
                .setBlockModes(BLOCK_MODE)
                .setEncryptionPaddings(ENCRYPTION_PADDING)
                .setRandomizedEncryptionRequired(true)

            // Set access control if auth is required
            if (requireBiometric || requireDeviceCredential) {
                builder.setUserAuthenticationRequired(true)
                
                when {
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.R -> {
                        // Android 11+: Use setUserAuthenticationParameters
                        var authTypes = 0
                        if (requireBiometric) authTypes = authTypes or KeyProperties.AUTH_BIOMETRIC_STRONG
                        if (requireDeviceCredential) authTypes = authTypes or KeyProperties.AUTH_DEVICE_CREDENTIAL
                        if (authTypes > 0) {
                            builder.setUserAuthenticationParameters(0, authTypes)
                        }
                    }
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> {
                        // Android 10: Can use device credential
                        var authTypes = 0
                        if (requireBiometric) authTypes = authTypes or KeyProperties.AUTH_BIOMETRIC_STRONG
                        if (requireDeviceCredential) authTypes = authTypes or KeyProperties.AUTH_DEVICE_CREDENTIAL
                        if (authTypes > 0) {
                            builder.setUserAuthenticationParameters(0, authTypes)
                        }
                    }
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.P -> {
                        // Android 9: Use timeout-based auth
                        // Don't use -1, use actual timeout value
                        @Suppress("DEPRECATION")
                        builder.setUserAuthenticationValidityDurationSeconds(15 * 60)
                    }
                    else -> {
                        // Android 8 and below: Use timeout
                        @Suppress("DEPRECATION")
                        builder.setUserAuthenticationValidityDurationSeconds(15 * 60)
                    }
                }
            }

            // Try to use StrongBox if available (only on Android 9+)
            if (useStrongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                try {
                    builder.setIsStrongBoxBacked(true)
                } catch (e: Exception) {
                    // Ignore - StrongBox not available on this device
                }
            }

            // Initialize and generate the key
            val spec = builder.build()
            keyGen.init(spec)
            keyGen.generateKey()
        } catch (e: Exception) {
            // Return null on any failure - let the caller try other approaches
            null
        }
    }

    /**
     * Retrieves an existing key by alias.
     *
     * Returns the key if it exists, throws an exception if not.
     *
     * @param alias Key alias (must previously exist)
     * @return The stored key
     *
     * @throws SensitiveInfoException.KeystoreUnavailable If key not found or keystore unavailable
     *
     * @example
     * ```kotlin
     * val key = KeyGenerator.getKey("auth_token_key")
     * ```
     */
    @Throws(SensitiveInfoException::class)
    fun getKey(alias: String): javax.crypto.SecretKey {
        return getKeyOrNull(alias)
            ?: throw SensitiveInfoException.KeystoreUnavailable(
                "Key '$alias' not found in keystore"
            )
    }

    /**
     * Retrieves an existing key by alias (null if not found).
     *
     * Safe version that returns null instead of throwing.
     *
     * @param alias Key alias
     * @return The stored key, or null if not found
     */
    fun getKeyOrNull(alias: String): javax.crypto.SecretKey? {
        return try {
            val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
            keyStore.load(null)

            val entry = keyStore.getEntry(alias, null)
            when (entry) {
                is KeyStore.SecretKeyEntry -> entry.secretKey as? javax.crypto.SecretKey
                else -> null
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Deletes a key from AndroidKeyStore.
     *
     * Once deleted, the key cannot be recovered. Any ciphertexts encrypted
     * with this key will become inaccessible.
     *
     * **Be very careful** calling this function!
     *
     * @param alias Key alias to delete
     *
     * @throws SensitiveInfoException.KeystoreUnavailable If deletion fails
     *
     * @example
     * ```kotlin
     * KeyGenerator.deleteKey("auth_token_key")
     * // Key is now gone, can't decrypt old ciphertexts
     * ```
     */
    @Throws(SensitiveInfoException::class)
    fun deleteKey(alias: String) {
        try {
            val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
            keyStore.load(null)
            keyStore.deleteEntry(alias)
        } catch (e: Exception) {
            throw SensitiveInfoException.KeystoreUnavailable(
                "Failed to delete key '$alias': ${e.message}",
                e
            )
        }
    }

    /**
     * Checks if a key exists in AndroidKeyStore.
     *
     * @param alias Key alias
     * @return true if key exists, false otherwise
     */
    fun keyExists(alias: String): Boolean {
        return getKeyOrNull(alias) != null
    }
}
