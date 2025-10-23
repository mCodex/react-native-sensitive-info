package com.sensitiveinfo.internal.storage

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.util.Base64
import androidx.biometric.BiometricManager.Authenticators
import androidx.fragment.app.FragmentActivity
import com.sensitiveinfo.internal.auth.BiometricAuthenticator
import com.sensitiveinfo.internal.auth.AuthenticationPrompt
import com.sensitiveinfo.internal.crypto.AccessResolution
import com.sensitiveinfo.internal.crypto.CryptoManager
import com.sensitiveinfo.internal.crypto.LegacyCryptoManager
import com.sensitiveinfo.internal.crypto.IVManager
import com.sensitiveinfo.internal.crypto.KeyGenerator
import com.sensitiveinfo.internal.util.SensitiveInfoException
import com.sensitiveinfo.internal.util.ServiceNameResolver
import com.sensitiveinfo.internal.util.AccessControlResolver
import com.sensitiveinfo.internal.util.AccessControlConfig
import com.sensitiveinfo.internal.util.AccessControl
import com.sensitiveinfo.internal.util.SecurityLevel

/**
 * Secure storage for sensitive data using encrypted SharedPreferences.
 *
 * **Architecture**:
 * - Uses Android SharedPreferences as underlying storage
 * - Each secret encrypted with AES-GCM (random IV per operation)
 * - IV stored alongside ciphertext (not secret)
 * - Metadata stored separately
 *
 * **Security Model**:
 * 1. Android SharedPreferences are private to the app
 * 2. Encryption happens in AndroidKeyStore (hardware-backed)
 * 3. Each value encrypted with random IV (no deterministic patterns)
 * 4. Authentication tag verifies integrity (detects tampering)
 *
 * **API**:
 * - setItem(key, value, service, options) → Encrypt and store
 * - getItem(key, service) → Retrieve and decrypt
 * - deleteItem(key, service) → Remove from storage
 * - hasItem(key, service) → Check existence
 * - getAllItems(service) → List all keys in service
 * - clearService(service) → Delete all secrets in service
 *
 * @property context Android context (for SharedPreferences access)
 * @property preferencesName Name of SharedPreferences file (default: "sensitive_info")
 * @property activity Optional FragmentActivity for biometric prompts on Android 9
 *
 * @see CryptoManager For encryption/decryption
 * @see PersistedEntry For data model
 */
