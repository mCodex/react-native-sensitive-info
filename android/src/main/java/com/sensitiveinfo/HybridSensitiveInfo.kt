package com.sensitiveinfo

import android.content.Context
import com.margelo.nitro.core.Promise
import com.margelo.nitro.sensitiveinfo.*
import com.sensitiveinfo.internal.auth.BiometricAuthenticator
import com.sensitiveinfo.internal.crypto.AccessControlResolver
import com.sensitiveinfo.internal.crypto.CryptoManager
import com.sensitiveinfo.internal.crypto.SecurityAvailabilityResolver
import com.sensitiveinfo.internal.storage.PersistedEntry
import com.sensitiveinfo.internal.storage.PersistedMetadata
import com.sensitiveinfo.internal.storage.SecureStorage
import com.sensitiveinfo.internal.util.AliasGenerator
import com.sensitiveinfo.internal.util.ReactContextHolder
import com.sensitiveinfo.internal.util.ServiceNameResolver
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlin.jvm.Volatile

/**
 * Android Keystore implementation of the SensitiveInfo Nitro module.
 *
 * This class provides secure storage for sensitive data on Android using the Android Keystore
 * for key management and SharedPreferences for encrypted data persistence.
 */
class HybridSensitiveInfo : HybridSensitiveInfoSpec() {
  private data class Dependencies(
    val context: Context,
    val storage: SecureStorage,
    val cryptoManager: CryptoManager,
    val accessControlResolver: AccessControlResolver,
    val securityAvailabilityResolver: SecurityAvailabilityResolver,
    val serviceNameResolver: ServiceNameResolver
  )

  @Volatile
  private var dependencies: Dependencies? = null
  private val initializationLock = Any()
  private val coroutineScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

  private fun initialize(ctx: Context): Dependencies {
    dependencies?.let { return it }

    return synchronized(initializationLock) {
      dependencies ?: run {
        val securityAvailabilityResolver = SecurityAvailabilityResolver(ctx)
        val accessControlResolver = AccessControlResolver(securityAvailabilityResolver)
        val serviceNameResolver = ServiceNameResolver(ctx)
        val authenticator = BiometricAuthenticator()
        val cryptoManager = CryptoManager(authenticator)

        Dependencies(
          context = ctx,
          storage = SecureStorage(ctx),
          cryptoManager = cryptoManager,
          accessControlResolver = accessControlResolver,
          securityAvailabilityResolver = securityAvailabilityResolver,
          serviceNameResolver = serviceNameResolver
        ).also { built ->
          dependencies = built
        }
      }
    }
  }

  override fun setItem(request: SensitiveInfoSetRequest): Promise<MutationResult> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()
      val service = deps.serviceNameResolver.resolve(request.service)
      val resolved = deps.accessControlResolver.resolve(request.accessControl)
      val alias = AliasGenerator.aliasFor(service, request.key)

      val plaintext = request.value.toByteArray(Charsets.UTF_8)
      val encryption = deps.cryptoManager.encrypt(alias, plaintext, resolved, request.authenticationPrompt)

      val metadata = StorageMetadata(
        securityLevel = resolved.securityLevel,
        backend = StorageBackend.ANDROIDKEYSTORE,
        accessControl = resolved.accessControl,
        timestamp = System.currentTimeMillis() / 1000.0
      )

      val entry = PersistedEntry(
        alias = alias,
        ciphertext = encryption.ciphertext,
        iv = encryption.iv,
        metadata = PersistedMetadata.from(metadata),
        authenticators = resolved.allowedAuthenticators,
        requiresAuthentication = resolved.requiresAuthentication,
        invalidateOnEnrollment = resolved.invalidateOnEnrollment,
        useStrongBox = resolved.useStrongBox
      )

      deps.storage.save(service, request.key, entry)

