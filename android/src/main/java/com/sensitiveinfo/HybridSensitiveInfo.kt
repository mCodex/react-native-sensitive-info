package com.sensitiveinfo

import com.margelo.nitro.core.Promise
import com.margelo.nitro.sensitiveinfo.AccessControl
import com.margelo.nitro.sensitiveinfo.AuthenticationPrompt
import com.margelo.nitro.sensitiveinfo.HybridSensitiveInfoSpec
import com.margelo.nitro.sensitiveinfo.MutationResult
import com.margelo.nitro.sensitiveinfo.SecurityAvailability
import com.margelo.nitro.sensitiveinfo.SecurityLevel
import com.margelo.nitro.sensitiveinfo.SensitiveInfoDeleteRequest
import com.margelo.nitro.sensitiveinfo.SensitiveInfoEnumerateRequest
import com.margelo.nitro.sensitiveinfo.SensitiveInfoGetRequest
import com.margelo.nitro.sensitiveinfo.SensitiveInfoHasRequest
import com.margelo.nitro.sensitiveinfo.SensitiveInfoItem
import com.margelo.nitro.sensitiveinfo.SensitiveInfoOptions
import com.margelo.nitro.sensitiveinfo.SensitiveInfoSetRequest
import com.margelo.nitro.sensitiveinfo.StorageBackend
import com.margelo.nitro.sensitiveinfo.StorageMetadata
import com.sensitiveinfo.internal.auth.BiometricAuthenticator
import com.sensitiveinfo.internal.crypto.AccessControlResolver
import com.sensitiveinfo.internal.crypto.CryptoManager
import com.sensitiveinfo.internal.crypto.SecurityAvailabilityResolver
import com.sensitiveinfo.internal.storage.PersistedEntry
import com.sensitiveinfo.internal.storage.PersistedMetadata
import com.sensitiveinfo.internal.storage.SecureStorage
import com.sensitiveinfo.internal.util.AliasGenerator
import com.sensitiveinfo.internal.util.ReactContextHolder
import com.sensitiveinfo.internal.util.SensitiveInfoException
import com.sensitiveinfo.internal.util.ServiceNameResolver
import com.sensitiveinfo.internal.util.accessControlFromPersisted
import com.sensitiveinfo.internal.util.storageBackendFromPersisted
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.text.Charsets

/**
 * Android implementation of the SensitiveInfo Nitro module.
 *
 * All calls happen on Nitro managed promises, so the JS side can simply import the generated
 * functions:
 *
 * ```ts
 * import { setItem } from 'react-native-sensitive-info'
 * await setItem('bank-pin', '1234', { accessControl: 'secureEnclaveBiometry' })
 * ```
 *
 * The class resolves the appropriate storage backend, encrypts values with the Android Keystore,
 * and keeps metadata so JavaScript consumers always know which security tier saved an entry.
 */
class HybridSensitiveInfo : HybridSensitiveInfoSpec() {
    private val applicationContext get() = ReactContextHolder.requireContext()

    private val storage by lazy { SecureStorage(applicationContext) }
    private val serviceResolver by lazy { ServiceNameResolver(applicationContext) }
    private val availabilityResolver by lazy { SecurityAvailabilityResolver(applicationContext) }
    private val accessControlResolver by lazy { AccessControlResolver(availabilityResolver) }
    private val authenticator by lazy { BiometricAuthenticator() }
    private val cryptoManager by lazy { CryptoManager(authenticator) }

    /**
     * Encrypts and stores a secret for the requested service/key pair.
     *
     * @return Metadata describing the security level used, mirroring the JS `MutationResult` type.
     */
    override fun setItem(request: SensitiveInfoSetRequest): Promise<MutationResult> {
        return Promise.async {
            val service = serviceResolver.resolve(request.service)
            val strongOnly = request.androidBiometricsStrongOnly == true
            val resolution = accessControlResolver.resolve(request.accessControl, strongOnly)
            val alias = AliasGenerator.create(service, resolution.signature)

            val previousEntry = withContext(Dispatchers.IO) {
                storage.read(service, request.key)
            }

            val metadata = StorageMetadata(
                securityLevel = resolution.securityLevel,
                backend = StorageBackend.ANDROIDKEYSTORE,
                accessControl = resolution.accessControl,
                timestamp = nowSeconds()
            )

            val encryptionResult = cryptoManager.encrypt(
                alias = alias,
                plaintext = request.value.toByteArray(Charsets.UTF_8),
                resolution = resolution,
                prompt = request.authenticationPrompt
            )

            val persisted = PersistedEntry(
                alias = alias,
                ciphertext = encryptionResult.ciphertext,
                iv = encryptionResult.iv,
                metadata = PersistedMetadata.from(metadata),
                authenticators = resolution.allowedAuthenticators,
                requiresAuthentication = resolution.requiresAuthentication,
                invalidateOnEnrollment = resolution.invalidateOnEnrollment,
                useStrongBox = resolution.useStrongBox
            )

            withContext(Dispatchers.IO) {
                storage.save(service, request.key, persisted)
            }

            if (previousEntry != null && previousEntry.alias != alias) {
                maybeDeleteAlias(service, previousEntry.alias)
            }

            MutationResult(metadata)
        }
    }