class SecureStorage(
    private val context: Context,
    private val preferencesName: String = "sensitive_info",
    private val activity: FragmentActivity? = null
) {

    companion object {
        private const val CURRENT_VERSION = 3
        private const val LEGACY_METADATA_VERSION = 2
        private const val AUTH_NONE = 0
        private const val AUTH_BIOMETRIC_ONLY = 1
        private const val AUTH_DEVICE_ONLY = 2
        private const val AUTH_BIOMETRIC_AND_DEVICE = 3
    }

    private val preferences: SharedPreferences
        get() = context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)

    /**
     * Stores an encrypted secret in SharedPreferences.
     *
     * **Workflow**:
     * 1. Generate key alias for this secret
     * 2. Create CryptoManager (may trigger biometric setup)
     * 3. Encrypt plaintext → (ciphertext, IV)
     * 4. Create PersistedEntry with metadata
     * 5. Store in SharedPreferences as JSON
     *
     * @param key Unique identifier for the secret (e.g., "auth-token")
     * @param value Plaintext value to encrypt
     * @param service Service namespace (defaults to app package name)
     * @param accessControl Requested access control (defaults to "secureEnclaveBiometry")
     * @param useStrongBox Use StrongBox hardware if available
     *
     * @return StorageMetadata describing what was stored
     *
     * @throws SensitiveInfoException.EncryptionFailed If encryption fails
     * @throws SensitiveInfoException.KeystoreUnavailable If keystore unavailable
     *
     * @example
     * ```kotlin
     * val storage = SecureStorage(context)
     *
     * val metadata = storage.setItem(
     *     key = "auth-token",
     *     value = "jwt-token-xyz",
     *     service = "myapp",
     *     accessControl = "secureEnclaveBiometry"
     * )
     *
     * println("Stored with security: ${metadata.securityLevel}")
     * ```
     */
    @Throws(SensitiveInfoException::class)
    suspend fun setItem(
        key: String,
        value: String,
        service: String? = null,
        accessControl: String? = null,
        useStrongBox: Boolean = true,
        prompt: AuthenticationPrompt? = null
    ): StorageMetadata {
        val resolvedService = ServiceNameResolver.resolve(context, service)
        val baseConfig = AccessControlResolver.resolve(accessControl)
        val accessConfig = baseConfig.withStrongBoxPreference(useStrongBox)

        val keyAlias = generateKeyAlias(resolvedService, key)
        val timestamp = System.currentTimeMillis() / 1000

        return saveEntryModern(
            resolvedService = resolvedService,
            key = key,
            value = value,
            accessControl = accessControl,
            accessConfig = accessConfig,
            keyAlias = keyAlias,
            prompt = prompt,
            timestamp = timestamp
        )
    }

    /**
     * Retrieves and decrypts a stored secret.
     *
     * **Workflow**:
     * 1. Look up entry in SharedPreferences
     * 2. Parse JSON to PersistedEntry
     * 3. Decode IV and ciphertext from Base64
     * 4. Create CryptoManager
     * 5. Decrypt using stored IV
     * 6. Return plaintext
     *
     * @param key Secret identifier
     * @param service Service namespace (defaults to app package name)
     *
     * @return Decrypted secret with metadata, or null if not found
     *
     * @throws SensitiveInfoException.DecryptionFailed If decryption fails
     * @throws SensitiveInfoException.KeyInvalidated If biometric enrollment changed
     * @throws SensitiveInfoException.KeystoreUnavailable If key not accessible
     *
     * @example
     * ```kotlin
     * val storage = SecureStorage(context)
     *
     * val result = storage.getItem("auth-token", "myapp")
     * if (result != null) {
     *     println("Token: ${result.value}")
     *     println("Security: ${result.metadata.securityLevel}")
     * } else {
     *     println("Token not found")
     * }
     * ```
     */
    @Throws(SensitiveInfoException::class)
    suspend fun getItem(
        key: String,
        service: String? = null
    ): StorageResult? {
        val resolvedService = ServiceNameResolver.resolve(context, service)
        val storageKey = "$resolvedService::$key"

        // Look up in SharedPreferences
        val json = preferences.getString(storageKey, null)
            ?: return null

        // Parse JSON
        val entry = PersistedEntry.fromJson(json)
            ?: throw SensitiveInfoException.DecryptionFailed("Failed to parse stored entry")

        val keyAlias = generateKeyAlias(resolvedService, key)
        val decodedCiphertext = decodeCiphertext(entry.ciphertext)
        val decodedIv = decodeIv(entry.iv)

        val (plaintextBytes, migrated) = decryptEntry(
            keyAlias = keyAlias,
            entry = entry,
            ciphertext = decodedCiphertext,
            iv = decodedIv,
            resolvedService = resolvedService,
            originalKey = key
        )

        val plaintext = String(plaintextBytes, Charsets.UTF_8)

        val freshEntry = if (migrated) {
            preferences.getString("$resolvedService::$key", null)
                ?.let { PersistedEntry.fromJson(it) }
                ?: entry
        } else {
            entry
        }

        val metadata = StorageMetadata(
            securityLevel = freshEntry.securityLevel,
            accessControl = freshEntry.accessControl,
            backend = "preferences",
            timestamp = freshEntry.timestamp
        )

        return StorageResult(value = plaintext, metadata = metadata)
    }

    /**
     * Deletes a stored secret.
     *
     * @param key Secret identifier
     * @param service Service namespace
     *
     * @throws SensitiveInfoException.KeystoreUnavailable If deletion fails
     */
    @Throws(SensitiveInfoException::class)
    fun deleteItem(
        key: String,
        service: String? = null
    ) {
        val resolvedService = ServiceNameResolver.resolve(context, service)
        val storageKey = "$resolvedService::$key"

        preferences.edit().remove(storageKey).apply()

        // Also delete the key from keystore
        val keyAlias = generateKeyAlias(resolvedService, key)
        try {
            val crypto = LegacyCryptoManager(keyAlias)
            crypto.invalidateKey()
        } catch (e: Exception) {
            // Key may not exist, that's OK
        }
    }

    /**
     * Checks if a secret exists.
     *
     * @param key Secret identifier
     * @param service Service namespace
     *
     * @return true if the secret exists and can be retrieved
     */
    fun hasItem(key: String, service: String? = null): Boolean {
        val resolvedService = ServiceNameResolver.resolve(context, service)
        val storageKey = "$resolvedService::$key"
        return preferences.contains(storageKey)
    }

    /**
     * Retrieves all secret keys in a service.
     *
     * @param service Service namespace
     *
     * @return List of key names (does not return values)
     */
    fun getAllItems(service: String? = null): List<String> {
        val resolvedService = ServiceNameResolver.resolve(context, service)
        val prefix = "$resolvedService::"

        return preferences.all.keys.asSequence()
            .filter { it.startsWith(prefix) }
            .map { it.removePrefix(prefix) }
            .toList()
    }

    /**
     * Deletes all secrets in a service.
     *
     * **Warning**: This is irreversible!
     *
     * @param service Service namespace
     *
     * @throws SensitiveInfoException.KeystoreUnavailable If cleanup fails
     */
    @Throws(SensitiveInfoException::class)
    fun clearService(service: String? = null) {
        val resolvedService = ServiceNameResolver.resolve(context, service)
        val prefix = "$resolvedService::"

        // Get all keys to delete
        val keysToDelete = preferences.all.keys.asSequence()
            .filter { it.startsWith(prefix) }
            .toList()

        // Delete from preferences
        preferences.edit().apply {
            keysToDelete.forEach { remove(it) }
        }.apply()

        // Delete keys from keystore
        for (storageKey in keysToDelete) {
            val key = storageKey.removePrefix(prefix)
            val keyAlias = generateKeyAlias(resolvedService, key)
            try {
                val crypto = LegacyCryptoManager(keyAlias)
                crypto.invalidateKey()
            } catch (e: Exception) {
                // Key may not exist, continue
            }
        }
    }

    /**
     * Pre-creates an encryption key in the Android KeyStore with the specified access control.
     *
     * **Purpose**:
     * This method should be called BEFORE encryption happens, to ensure the key exists.
     * This is especially important for biometric-protected keys, because:
     * 1. Key is created with biometric access control
     * 2. When encryption happens later, Android uses the existing key
     * 3. AndroidKeyStore automatically triggers biometric prompt during cipher initialization
     * 4. User authenticates
     * 5. Cipher is initialized successfully
     * 6. Encryption proceeds
     *
     * **Without pre-creation**:
     * If you try to encrypt without creating the key first, CryptoManager.encrypt() will fail
     * because it calls KeyGenerator.getKey() which throws an exception if the key doesn't exist.
     *
     * **With pre-creation** (this method):
     * The key is created upfront with the correct access control settings, so encryption
     * will use the existing key and can proceed with authentication if needed.
     *
     * @param key Secret identifier
     * @param service Service namespace (defaults to app package name)
     * @param accessControl Requested access control (defaults to "secureEnclaveBiometry")
     * @param useStrongBox Use StrongBox hardware if available
     *
     * @throws SensitiveInfoException.KeystoreUnavailable If key creation fails
     *
     * @example
     * ```kotlin
     * val storage = SecureStorage(context)
     *
     * // Before storing a biometric-protected secret:
     * storage.prepareKey(
     *     key = "auth-token",
     *     service = "myapp",
     *     accessControl = "secureEnclaveBiometry"
     * )
     *
     * // Now you can safely store:
     * val metadata = storage.setItem(
     *     key = "auth-token",
     *     value = "secret-value",
     *     service = "myapp",
     *     accessControl = "secureEnclaveBiometry"
     * )
     * ```
     */
    @Throws(SensitiveInfoException::class)
    fun prepareKey(
        key: String,
        service: String? = null,
        accessControl: String? = null,
        useStrongBox: Boolean = true
    ) {
        val resolvedService = ServiceNameResolver.resolve(context, service)
        val accessConfig = AccessControlResolver.resolve(accessControl).withStrongBoxPreference(useStrongBox)
        val keyAlias = generateKeyAlias(resolvedService, key)

        val crypto = CryptoManager(authenticator = null)
        try {
            crypto.ensureKey(keyAlias, buildResolution(accessConfig))
        } catch (e: SensitiveInfoException) {
            throw e
        } catch (e: Exception) {
            throw SensitiveInfoException.KeystoreUnavailable(
                "Failed to prepare key: ${e.message}",
                e
            )
        }
    }

    /**
     * Generates unique key alias for a (service, key) pair.
     *
     * @param service Service namespace
     * @param key Secret identifier
     *
     * @return Unique key alias for AndroidKeyStore (alphanumeric only)
     */
    private fun generateKeyAlias(service: String, key: String): String {
        // Create deterministic alias: sha256(service::key)
        val combined = "$service::$key"
        val digest = java.security.MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(combined.toByteArray())
        // Use hex encoding instead of Base64 to avoid "/" and "+" characters
        val hexString = hash.joinToString("") { "%02x".format(it) }
        // Return first 32 characters (128 bits)
        return hexString.take(32)
    }

    private suspend fun saveEntryModern(
        resolvedService: String,
        key: String,
        value: String,
        accessControl: String?,
        accessConfig: AccessControlConfig,
        keyAlias: String,
        prompt: AuthenticationPrompt?,
        timestamp: Long
    ): StorageMetadata {
        val authenticator = if (accessConfig.requiresAuthentication) {
            val hostActivity = activity ?: throw SensitiveInfoException.EncryptionFailed(
                "Authentication requires an active FragmentActivity",
                IllegalStateException("No active FragmentActivity registered")
            )
            BiometricAuthenticator(context, hostActivity)
        } else {
            null
        }

        val crypto = CryptoManager(authenticator)
        val resolution = buildResolution(accessConfig)
        val encrypted = crypto.encrypt(
            alias = keyAlias,
            plaintext = value.toByteArray(Charsets.UTF_8),
            resolution = resolution,
            prompt = prompt
        )

        val storedAccessControl = accessControl ?: accessConfig.preferenceName()
        val entry = PersistedEntry(
            key = key,
            service = resolvedService,
            ciphertext = Base64.encodeToString(encrypted.ciphertext, Base64.NO_WRAP),
            iv = IVManager.encodeToBase64(encrypted.iv),
            timestamp = timestamp,
            securityLevel = securityLevelMetadata(accessConfig.securityLevel),
            accessControl = storedAccessControl,
            version = CURRENT_VERSION,
            authenticators = accessConfig.allowedAuthenticators,
            requiresAuthentication = accessConfig.requiresAuthentication,
            invalidateOnEnrollment = accessConfig.invalidateOnEnrollment,
            useStrongBox = accessConfig.useStrongBox
        )

        preferences.edit()
            .putString(entry.getStorageKey(), entry.toJson())
            .apply()

        return StorageMetadata(
            securityLevel = entry.securityLevel,
            accessControl = entry.accessControl,
            backend = "preferences",
            timestamp = entry.timestamp
        )
    }

    private fun saveEntryLegacy(
        resolvedService: String,
        key: String,
        value: String,
        accessControl: String?,
        accessConfig: AccessControlConfig,
        keyAlias: String,
        timestamp: Long
    ): StorageMetadata {
        val crypto = LegacyCryptoManager(keyAlias)
        val encrypted = crypto.encrypt(value.toByteArray(Charsets.UTF_8))

        val storedAccessControl = accessControl ?: accessConfig.preferenceName()
        val securityLevel = when {
            accessConfig.requireBiometric -> "biometry"
            accessConfig.requireDeviceCredential -> "deviceCredential"
            else -> "software"
        }

        val entry = PersistedEntry(
            key = key,
            service = resolvedService,
            ciphertext = Base64.encodeToString(encrypted.ciphertext, Base64.NO_WRAP),
            iv = IVManager.encodeToBase64(encrypted.iv),
            timestamp = timestamp,
            securityLevel = securityLevel,
            accessControl = storedAccessControl,
            version = LEGACY_METADATA_VERSION,
            authenticators = when {
                accessConfig.requireBiometric && accessConfig.requireDeviceCredential -> AUTH_BIOMETRIC_AND_DEVICE
                accessConfig.requireBiometric -> AUTH_BIOMETRIC_ONLY
                accessConfig.requireDeviceCredential -> AUTH_DEVICE_ONLY
                else -> AUTH_NONE
            },
            requiresAuthentication = accessConfig.requiresAuthentication,
            invalidateOnEnrollment = accessConfig.invalidateOnEnrollment,
            useStrongBox = accessConfig.useStrongBox
        )

        preferences.edit()
            .putString(entry.getStorageKey(), entry.toJson())
            .apply()

        return StorageMetadata(
            securityLevel = entry.securityLevel,
            accessControl = entry.accessControl,
            backend = "preferences",
            timestamp = entry.timestamp
        )
    }

    private fun decodeCiphertext(encoded: String): ByteArray {
        return try {
            Base64.decode(encoded, Base64.NO_WRAP)
        } catch (e: Exception) {
            throw SensitiveInfoException.DecryptionFailed(
                "Failed to decode ciphertext from storage: ${e.message}",
                e
            )
        }
    }

    private fun decodeIv(encoded: String): ByteArray {
        return try {
            IVManager.decodeFromBase64(encoded)
        } catch (e: Exception) {
            throw SensitiveInfoException.DecryptionFailed(
                "Failed to decode IV from storage: ${e.message}",
                e
            )
        }
    }

    private suspend fun decryptEntry(
        keyAlias: String,
        entry: PersistedEntry,
        ciphertext: ByteArray,
        iv: ByteArray,
        resolvedService: String,
        originalKey: String
    ): Pair<ByteArray, Boolean> {
        val version = entry.version ?: 1
        return if (version >= CURRENT_VERSION) {
            decryptModern(keyAlias, entry, ciphertext, iv)
        } else {
            decryptLegacy(
                keyAlias = keyAlias,
                entry = entry,
                ciphertext = ciphertext,
                iv = iv,
                resolvedService = resolvedService,
                originalKey = originalKey,
                version = version
            )
        }
    }

    private suspend fun decryptModern(
        keyAlias: String,
        entry: PersistedEntry,
        ciphertext: ByteArray,
        iv: ByteArray
    ): Pair<ByteArray, Boolean> {
        val resolution = buildResolutionFromEntry(entry)
        val authenticator = if (resolution.requiresAuthentication) {
            val hostActivity = activity ?: throw SensitiveInfoException.DecryptionFailed(
                "Authentication requires an active FragmentActivity",
                IllegalStateException("No active FragmentActivity registered")
            )
            BiometricAuthenticator(context, hostActivity)
        } else {
            null
        }

        val crypto = CryptoManager(authenticator)
        val plaintext = crypto.decrypt(
            alias = keyAlias,
            ciphertext = ciphertext,
            iv = iv,
            resolution = resolution,
            prompt = null
        )

        return plaintext to false
    }

    private suspend fun decryptLegacy(
        keyAlias: String,
        entry: PersistedEntry,
        ciphertext: ByteArray,
        iv: ByteArray,
        resolvedService: String,
        originalKey: String,
        version: Int
    ): Pair<ByteArray, Boolean> {
        if (Build.VERSION.SDK_INT == Build.VERSION_CODES.P &&
            entry.securityLevel.equals("biometry", ignoreCase = true) &&
            activity != null) {

            val bioAuth = BiometricAuthenticator(context, activity)
            try {
                bioAuth.authenticate(
                    prompt = AuthenticationPrompt(
                        title = "Authenticate",
                        subtitle = "Biometric authentication required",
                        description = "Authenticate to access your secure data",
                        cancel = "Cancel"
                    ),
                    cipher = null,
                    allowDeviceCredential = true
                )
            } catch (e: SensitiveInfoException.AuthenticationCanceled) {
                throw SensitiveInfoException.DecryptionFailed(
                    "Authentication canceled by user",
                    e
                )
            } catch (e: SensitiveInfoException.BiometryLockout) {
                throw SensitiveInfoException.DecryptionFailed(
                    "Biometric locked due to too many failed attempts",
                    e
                )
            }
        }

        val crypto = LegacyCryptoManager(keyAlias)
        val plaintext = crypto.decrypt(ciphertext, iv)

        val migrated = version < LEGACY_METADATA_VERSION
        if (migrated) {
            migrateLegacyEntry(
                resolvedService = resolvedService,
                key = originalKey,
                plaintext = String(plaintext, Charsets.UTF_8),
                previous = entry,
                keyAlias = keyAlias
            )
        }
        return plaintext to migrated
    }

    private fun migrateLegacyEntry(
        resolvedService: String,
        key: String,
        plaintext: String,
        previous: PersistedEntry,
        keyAlias: String
    ) {
        val baseConfig = AccessControlResolver.resolve(previous.accessControl)
        val accessConfig = baseConfig.withStrongBoxPreference(previous.useStrongBox == true)
        try {
            // Ensure key exists (legacy stores may have lost it if user cleared keystore manually)
            KeyGenerator.generateOrGetKey(
                alias = keyAlias,
                requireBiometric = accessConfig.requireBiometric,
                requireDeviceCredential = accessConfig.requireDeviceCredential,
                useStrongBox = accessConfig.useStrongBox
            )
        } catch (ignored: Exception) {
            // We'll attempt to proceed; encryption will fail if key truly unavailable.
        }

        saveEntryLegacy(
            resolvedService = resolvedService,
            key = key,
            value = plaintext,
            accessControl = previous.accessControl,
            accessConfig = accessConfig,
            keyAlias = keyAlias,
            timestamp = previous.timestamp
        )
    }

    private fun buildResolution(config: AccessControlConfig): AccessResolution {
        return AccessResolution(
            accessControl = config.policy,
            securityLevel = config.securityLevel,
            requiresAuthentication = config.requiresAuthentication,
            allowedAuthenticators = config.allowedAuthenticators,
            useStrongBox = config.useStrongBox,
            invalidateOnEnrollment = config.invalidateOnEnrollment
        )
    }

    private fun buildResolutionFromEntry(entry: PersistedEntry): AccessResolution {
        val fallbackConfig = AccessControlResolver.resolve(entry.accessControl)
        val authenticators = when (entry.version ?: 1) {
            in Int.MIN_VALUE until LEGACY_METADATA_VERSION -> mapLegacyAuthenticatorFlags(entry.authenticators, fallbackConfig.allowedAuthenticators)
            LEGACY_METADATA_VERSION -> mapLegacyAuthenticatorFlags(entry.authenticators, fallbackConfig.allowedAuthenticators)
            else -> entry.authenticators ?: fallbackConfig.allowedAuthenticators
        }

        val requiresAuthentication = entry.requiresAuthentication
            ?: fallbackConfig.requiresAuthentication

        val invalidateOnEnrollment = entry.invalidateOnEnrollment
            ?: fallbackConfig.invalidateOnEnrollment

        val useStrongBox = entry.useStrongBox ?: fallbackConfig.useStrongBox

        val accessPolicy = mapAccessControl(entry.accessControl)
        val securityLevel = mapSecurityLevel(entry.securityLevel, fallbackConfig.securityLevel)

        return AccessResolution(
            accessControl = accessPolicy,
            securityLevel = securityLevel,
            requiresAuthentication = requiresAuthentication,
            allowedAuthenticators = authenticators,
            useStrongBox = useStrongBox,
            invalidateOnEnrollment = invalidateOnEnrollment
        )
    }

    private fun mapLegacyAuthenticatorFlags(value: Int?, fallback: Int): Int {
        return when (value) {
            AUTH_BIOMETRIC_AND_DEVICE -> Authenticators.BIOMETRIC_STRONG or Authenticators.DEVICE_CREDENTIAL
            AUTH_BIOMETRIC_ONLY -> Authenticators.BIOMETRIC_STRONG
            AUTH_DEVICE_ONLY -> Authenticators.DEVICE_CREDENTIAL
            else -> fallback
        }
    }

    private fun mapAccessControl(value: String?): AccessControl {
        return when (value) {
            "secureEnclaveBiometry" -> AccessControl.SECUREENCLAVEBIOMETRY
            "biometryCurrentSet" -> AccessControl.BIOMETRYCURRENTSET
            "biometryAny" -> AccessControl.BIOMETRYANY
            "devicePasscode" -> AccessControl.DEVICEPASSCODE
            "none" -> AccessControl.NONE
            else -> AccessControl.SECUREENCLAVEBIOMETRY
        }
    }

    private fun mapSecurityLevel(value: String?, fallback: SecurityLevel): SecurityLevel {
        return when (value?.lowercase()) {
            "secureenclave" -> SecurityLevel.SECUREENCLAVE
            "strongbox" -> SecurityLevel.STRONGBOX
            "biometry" -> SecurityLevel.BIOMETRY
            "devicecredential" -> SecurityLevel.DEVICECREDENTIAL
            "software" -> SecurityLevel.SOFTWARE
            else -> fallback
        }
    }

    private fun securityLevelMetadata(level: SecurityLevel): String {
        return when (level) {
            SecurityLevel.SECUREENCLAVE -> "secureEnclave"
            SecurityLevel.STRONGBOX -> "strongBox"
            SecurityLevel.BIOMETRY -> "biometry"
            SecurityLevel.DEVICECREDENTIAL -> "deviceCredential"
            SecurityLevel.SOFTWARE -> "software"
        }
    }
}

/**
 * Result of a retrieve operation.
 */
data class StorageResult(
    val value: String?,
    val metadata: StorageMetadata
)