      MutationResult(metadata = metadata)
    }
  }

  override fun getItem(request: SensitiveInfoGetRequest): Promise<SensitiveInfoItem?> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()
      val service = deps.serviceNameResolver.resolve(request.service)

      val entry = deps.storage.read(service, request.key)
      if (entry == null) {
        return@async null
      }

      val metadata = entry.metadata.toStorageMetadata()
      val value = if (request.includeValue == true && entry.ciphertext != null && entry.iv != null) {
        val resolution = deps.cryptoManager.buildResolutionForPersisted(
          accessControl = metadata?.accessControl ?: AccessControl.NONE,
          securityLevel = metadata?.securityLevel ?: SecurityLevel.SOFTWARE,
          authenticators = entry.authenticators,
          requiresAuth = entry.requiresAuthentication,
          invalidateOnEnrollment = entry.invalidateOnEnrollment,
          useStrongBox = entry.useStrongBox
        )

        val plaintext = deps.cryptoManager.decrypt(
          entry.alias,
          entry.ciphertext,
          entry.iv,
          resolution,
          request.authenticationPrompt
        )
        String(plaintext, Charsets.UTF_8)
      } else {
        null
      }

      SensitiveInfoItem(
        key = request.key,
        service = service,
        value = value,
        metadata = metadata ?: StorageMetadata(
          securityLevel = SecurityLevel.SOFTWARE,
          backend = StorageBackend.ANDROIDKEYSTORE,
          accessControl = AccessControl.NONE,
          timestamp = System.currentTimeMillis() / 1000.0
        )
      )
    }
  }

  override fun deleteItem(request: SensitiveInfoDeleteRequest): Promise<Boolean> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()
      val service = deps.serviceNameResolver.resolve(request.service)

      val entry = deps.storage.read(service, request.key)
      if (entry != null) {
        deps.cryptoManager.deleteKey(entry.alias)
      }

      deps.storage.delete(service, request.key)
    }
  }

  override fun hasItem(request: SensitiveInfoHasRequest): Promise<Boolean> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()
      val service = deps.serviceNameResolver.resolve(request.service)
      deps.storage.contains(service, request.key)
    }
  }

  override fun getAllItems(request: SensitiveInfoEnumerateRequest?): Promise<Array<SensitiveInfoItem>> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()
      val service = deps.serviceNameResolver.resolve(request?.service)

      val entries = deps.storage.readAll(service)
      val includeValues = request?.includeValues ?: false

      entries.mapNotNull { (key, entry) ->
        try {
          val metadata = entry.metadata.toStorageMetadata() ?: StorageMetadata(
            securityLevel = SecurityLevel.SOFTWARE,
            backend = StorageBackend.ANDROIDKEYSTORE,
            accessControl = AccessControl.NONE,
            timestamp = System.currentTimeMillis() / 1000.0
          )

          val value = if (includeValues && entry.ciphertext != null && entry.iv != null) {
            val resolution = deps.cryptoManager.buildResolutionForPersisted(
              accessControl = metadata.accessControl,
              securityLevel = metadata.securityLevel,
              authenticators = entry.authenticators,
              requiresAuth = entry.requiresAuthentication,
              invalidateOnEnrollment = entry.invalidateOnEnrollment,
              useStrongBox = entry.useStrongBox
            )

            try {
              val plaintext = deps.cryptoManager.decrypt(
                entry.alias,
                entry.ciphertext,
                entry.iv,
                resolution,
                request?.authenticationPrompt
              )
              String(plaintext, Charsets.UTF_8)
            } catch (e: Throwable) {
              // If decryption fails, skip including the value
              null
            }
          } else {
            null
          }

          SensitiveInfoItem(
            key = key,
            service = service,
            value = value,
            metadata = metadata
          )
        } catch (e: Throwable) {
          // Skip items that fail to process
          null
        }
      }.toTypedArray()
    }
  }

  override fun clearService(request: SensitiveInfoOptions?): Promise<Unit> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()
      val service = deps.serviceNameResolver.resolve(request?.service)

      // Get all entries for the service and delete their keys
      val entries = deps.storage.readAll(service)
      for ((_, entry) in entries) {
        deps.cryptoManager.deleteKey(entry.alias)
      }

      // Clear SharedPreferences
      deps.storage.clear(service)

      Unit
    }
  }

  override fun getSupportedSecurityLevels(): Promise<SecurityAvailability> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()
      val capabilities = deps.securityAvailabilityResolver.resolve()

      SecurityAvailability(
        secureEnclave = capabilities.secureEnclave,
        strongBox = capabilities.strongBox,
        biometry = capabilities.biometry,
        deviceCredential = capabilities.deviceCredential
      )
    }
  }

  private fun ensureInitialized(): Dependencies {
    dependencies?.let { return it }

    val reactContext = ReactContextHolder.getReactApplicationContext()
    return initialize(reactContext)
  }
}