    /**
     * Reads a single item; optionally decrypts the payload if JS requested the plaintext value.
     */
    override fun getItem(request: SensitiveInfoGetRequest): Promise<SensitiveInfoItem?> {
        return Promise.async {
            val includeValue = request.includeValue ?: true
            val service = serviceResolver.resolve(request.service)
                        val entry = withContext(Dispatchers.IO) { storage.read(service, request.key) }
                            ?: throw SensitiveInfoException.NotFound(request.key, service)

            val metadata = entry.metadata.toStorageMetadata() ?: fallbackMetadata(entry)

            val value = if (includeValue) {
                decryptValue(entry, metadata, request.authenticationPrompt)
            } else {
                null
            }

            SensitiveInfoItem(
                key = request.key,
                service = service,
                value = value,
                metadata = metadata
            )
        }
    }

    /**
     * Deletes a saved secret. If the underlying keystore alias becomes unused we dispose it as well.
     */
    override fun deleteItem(request: SensitiveInfoDeleteRequest): Promise<Boolean> {
        return Promise.async {
            val service = serviceResolver.resolve(request.service)
            val existing = withContext(Dispatchers.IO) { storage.read(service, request.key) }
            val removed = withContext(Dispatchers.IO) { storage.delete(service, request.key) }
            if (removed && existing != null) {
                maybeDeleteAlias(service, existing.alias)
            }
            removed
        }
    }

    /**
     * Lightweight existence check backed by the SharedPreferences metadata store.
     */
    override fun hasItem(request: SensitiveInfoHasRequest): Promise<Boolean> {
        return Promise.async {
            val service = serviceResolver.resolve(request.service)
            withContext(Dispatchers.IO) {
                storage.contains(service, request.key)
            }
        }
    }

    /**
     * Enumerates every entry in a service. When `includeValues` is false the secrets stay encrypted.
     */
    override fun getAllItems(request: SensitiveInfoEnumerateRequest?): Promise<Array<SensitiveInfoItem>> {
        return Promise.async {
            val includeValues = request?.includeValues == true
            val service = serviceResolver.resolve(request?.service)
            val items = withContext(Dispatchers.IO) { storage.readAll(service) }

            val result = items.mapNotNull { (key, entry) ->
                val metadata = entry.metadata.toStorageMetadata() ?: fallbackMetadata(entry)
                val value = if (includeValues) {
                    decryptValue(entry, metadata, request?.authenticationPrompt)
                } else {
                    null
                }

                SensitiveInfoItem(
                    key = key,
                    service = service,
                    value = value,
                    metadata = metadata
                )
            }

            result.toTypedArray()
        }
    }

    /**
     * Clears an entire service namespace and purges any orphaned keystore aliases.
     */
    override fun clearService(request: SensitiveInfoOptions?): Promise<Unit> {
        return Promise.async {
            val service = serviceResolver.resolve(request?.service)
            val existing = withContext(Dispatchers.IO) { storage.readAll(service) }
            withContext(Dispatchers.IO) {
                storage.clear(service)
            }
            existing.map { it.second.alias }
                .distinct()
                .forEach { alias -> cryptoManager.deleteKey(alias) }
        }
    }

    override fun getSupportedSecurityLevels(): Promise<SecurityAvailability> {
        val availability = availabilityResolver.resolve()
        val snapshot = SecurityAvailability(
            secureEnclave = availability.secureEnclave,
            strongBox = availability.strongBox,
            biometry = availability.biometry,
            deviceCredential = availability.deviceCredential
        )
        return Promise.resolved(snapshot)
    }

    private suspend fun decryptValue(
        entry: PersistedEntry,
        metadata: StorageMetadata,
        prompt: AuthenticationPrompt?
    ): String? {
        val ciphertext = entry.ciphertext ?: return null
        val iv = entry.iv ?: return null

        val resolution = cryptoManager.buildResolutionForPersisted(
            accessControl = metadata.accessControl,
            securityLevel = metadata.securityLevel,
            authenticators = entry.authenticators,
            requiresAuth = entry.requiresAuthentication,
            invalidateOnEnrollment = entry.invalidateOnEnrollment,
            useStrongBox = entry.useStrongBox
        )

        val decrypted = cryptoManager.decrypt(
            alias = entry.alias,
            ciphertext = ciphertext,
            iv = iv,
            resolution = resolution,
            prompt = prompt
        )
        return String(decrypted, Charsets.UTF_8)
    }

    private fun fallbackMetadata(entry: PersistedEntry): StorageMetadata {
        val accessControl = accessControlFromPersisted(entry.metadata.accessControl) ?: AccessControl.NONE
        val backend = storageBackendFromPersisted(entry.metadata.backend) ?: StorageBackend.ANDROIDKEYSTORE
        val level = when {
            entry.useStrongBox -> SecurityLevel.STRONGBOX
            entry.requiresAuthentication -> when (accessControl) {
                AccessControl.DEVICEPASSCODE -> SecurityLevel.DEVICECREDENTIAL
                AccessControl.NONE -> SecurityLevel.SOFTWARE
                else -> SecurityLevel.BIOMETRY
            }
            else -> SecurityLevel.SOFTWARE
        }

        return StorageMetadata(
            securityLevel = level,
            backend = backend,
            accessControl = accessControl,
            timestamp = entry.metadata.timestamp.takeIf { it > 0 } ?: nowSeconds()
        )
    }

    private fun nowSeconds(): Double = System.currentTimeMillis() / 1000.0

    private suspend fun maybeDeleteAlias(service: String, alias: String) {
        val remaining = withContext(Dispatchers.IO) { storage.readAll(service) }
        val stillReferenced = remaining.any { (_, entry) -> entry.alias == alias }
        if (!stillReferenced) {
            cryptoManager.deleteKey(alias)
        }
    }
}
