package com.sensitiveinfo

import android.content.Context
import com.margelo.nitro.core.Promise
import com.margelo.nitro.sensitiveinfo.*
import com.sensitiveinfo.internal.auth.BiometricAuthenticator
import com.sensitiveinfo.internal.crypto.AccessControlResolver
import com.sensitiveinfo.internal.crypto.CryptoManager
import com.sensitiveinfo.internal.crypto.SecurityAvailabilityResolver
import com.sensitiveinfo.internal.response.ResponseBuilder
import com.sensitiveinfo.internal.response.StandardResponseBuilder
import com.sensitiveinfo.internal.storage.PersistedEntry
import com.sensitiveinfo.internal.storage.PersistedMetadata
import com.sensitiveinfo.internal.storage.SecureStorage
import com.sensitiveinfo.internal.util.AliasGenerator
import com.sensitiveinfo.internal.util.ReactContextHolder
import com.sensitiveinfo.internal.util.ServiceNameResolver
import com.sensitiveinfo.internal.util.accessControlFromPersisted
import com.sensitiveinfo.internal.util.securityLevelFromPersisted
import com.sensitiveinfo.internal.validation.AndroidStorageValidator
import com.sensitiveinfo.internal.validation.StorageValidator
import com.sensitiveinfo.AndroidKeyRotationManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlin.jvm.Volatile

/**
 * Android Keystore implementation of the SensitiveInfo Nitro module.
 *
 * Provides secure storage for sensitive data on Android using the Android Keystore
 * for key management and SharedPreferences for encrypted data persistence.
 *
 * The implementation follows a consistent pattern across all methods:
 * 1. Validate inputs using [StorageValidator]
 * 2. Resolve access control and security parameters
 * 3. Perform cryptographic or storage operations
 * 4. Build responses using [ResponseBuilder] for type conversion
 *
 * @since 6.0.0
 */
