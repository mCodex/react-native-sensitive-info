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
import com.sensitiveinfo.internal.crypto.IntegrityInput
import com.sensitiveinfo.internal.crypto.MetadataIntegrity
import com.sensitiveinfo.internal.crypto.SecurityAvailabilityResolver
import com.sensitiveinfo.internal.storage.KeyVersionRegistry
import com.sensitiveinfo.internal.storage.PersistedEntry
import com.sensitiveinfo.internal.storage.PersistedMetadata
import com.sensitiveinfo.internal.storage.SecureStorage
import com.sensitiveinfo.internal.util.AliasGenerator
import com.sensitiveinfo.internal.util.ReactContextHolder
import com.sensitiveinfo.internal.util.SensitiveInfoException
import com.sensitiveinfo.internal.util.ServiceNameResolver
import com.sensitiveinfo.internal.util.persistedName
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
    val keyVersionRegistry: KeyVersionRegistry,
    val integrity: MetadataIntegrity
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
          keyVersionRegistry = KeyVersionRegistry(ctx),
          integrity = MetadataIntegrity()
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
      val aad = aadFor(service, request.key, version)
      val encryption = deps.cryptoManager.encrypt(
        alias, plaintext, resolved, request.authenticationPrompt, aad
      )

      val timestamp = System.currentTimeMillis() / 1000.0
      val tag = deps.integrity.sign(
        integrityInputFor(
          service, request.key, version,
          resolved.accessControl, resolved.securityLevel,
          timestamp, encryption.iv, encryption.ciphertext
        )
      )
      val metadata = buildMetadata(
        resolved.securityLevel, resolved.accessControl, version, timestamp, tag
      )
      val entry = buildEntry(
        alias, encryption.ciphertext, encryption.iv, metadata, resolved, version,
        usesAad = true, integrityTag = tag
      )

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
      val decrypted = if (includeValue) decryptEntry(deps, entry, request.authenticationPrompt, service, request.key) else null
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
            runCatching { decryptEntry(deps, entry, request?.authenticationPrompt, service, key) }.getOrNull()
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
        biometryStatus = capabilities.biometryStatus,
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
    keyVersion: Int,
    timestamp: Double = System.currentTimeMillis() / 1000.0,
    integrityTag: String? = null
  ): StorageMetadata = StorageMetadata(
    securityLevel = securityLevel,
    backend = StorageBackend.ANDROIDKEYSTORE,
    accessControl = accessControl,
    timestamp = timestamp,
    keyVersion = keyVersion.toDouble(),
    integrityTag = integrityTag
  )

  private fun fallbackMetadata(keyVersion: Int = KeyVersionRegistry.INITIAL_VERSION): StorageMetadata =
    buildMetadata(SecurityLevel.SOFTWARE, AccessControl.NONE, keyVersion)

  private fun aadFor(service: String, key: String, version: Int): ByteArray =
    "$service|$key|v$version".toByteArray(Charsets.UTF_8)

  /** Single source of truth for HMAC integrity inputs. */
  private fun integrityInputFor(
    service: String,
    key: String,
    version: Int,
    accessControl: AccessControl,
    securityLevel: SecurityLevel,
    timestamp: Double,
    iv: ByteArray,
    ciphertext: ByteArray
  ): IntegrityInput = IntegrityInput(
    service = service,
    key = key,
    keyVersion = version,
    accessControl = accessControl.persistedName(),
    securityLevel = securityLevel.persistedName(),
    timestamp = timestamp,
    iv = iv,
    ciphertext = ciphertext
  )

  private fun buildEntry(
    alias: String,
    ciphertext: ByteArray,
    iv: ByteArray,
    metadata: StorageMetadata,
    resolved: AccessResolution,
    keyVersion: Int,
    usesAad: Boolean = false,
    integrityTag: String? = null
  ): PersistedEntry = PersistedEntry(
    alias = alias,
    ciphertext = ciphertext,
    iv = iv,
    metadata = PersistedMetadata.from(metadata, integrityTag),
    authenticators = resolved.allowedAuthenticators,
    requiresAuthentication = resolved.requiresAuthentication,
    invalidateOnEnrollment = resolved.invalidateOnEnrollment,
    useStrongBox = resolved.useStrongBox,
    keyVersion = keyVersion,
    usesAad = usesAad,
    integrityTag = integrityTag
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
    prompt: AuthenticationPrompt?,
    service: String,
    key: String
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

    // Verify integrity *before* decrypting so a tampered envelope never reaches AES-GCM and never
    // triggers a biometric prompt. Legacy entries (integrityTag == null) are accepted and will be
    // upgraded on next write/rotation.
    if (entry.integrityTag != null && metadata != null) {
      val ok = deps.integrity.verify(
        integrityInputFor(
          service, key, entry.keyVersion,
          metadata.accessControl, metadata.securityLevel,
          metadata.timestamp, entry.iv, entry.ciphertext
        ),
        entry.integrityTag
      )
      if (!ok) {
        throw SensitiveInfoException.IntegrityViolation(key, service)
      }
    }

    val aad = if (entry.usesAad) aadFor(service, key, entry.keyVersion) else null
    val plaintext = deps.cryptoManager.decrypt(
      entry.alias, entry.ciphertext, entry.iv, resolution, prompt, aad
    )
    return try {
      String(plaintext, Charsets.UTF_8)
    } finally {
      plaintext.fill(0)
    }
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

    // Skip lazy re-encryption for biometry-protected entries. Re-encryption
    // creates a new Keystore key alias for `activeVersion` and `Cipher.init` on
    // a `setUserAuthenticationRequired(true)` key requires its own biometric
    // authorization — surfacing as a *second* Face/fingerprint prompt right
    // after the user already authenticated for the read.
    //
    // These items are still upgraded by:
    //   - the next explicit `setItem` (caller-initiated full overwrite), or
    //   - `rotateKeys({ reEncryptEagerly: true })` where the prompt is expected.
    if (requiresBiometricAuth(entry)) return entry

    return runCatching {
      reEncryptEntry(deps, service, key, entry, plaintext, activeVersion, prompt)
    }.getOrDefault(entry)
  }

  /**
   * True when the persisted entry's Keystore key requires user authentication
   * to authorize a `Cipher.init` — i.e. biometric- or device-credential-gated
   * entries. `entry.requiresAuthentication` already covers the common case
   * (including `devicePasscode`, which `AccessControlResolver` flags as
   * auth-required), so any such entry returns `true` and is skipped by the
   * lazy refresh to avoid a second prompt. The `accessControl` fallback only
   * matters for legacy entries persisted before the flag existed: there we
   * still classify the biometry-class policies as auth-gated, while
   * `devicePasscode`/`none` legacy entries are treated as silently
   * upgradable (their keys had no auth requirement back then).
   */
  private fun requiresBiometricAuth(entry: PersistedEntry): Boolean {
    if (entry.requiresAuthentication) return true
    val accessControl = entry.metadata.toStorageMetadata()?.accessControl
      ?: return false
    return when (accessControl) {
      AccessControl.SECUREENCLAVEBIOMETRY,
      AccessControl.BIOMETRYCURRENTSET,
      AccessControl.BIOMETRYANY -> true
      AccessControl.DEVICEPASSCODE,
      AccessControl.NONE -> false
    }
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
    val encryption = deps.cryptoManager.encrypt(
      newAlias, plaintext.toByteArray(Charsets.UTF_8), resolved, prompt,
      aadFor(service, key, targetVersion)
    )
    val timestamp = System.currentTimeMillis() / 1000.0
    val tag = deps.integrity.sign(
      integrityInputFor(
        service, key, targetVersion,
        resolved.accessControl, resolved.securityLevel,
        timestamp, encryption.iv, encryption.ciphertext
      )
    )
    val metadata = buildMetadata(
      resolved.securityLevel, resolved.accessControl, targetVersion, timestamp, tag
    )
    val upgraded = buildEntry(
      newAlias, encryption.ciphertext, encryption.iv, metadata, resolved, targetVersion,
      usesAad = true, integrityTag = tag
    )
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
      val plaintext = runCatching { decryptEntry(deps, entry, prompt, service, key) }.getOrNull() ?: continue
      runCatching {
        reEncryptEntry(deps, service, key, entry, plaintext, targetVersion, prompt)
        count += 1
      }
    }
    return count
  }
}
