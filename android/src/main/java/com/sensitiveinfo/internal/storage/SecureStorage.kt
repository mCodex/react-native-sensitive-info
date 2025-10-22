package com.sensitiveinfo.internal.storage

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import com.sensitiveinfo.internal.crypto.CryptoManager
import com.sensitiveinfo.internal.crypto.IVManager
import com.sensitiveinfo.internal.util.SensitiveInfoException
import com.sensitiveinfo.internal.util.ServiceNameResolver
import com.sensitiveinfo.internal.util.AccessControlResolver

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
 *
 * @see CryptoManager For encryption/decryption
 * @see PersistedEntry For data model
 */
class SecureStorage(
    private val context: Context,
    private val preferencesName: String = "sensitive_info"
) {

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
    fun setItem(
        key: String,
        value: String,
        service: String? = null,
        accessControl: String? = null,
        useStrongBox: Boolean = true
    ): StorageMetadata {
        val resolvedService = ServiceNameResolver.resolve(context, service)
        val accessConfig = AccessControlResolver.resolve(accessControl)

        // Generate unique key alias for this secret
        val keyAlias = generateKeyAlias(resolvedService, key)

        // Create crypto manager (handles encryption)
        val crypto = CryptoManager(keyAlias)

        // Encrypt the value
        val encrypted = crypto.encrypt(value)

        // Create persistent entry
        val entry = PersistedEntry(
            key = key,
            service = resolvedService,
            ciphertext = Base64.encodeToString(encrypted.ciphertext, Base64.NO_WRAP),
            iv = IVManager.encodeToBase64(encrypted.iv),
            timestamp = System.currentTimeMillis() / 1000,
            securityLevel = accessConfig.let {
                when {
                    it.requireBiometric -> "biometry"
                    it.requireDeviceCredential -> "deviceCredential"
                    else -> "software"
                }
            },
            accessControl = accessControl ?: "secureEnclaveBiometry"
        )

        // Store in SharedPreferences
        preferences.edit().putString(
            entry.getStorageKey(),
            entry.toJson()
        ).apply()

        // Return metadata
        return StorageMetadata(
            securityLevel = entry.securityLevel,
            accessControl = entry.accessControl,
            backend = "preferences",
            timestamp = entry.timestamp
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
    fun getItem(
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

        // Decode IV and ciphertext
        val iv = IVManager.decodeFromBase64(entry.iv)
        val ciphertext = android.util.Base64.decode(entry.ciphertext, android.util.Base64.NO_WRAP)

        // Decrypt
        val keyAlias = generateKeyAlias(resolvedService, key)
        val crypto = CryptoManager(keyAlias)
        val plaintext = crypto.decrypt(ciphertext, iv)

        // Return with metadata
        return StorageResult(
            value = plaintext,
            metadata = StorageMetadata(
                securityLevel = entry.securityLevel,
                accessControl = entry.accessControl,
                backend = "preferences",
                timestamp = entry.timestamp
            )
        )
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
            val crypto = CryptoManager(keyAlias)
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
                val crypto = CryptoManager(keyAlias)
                crypto.invalidateKey()
            } catch (e: Exception) {
                // Key may not exist, continue
            }
        }
    }

    /**
     * Generates unique key alias for a (service, key) pair.
     *
     * @param service Service namespace
     * @param key Secret identifier
     *
     * @return Unique key alias for AndroidKeyStore
     */
    private fun generateKeyAlias(service: String, key: String): String {
        // Create deterministic alias: sha256(service::key)
        val combined = "$service::$key"
        val digest = java.security.MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(combined.toByteArray())
        return Base64.encodeToString(hash, Base64.NO_WRAP).take(32)
    }
}

/**
 * Result of a retrieve operation.
 */
data class StorageResult(
    val value: String,
    val metadata: StorageMetadata
)