class HybridSensitiveInfo : HybridSensitiveInfoSpec() {
  private data class Dependencies(
    val context: Context,
    val storage: SecureStorage,
    val cryptoManager: CryptoManager,
    val accessControlResolver: AccessControlResolver,
    val securityAvailabilityResolver: SecurityAvailabilityResolver,
    val serviceNameResolver: ServiceNameResolver,
    val validator: StorageValidator,
    val responseBuilder: ResponseBuilder,
    val keyRotationManager: AndroidKeyRotationManager
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
          validator = AndroidStorageValidator(),
          responseBuilder = StandardResponseBuilder(),
          keyRotationManager = AndroidKeyRotationManager(ctx)
        ).also { built ->
          dependencies = built
        }
      }
    }
  }

  /**
   * Sets an item in secure storage.
   *
   * Process:
   * 1. Validates the key, value, and options
   * 2. Resolves service name and access control
   * 3. Generates Keystore alias from service and key
   * 4. Encrypts plaintext using CryptoManager
   * 5. Creates metadata for tracking security properties
   * 6. Persists encrypted entry and metadata
   * 7. Returns mutation result with metadata
   *
   * @param request The set request containing key, value, and options
   * @return Promise resolving to MutationResult with metadata
   * @throws IllegalArgumentException if key or value is invalid
   * @throws java.security.KeyStoreException if Keystore operation fails
   */
  override fun setItem(request: SensitiveInfoSetRequest): Promise<MutationResult> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()

      // Step 1: Validate inputs
      deps.validator.validateKey(request.key)
      deps.validator.validateValue(request.value)

      // Step 2: Resolve service name
      val service = deps.serviceNameResolver.resolve(request.service)

      // Step 3: Resolve access control
      val resolved = deps.accessControlResolver.resolve(request.accessControl)

      // Step 4: Generate alias for Keystore entry
      val alias = AliasGenerator.aliasFor(service, request.key)

      // Step 5: Encrypt plaintext
      val plaintext = request.value.toByteArray(Charsets.UTF_8)
      val encryption = deps.cryptoManager.encrypt(alias, plaintext, resolved, request.authenticationPrompt)

      // Step 6: Create metadata
      val metadata = StorageMetadata(
        securityLevel = resolved.securityLevel,
        backend = StorageBackend.ANDROIDKEYSTORE,
        accessControl = resolved.accessControl,
        timestamp = System.currentTimeMillis() / 1000.0,
        alias = alias
      )

      // Step 7: Persist entry
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

      // Step 8: Build response using response builder
      deps.responseBuilder.buildMutationResult(metadata)
    }
  }

  /**
   * Retrieves an item from secure storage.
   *
   * Process:
   * 1. Resolves service name
   * 2. Reads encrypted entry and metadata from storage
   * 3. If include_value is true, decrypts the ciphertext
   * 4. Rebuilds access control from persisted metadata
   * 5. Reconstructs item from decrypted value and metadata
   * 6. Builds response using response builder
   *
   * @param request The get request with key and authentication prompt
   * @return Promise resolving to SensitiveInfoItem or null if not found
   * @throws IllegalArgumentException if key is invalid
   * @throws java.security.KeyStoreException if decryption fails
   */
  override fun getItem(request: SensitiveInfoGetRequest): Promise<SensitiveInfoItem?> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()

      // Step 1: Validate key
      deps.validator.validateKey(request.key)

      // Step 2: Resolve service name
      val service = deps.serviceNameResolver.resolve(request.service)

      // Step 3: Read entry from storage
      val entry = deps.storage.read(service, request.key)
      if (entry == null) {
        return@async null
      }

      // Step 4: Decode metadata
      val metadata = entry.metadata.toStorageMetadata()

      // Step 5: Decrypt value if requested
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

      // Step 6: Build response using response builder
      deps.responseBuilder.buildItem(
        key = request.key,
        value = value,
        metadata = metadata ?: StorageMetadata(
          securityLevel = SecurityLevel.SOFTWARE,
          backend = StorageBackend.ANDROIDKEYSTORE,
          accessControl = AccessControl.NONE,
          timestamp = System.currentTimeMillis() / 1000.0,
          alias = entry.alias
        ),
        service = service
      )
    }
  }

  /**
   * Deletes an item from secure storage.
   *
   * Process:
   * 1. Validates the key
   * 2. Resolves service name
   * 3. Reads the stored entry to get Keystore alias
   * 4. Deletes the Keystore key using the alias
   * 5. Deletes the encrypted data from storage
   * 6. Returns success boolean
   *
   * @param request The delete request containing key
   * @return Promise resolving to boolean (success)
   * @throws IllegalArgumentException if key is invalid
   * @throws java.security.KeyStoreException if key deletion fails
   */
  override fun deleteItem(request: SensitiveInfoDeleteRequest): Promise<Boolean> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()

      // Step 1: Validate key
      deps.validator.validateKey(request.key)

      // Step 2: Resolve service name
      val service = deps.serviceNameResolver.resolve(request.service)

      // Step 3: Read entry to get alias
      val entry = deps.storage.read(service, request.key)
      if (entry != null) {
        // Step 4: Delete Keystore key
        deps.cryptoManager.deleteKey(entry.alias)
      }

      // Step 5: Delete storage entry
      deps.storage.delete(service, request.key)

      // Step 6: Return success
      true
    }
  }

  /**
   * Checks if an item exists in secure storage.
   *
   * Process:
   * 1. Validates the key
   * 2. Resolves service name
   * 3. Checks if entry exists in storage
   * 4. Returns boolean existence
   *
   * @param request The has request containing key
   * @return Promise resolving to boolean (exists)
   * @throws IllegalArgumentException if key is invalid
   */
  override fun hasItem(request: SensitiveInfoHasRequest): Promise<Boolean> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()

      // Step 1: Validate key
      deps.validator.validateKey(request.key)

      // Step 2: Resolve service name
      val service = deps.serviceNameResolver.resolve(request.service)

      // Step 3: Check storage
      deps.storage.contains(service, request.key)
    }
  }

  /**
   * Retrieves all items for a service.
   *
   * Process:
   * 1. Resolves service name
   * 2. Reads all entries from storage for the service
   * 3. For each entry, decrypts if include_values is true
   * 4. Handles decryption failures gracefully (skips value if fails)
   * 5. Builds item using response builder
   * 6. Filters out items that fail to process
   * 7. Returns array of items
   *
   * @param request The enumerate request with optional include_values flag
   * @return Promise resolving to array of SensitiveInfoItem
   * @throws IllegalArgumentException if service is invalid
   */
  override fun getAllItems(request: SensitiveInfoEnumerateRequest?): Promise<Array<SensitiveInfoItem>> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()

      // Step 1: Resolve service name
      val service = deps.serviceNameResolver.resolve(request?.service)

      // Step 2: Read all entries
      val entries = deps.storage.readAll(service)
      val includeValues = request?.includeValues ?: false

      // Step 3: Map entries to items
      entries.mapNotNull { (key, entry) ->
        try {
          val metadata = entry.metadata.toStorageMetadata() ?: StorageMetadata(
            securityLevel = SecurityLevel.SOFTWARE,
            backend = StorageBackend.ANDROIDKEYSTORE,
            accessControl = AccessControl.NONE,
            timestamp = System.currentTimeMillis() / 1000.0,
            alias = entry.alias
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
              // Gracefully handle decryption failures
              null
            }
          } else {
            null
          }

          // Step 5: Build item using response builder
          deps.responseBuilder.buildItem(
            key = key,
            value = value,
            metadata = metadata,
            service = service
          )
        } catch (e: Throwable) {
          // Step 6: Skip items that fail to process
          null
        }
      }.toTypedArray()
    }
  }

  /**
   * Clears all items for a service.
   *
   * Process:
   * 1. Validates options
   * 2. Resolves service name
   * 3. Reads all entries to get all Keystore aliases
   * 4. Deletes all Keystore keys
   * 5. Clears all SharedPreferences entries for the service
   * 6. Returns success
   *
   * @param request Optional SensitiveInfoOptions containing service name
   * @return Promise resolving to Unit (void)
   * @throws IllegalArgumentException if service is invalid
   * @throws java.security.KeyStoreException if any key deletion fails
   */
  override fun clearService(request: SensitiveInfoOptions?): Promise<Unit> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()

      // Step 1: Validate options
      deps.validator.validateOptions(request)

      // Step 2: Resolve service name
      val service = deps.serviceNameResolver.resolve(request?.service)

      // Step 3: Read all entries for this service
      val entries = deps.storage.readAll(service)

      // Step 4: Delete all Keystore keys
      for ((_, entry) in entries) {
        deps.cryptoManager.deleteKey(entry.alias)
      }

      // Step 5: Clear SharedPreferences
      deps.storage.clear(service)

      Unit
    }
  }

  /**
   * Gets supported security levels for the platform.
   *
   * Process:
   * 1. Queries security availability resolver for capabilities
   * 2. Converts capabilities to SecurityAvailability object
   * 3. Returns structured response
   *
   * @return Promise resolving to SecurityAvailability with platform capabilities
   */
  override fun getSupportedSecurityLevels(): Promise<SecurityAvailability> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()

      // Step 1: Query capabilities
      val capabilities = deps.securityAvailabilityResolver.resolve()

      // Step 2: Build and return response
      SecurityAvailability(
        secureEnclave = capabilities.secureEnclave,
        strongBox = capabilities.strongBox,
        biometry = capabilities.biometry,
        deviceCredential = capabilities.deviceCredential
      )
    }
  }

  /**
   * Re-encrypts all items with the current key.
   * Migrates items encrypted with old keys to the current key version.
   */
  override fun reEncryptAllItems(request: ReEncryptAllItemsRequest): Promise<ReEncryptAllItemsResponse> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()

      // Step 1: Resolve service
      val service = deps.serviceNameResolver.resolve(request.service ?: "")

      // Step 2: Get current key version
      var currentKeyVersion = deps.keyRotationManager.getCurrentKeyVersion()
      if (currentKeyVersion == null) {
        // Generate a new key if none exists
        val newKeyId = System.currentTimeMillis().toString()
        val success = deps.keyRotationManager.generateNewKey(newKeyId, requiresBiometry = false)
        if (success) {
          deps.keyRotationManager.rotateToNewKey(newKeyId)
          currentKeyVersion = newKeyId
        } else {
          throw IllegalStateException("Failed to generate initial key for re-encryption")
        }
      }

      // Step 3: Get all entries for the service
      val entries = deps.storage.readAll(service)

      var reEncryptedCount = 0
      val errors = mutableListOf<ReEncryptError>()

      // Step 4: Re-encrypt items that use old keys
      for ((key, entry) in entries) {
        try {
          if (entry.alias != currentKeyVersion && entry.ciphertext != null && entry.iv != null) {
            // Get access control from persisted
            val accessControl = accessControlFromPersisted(entry.metadata.accessControl) ?: AccessControl.NONE
            val securityLevel = securityLevelFromPersisted(entry.metadata.securityLevel) ?: SecurityLevel.SOFTWARE

            // Decrypt with old key
            val resolution = deps.cryptoManager.buildResolutionForPersisted(
              accessControl = accessControl,
              securityLevel = securityLevel,
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
              null // No auth prompt for background operation
            )

            // Encrypt with new key
            val newResolution = deps.cryptoManager.buildResolutionForPersisted(
              accessControl = accessControl,
              securityLevel = securityLevel,
              authenticators = entry.authenticators,
              requiresAuth = entry.requiresAuthentication,
              invalidateOnEnrollment = entry.invalidateOnEnrollment,
              useStrongBox = entry.useStrongBox
            )

            val encryption = deps.cryptoManager.encrypt(
              currentKeyVersion,
              plaintext,
              newResolution,
              null
            )

            // Update storage
            val updatedEntry = entry.copy(
              ciphertext = encryption.ciphertext,
              iv = encryption.iv,
              alias = currentKeyVersion
            )
            deps.storage.save(service, key, updatedEntry)

            reEncryptedCount++
          }
        } catch (e: Exception) {
          errors.add(ReEncryptError(key = key, error = e.message ?: "Unknown error"))
        }
      }

      // Step 5: Return results
      ReEncryptAllItemsResponse(
        itemsReEncrypted = reEncryptedCount.toDouble(),
        errors = errors.toTypedArray()
      )
    }
  }

  private fun ensureInitialized(): Dependencies {
    dependencies?.let { return it }

    val reactContext = ReactContextHolder.getReactApplicationContext()
    return initialize(reactContext)
  }
}
