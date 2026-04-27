package com.sensitiveinfo

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

import android.content.Context
import com.margelo.nitro.core.Promise
import com.margelo.nitro.sensitiveinfo.*
import com.sensitiveinfo.internal.auth.BiometricAuthenticator
import com.sensitiveinfo.internal.crypto.AccessControlResolver
import com.sensitiveinfo.internal.crypto.AccessResolution
import com.sensitiveinfo.internal.crypto.CryptoManager
import com.sensitiveinfo.internal.crypto.SecurityAvailabilityResolver
import com.sensitiveinfo.internal.storage.KeyVersionRegistry
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
 * Each persisted entry is bound to a per-service, per-key Keystore alias that embeds the active
 * master-key version. Rotation bumps the service-wide version counter and lazily re-encrypts
 * entries on next read (eagerly when requested), keeping the JS contract opaque to the underlying
 * key lifecycle.
 */
@DoNotStrip
@Keep
class HybridSensitiveInfo : HybridSensitiveInfoSpec() {
  private data class Dependencies(
    val context: Context,
    val storage: SecureStorage,
    val cryptoManager: CryptoManager,
    val accessControlResolver: AccessControlResolver,
    val securityAvailabilityResolver: SecurityAvailabilityResolver,
    val serviceNameResolver: ServiceNameResolver,
    val keyVersionRegistry: KeyVersionRegistry
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
          serviceNameResolver = serviceNameResolver,
          keyVersionRegistry = KeyVersionRegistry(ctx)
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
      val version = deps.keyVersionRegistry.get(service)
      val alias = AliasGenerator.aliasFor(service, request.key, version)

      val plaintext = request.value.toByteArray(Charsets.UTF_8)
      val encryption = deps.cryptoManager.encrypt(alias, plaintext, resolved, request.authenticationPrompt)

      val metadata = buildMetadata(resolved.securityLevel, resolved.accessControl, version)
      val entry = buildEntry(alias, encryption.ciphertext, encryption.iv, metadata, resolved, version)

      deps.storage.save(service, request.key, entry)

      MutationResult(metadata = metadata)
    }
  }

  override fun getItem(request: SensitiveInfoGetRequest): Promise<Variant_NullType_SensitiveInfoItem> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()
      val service = deps.serviceNameResolver.resolve(request.service)

      val entry = deps.storage.read(service, request.key)
        ?: return@async emptyItem(request.key, service)

      val includeValue = request.includeValue == true
      val decrypted = if (includeValue) decryptEntry(deps, entry, request.authenticationPrompt) else null
      val upgraded = if (includeValue && decrypted != null) {
        maybeReEncrypt(deps, service, request.key, entry, decrypted, request.authenticationPrompt)
      } else {
        entry
      }

      Variant_NullType_SensitiveInfoItem.create(
        SensitiveInfoItem(
          key = request.key,
          service = service,
          value = decrypted,
          metadata = upgraded.metadata.toStorageMetadata()
            ?: fallbackMetadata(upgraded.keyVersion)
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
      val includeValues = request?.includeValues == true

      entries.mapNotNull { (key, entry) ->
        try {
          val value = if (includeValues) {
            runCatching { decryptEntry(deps, entry, request?.authenticationPrompt) }.getOrNull()
          } else {
            null
          }
          val finalEntry = if (includeValues && value != null) {
            maybeReEncrypt(deps, service, key, entry, value, request?.authenticationPrompt)
          } else {
            entry
          }
          SensitiveInfoItem(
            key = key,
            service = service,
            value = value,
            metadata = finalEntry.metadata.toStorageMetadata() ?: fallbackMetadata(finalEntry.keyVersion)
          )
        } catch (_: Throwable) {
          null
        }
      }.toTypedArray()
    }
  }

  override fun clearService(request: SensitiveInfoOptions?): Promise<Unit> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()
      val service = deps.serviceNameResolver.resolve(request?.service)
      for ((_, entry) in deps.storage.readAll(service)) {
        deps.cryptoManager.deleteKey(entry.alias)
      }
      deps.storage.clear(service)
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

  override fun rotateKeys(request: RotateKeysRequest?): Promise<RotationResult> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()
      val service = deps.serviceNameResolver.resolve(request?.service)
      val previous = deps.keyVersionRegistry.get(service)
      val next = deps.keyVersionRegistry.bump(service)

      val reEncrypted = if (request?.reEncryptEagerly == true) {
        reEncryptAll(deps, service, next, request.authenticationPrompt)
      } else {
        0
      }

      RotationResult(
        previousVersion = previous.toDouble(),
        newVersion = next.toDouble(),
        reEncryptedCount = reEncrypted.toDouble()
      )
    }
  }

  override fun getKeyVersion(request: SensitiveInfoOptions?): Promise<Double> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()
      val service = deps.serviceNameResolver.resolve(request?.service)
      deps.keyVersionRegistry.get(service).toDouble()
    }
  }

  private fun ensureInitialized(): Dependencies {
    dependencies?.let { return it }
    return initialize(ReactContextHolder.getReactApplicationContext())
  }

  // ---- helpers ------------------------------------------------------------

  private fun buildMetadata(
    securityLevel: SecurityLevel,
    accessControl: AccessControl,
    keyVersion: Int
  ): StorageMetadata = StorageMetadata(
    securityLevel = securityLevel,
    backend = StorageBackend.ANDROIDKEYSTORE,
    accessControl = accessControl,
    timestamp = System.currentTimeMillis() / 1000.0,
    keyVersion = keyVersion.toDouble(),
    integrityTag = null
  )

  private fun fallbackMetadata(keyVersion: Int = KeyVersionRegistry.INITIAL_VERSION): StorageMetadata =
    buildMetadata(SecurityLevel.SOFTWARE, AccessControl.NONE, keyVersion)

  private fun buildEntry(
    alias: String,
    ciphertext: ByteArray,
    iv: ByteArray,
    metadata: StorageMetadata,
    resolved: AccessResolution,
    keyVersion: Int
  ): PersistedEntry = PersistedEntry(
    alias = alias,
    ciphertext = ciphertext,
    iv = iv,
    metadata = PersistedMetadata.from(metadata),
    authenticators = resolved.allowedAuthenticators,
    requiresAuthentication = resolved.requiresAuthentication,
    invalidateOnEnrollment = resolved.invalidateOnEnrollment,
    useStrongBox = resolved.useStrongBox,
    keyVersion = keyVersion
  )

  private fun emptyItem(key: String, service: String): Variant_NullType_SensitiveInfoItem {
    return try {
      val ctor = com.margelo.nitro.core.NullType::class.java.getDeclaredConstructor()
      ctor.isAccessible = true
      Variant_NullType_SensitiveInfoItem.create(ctor.newInstance())
    } catch (_: Throwable) {
      Variant_NullType_SensitiveInfoItem.create(
        SensitiveInfoItem(
          key = key,
          service = service,
          value = null,
          metadata = fallbackMetadata()
        )
      )
    }
  }

  private suspend fun decryptEntry(
    deps: Dependencies,
    entry: PersistedEntry,
    prompt: AuthenticationPrompt?
  ): String? {
    if (entry.ciphertext == null || entry.iv == null) return null
    val metadata = entry.metadata.toStorageMetadata()
    val resolution = deps.cryptoManager.buildResolutionForPersisted(
      accessControl = metadata?.accessControl ?: AccessControl.NONE,
      securityLevel = metadata?.securityLevel ?: SecurityLevel.SOFTWARE,
      authenticators = entry.authenticators,
      requiresAuth = entry.requiresAuthentication,
      invalidateOnEnrollment = entry.invalidateOnEnrollment,
      useStrongBox = entry.useStrongBox
    )
    val plaintext = deps.cryptoManager.decrypt(entry.alias, entry.ciphertext, entry.iv, resolution, prompt)
    return String(plaintext, Charsets.UTF_8)
  }

  private suspend fun maybeReEncrypt(
    deps: Dependencies,
    service: String,
    key: String,
    entry: PersistedEntry,
    plaintext: String,
    prompt: AuthenticationPrompt?
  ): PersistedEntry {
    val activeVersion = deps.keyVersionRegistry.get(service)
    if (entry.keyVersion >= activeVersion) return entry

    return runCatching {
      reEncryptEntry(deps, service, key, entry, plaintext, activeVersion, prompt)
    }.getOrDefault(entry)
  }

  private suspend fun reEncryptEntry(
    deps: Dependencies,
    service: String,
    key: String,
    entry: PersistedEntry,
    plaintext: String,
    targetVersion: Int,
    prompt: AuthenticationPrompt?
  ): PersistedEntry {
    val newAlias = AliasGenerator.aliasFor(service, key, targetVersion)
    val persistedMetadata = entry.metadata.toStorageMetadata()
    val resolved = deps.cryptoManager.buildResolutionForPersisted(
      accessControl = persistedMetadata?.accessControl ?: AccessControl.NONE,
      securityLevel = persistedMetadata?.securityLevel ?: SecurityLevel.SOFTWARE,
      authenticators = entry.authenticators,
      requiresAuth = entry.requiresAuthentication,
      invalidateOnEnrollment = entry.invalidateOnEnrollment,
      useStrongBox = entry.useStrongBox
    )
    val encryption = deps.cryptoManager.encrypt(newAlias, plaintext.toByteArray(Charsets.UTF_8), resolved, prompt)
    val metadata = buildMetadata(resolved.securityLevel, resolved.accessControl, targetVersion)
    val upgraded = buildEntry(newAlias, encryption.ciphertext, encryption.iv, metadata, resolved, targetVersion)
    deps.storage.save(service, key, upgraded)
    if (newAlias != entry.alias) {
      deps.cryptoManager.deleteKey(entry.alias)
    }
    return upgraded
  }

  private suspend fun reEncryptAll(
    deps: Dependencies,
    service: String,
    targetVersion: Int,
    prompt: AuthenticationPrompt?
  ): Int {
    var count = 0
    for ((key, entry) in deps.storage.readAll(service)) {
      if (entry.keyVersion >= targetVersion) continue
      val plaintext = runCatching { decryptEntry(deps, entry, prompt) }.getOrNull() ?: continue
      runCatching {
        reEncryptEntry(deps, service, key, entry, plaintext, targetVersion, prompt)
        count += 1
      }
    }
    return count
  }
}
