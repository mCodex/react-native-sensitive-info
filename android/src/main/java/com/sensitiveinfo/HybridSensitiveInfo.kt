package com.sensitiveinfo

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.margelo.nitro.core.Promise
import com.margelo.nitro.sensitiveinfo.*
import com.sensitiveinfo.internal.auth.AndroidAuthenticationManager
import com.sensitiveinfo.internal.auth.AuthenticationManager
import com.sensitiveinfo.internal.auth.BiometricAuthenticator
import com.sensitiveinfo.internal.crypto.AccessControlManager
import com.sensitiveinfo.internal.crypto.AccessControlResolver
import com.sensitiveinfo.internal.crypto.AndroidAccessControlManager
import com.sensitiveinfo.internal.crypto.CryptoManager
import com.sensitiveinfo.internal.crypto.SecurityAvailabilityResolver
import com.sensitiveinfo.internal.metadata.AndroidMetadataManager
import com.sensitiveinfo.internal.metadata.MetadataManager
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
import kotlinx.coroutines.launch
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
final class HybridSensitiveInfo : HybridSensitiveInfoSpec() {
  
  private data class Dependencies(
    val context: Context,
    val storage: SecureStorage,
    val cryptoManager: CryptoManager,
    val metadataManager: MetadataManager,
    val authenticationManager: AuthenticationManager,
    val accessControlManager: AccessControlManager,
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
  private var rotationEventCallback: ((RotationEvent) -> Unit)? = null
  private val mainHandler = Handler(Looper.getMainLooper())
  private var rotationCheckRunnable: Runnable? = null

  // MARK: - Initialization

  private fun initialize(ctx: Context): Dependencies {
    dependencies?.let { return it }

    return synchronized(initializationLock) {
      dependencies ?: run {
        val securityAvailabilityResolver = SecurityAvailabilityResolver(ctx)
        val accessControlResolver = AccessControlResolver(securityAvailabilityResolver)
        val serviceNameResolver = ServiceNameResolver(ctx)
        val authenticator = BiometricAuthenticator()
        val cryptoManager = CryptoManager(authenticator)

        // Initialize specialized managers
        val metadataManager: MetadataManager = AndroidMetadataManager()
        val authenticationManager: AuthenticationManager = AndroidAuthenticationManager(authenticator)
        val accessControlManager: AccessControlManager = AndroidAccessControlManager(
          securityAvailabilityResolver
        )

        Dependencies(
          context = ctx,
          storage = SecureStorage(ctx),
          cryptoManager = cryptoManager,
          metadataManager = metadataManager,
          authenticationManager = authenticationManager,
          accessControlManager = accessControlManager,
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

      // Step 5: Get or generate current key version
      val currentKey = deps.keyRotationManager.getCurrentKeyVersion()
      val keyVersion = currentKey ?: run {
        val newKeyId = System.currentTimeMillis().toString()
        val success = deps.keyRotationManager.generateNewKey(newKeyId, requiresBiometry = false)
        if (success) {
          deps.keyRotationManager.rotateToNewKey(newKeyId)
          newKeyId
        } else {
          throw IllegalStateException("Failed to generate initial key")
        }
      }

      // Step 6: Encrypt plaintext
      val plaintext = request.value.toByteArray(Charsets.UTF_8)
      val encryption = deps.cryptoManager.encrypt(keyVersion, plaintext, resolved, request.authenticationPrompt)

      // Step 7: Create metadata
      val metadata = StorageMetadata(
        securityLevel = resolved.securityLevel,
        backend = StorageBackend.ANDROIDKEYSTORE,
        accessControl = resolved.accessControl,
        timestamp = System.currentTimeMillis() / 1000.0,
        alias = keyVersion
      )

      // Step 8: Persist entry
      val entry = PersistedEntry(
        alias = keyVersion,
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
      val metadata = try {
        entry.metadata.toStorageMetadata()
      } catch (e: Exception) {
        RuntimeError.log("Failed to decode metadata for key: $e")
        null
      }

      // Step 5: Decrypt value if requested
      val value = try {
        if (request.includeValue == true && entry.ciphertext != null && entry.iv != null) {
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
      } catch (e: Exception) {
        RuntimeError.log("Failed to decrypt value for key: $e")
        null
      }

      // Step 6: Build response using response builder with proper null handling
      val finalMetadata = metadata ?: StorageMetadata(
        securityLevel = SecurityLevel.SOFTWARE,
        backend = StorageBackend.ANDROIDKEYSTORE,
        accessControl = AccessControl.NONE,
        timestamp = System.currentTimeMillis() / 1000.0,
        alias = entry.alias
      )

      deps.responseBuilder.buildItem(
        key = request.key,
        value = value,
        metadata = finalMetadata,
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
   * Initializes key rotation system.
   */
  override fun initializeKeyRotation(request: InitializeKeyRotationRequest): Promise<Unit> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()

      // Store rotation settings in SharedPreferences
      val preferences = deps.context.getSharedPreferences(
        "com.sensitiveinfo.keyrotation",
        Context.MODE_PRIVATE
      )
      preferences.edit().apply {
        putBoolean("enabled", request.enabled ?: true)
        putLong("rotation_interval_ms", (request.rotationIntervalMs ?: (30.0 * 24 * 60 * 60 * 1000)).toLong())
        putBoolean("rotate_on_biometric_change", request.rotateOnBiometricChange ?: true)
        putBoolean("rotate_on_credential_change", request.rotateOnCredentialChange ?: true)
        putBoolean("manual_rotation_enabled", request.manualRotationEnabled ?: true)
        putInt("max_key_versions", (request.maxKeyVersions ?: 2.0).toInt())
        putBoolean("background_re_encryption", request.backgroundReEncryption ?: true)
        apply()
      }

      // Start periodic rotation check if enabled
      if (request.enabled == true) {
        startPeriodicRotationCheck()
      } else {
        stopPeriodicRotationCheck()
      }

      Unit
    }
  }

  /**
   * Rotates to a new key version.
   */
  override fun rotateKeys(request: RotateKeysRequest): Promise<RotationResult> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()

      // Set rotation in progress
      deps.keyRotationManager.setRotationInProgress(true)

      // Emit started event
      rotationEventCallback?.invoke(RotationEvent(
        type = "rotation:started",
        timestamp = System.currentTimeMillis().toDouble(),
        reason = request.reason ?: "Manual rotation",
        itemsReEncrypted = null,
        duration = null
      ))

      val startTime = System.currentTimeMillis()

      try {
        // Generate a new key
        val newKeyId = System.currentTimeMillis().toString()
        val success = deps.keyRotationManager.generateNewKey(newKeyId, requiresBiometry = false)
        if (!success) {
          // Set rotation not in progress on failure
          deps.keyRotationManager.setRotationInProgress(false)

          rotationEventCallback?.invoke(RotationEvent(
            type = "rotation:failed",
            timestamp = System.currentTimeMillis().toDouble(),
            reason = "Failed to generate new key",
            itemsReEncrypted = null,
            duration = null
          ))
          throw IllegalStateException("Failed to generate new key for rotation")
        }

        // Rotate to the new key
        val rotateSuccess = deps.keyRotationManager.rotateToNewKey(newKeyId)
        if (!rotateSuccess) {
          // Set rotation not in progress on failure
          deps.keyRotationManager.setRotationInProgress(false)

          rotationEventCallback?.invoke(RotationEvent(
            type = "rotation:failed",
            timestamp = System.currentTimeMillis().toDouble(),
            reason = "Failed to rotate to new key",
            itemsReEncrypted = null,
            duration = null
          ))
          throw IllegalStateException("Failed to rotate to new key")
        }

        // Perform re-encryption if enabled
        val preferences = deps.context.getSharedPreferences(
          "com.sensitiveinfo.keyrotation",
          Context.MODE_PRIVATE
        )
        val backgroundReEncryption = preferences.getBoolean("background_re_encryption", true)
        var itemsReEncrypted = 0.0
        if (backgroundReEncryption) {
          val result = reEncryptAllItemsImpl(deps, newKeyId)
          itemsReEncrypted = result.itemsReEncrypted
        }

        // Update last rotation timestamp
        preferences.edit().putLong("last_rotation_timestamp", System.currentTimeMillis()).apply()

        val duration = System.currentTimeMillis() - startTime

        // Set rotation not in progress
        deps.keyRotationManager.setRotationInProgress(false)

        // Emit completed event
        rotationEventCallback?.invoke(RotationEvent(
          type = "rotation:completed",
          timestamp = System.currentTimeMillis().toDouble(),
          reason = request.reason ?: "Manual rotation",
          itemsReEncrypted = itemsReEncrypted,
          duration = duration.toDouble()
        ))

        // Return result
        RotationResult(
          success = true,
          newKeyVersion = KeyVersion(id = newKeyId),
          itemsReEncrypted = itemsReEncrypted,
          duration = duration.toDouble(),
          reason = request.reason ?: "Manual rotation"
        )
      } catch (e: Exception) {
        // Set rotation not in progress on any error
        deps.keyRotationManager.setRotationInProgress(false)
        throw e
      }
    }
  }

  /**
   * Gets the current rotation status.
   */
  override fun getRotationStatus(): Promise<RotationStatus> {
    return Promise.async(coroutineScope) {
      val deps = ensureInitialized()

      val currentKey = deps.keyRotationManager.getCurrentKeyVersion()
      val availableVersions = deps.keyRotationManager.getAvailableKeyVersions()
      val lastRotationTimestamp = deps.keyRotationManager.getLastRotationTimestamp()
      val isRotating = deps.keyRotationManager.isRotationInProgress()

      RotationStatus(
        isRotating = isRotating,
        currentKeyVersion = currentKey?.let { KeyVersion(id = it) },
        availableKeyVersions = availableVersions.map { KeyVersion(id = it) }.toTypedArray(),
        lastRotationTimestamp = lastRotationTimestamp?.toDouble()
      )
    }
  }

  /**
   * Subscribes to rotation events.
   */
  override fun onRotationEvent(callback: (RotationEvent) -> Unit): () -> Unit {
    rotationEventCallback = callback
    // Also set the biometric change callback to the same callback
    dependencies?.keyRotationManager?.setBiometricChangeCallback(callback)
    return { rotationEventCallback = null }
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

      // Step 4: Re-encrypt items that use old keys or have empty metadata alias
      for ((key, entry) in entries) {
        try {
          // Re-encrypt if: (1) using old key, (2) metadata alias is empty, or (3) has ciphertext and iv
          val shouldReEncrypt = (entry.metadata.alias != currentKeyVersion || entry.metadata.alias.isEmpty()) && 
                                entry.ciphertext != null && entry.iv != null
          
          if (shouldReEncrypt) {
            // Get access control from persisted
            val accessControl = accessControlFromPersisted(entry.metadata.accessControl) ?: AccessControl.NONE
            val securityLevel = securityLevelFromPersisted(entry.metadata.securityLevel) ?: SecurityLevel.SOFTWARE

            // Decrypt with old key (use metadata.alias or entry.alias as fallback)
            val oldKeyAlias = entry.metadata.alias.takeIf { it.isNotEmpty() } ?: entry.alias
            
            val resolution = deps.cryptoManager.buildResolutionForPersisted(
              accessControl = accessControl,
              securityLevel = securityLevel,
              authenticators = entry.authenticators,
              requiresAuth = entry.requiresAuthentication,
              invalidateOnEnrollment = entry.invalidateOnEnrollment,
              useStrongBox = entry.useStrongBox
            )

            val plaintext = deps.cryptoManager.decrypt(
              oldKeyAlias,
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

            // Update storage with new key alias
            val updatedEntry = entry.copy(
              ciphertext = encryption.ciphertext,
              iv = encryption.iv,
              metadata = PersistedMetadata(
                securityLevel = entry.metadata.securityLevel,
                backend = entry.metadata.backend,
                accessControl = entry.metadata.accessControl,
                timestamp = entry.metadata.timestamp,
                alias = currentKeyVersion
              )
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

  private fun startPeriodicRotationCheck() {
    stopPeriodicRotationCheck() // Stop any existing

    val preferences = dependencies?.context?.getSharedPreferences(
      "com.sensitiveinfo.keyrotation",
      Context.MODE_PRIVATE
    ) ?: return

    val intervalMs = preferences.getLong("rotation_interval_ms", 30L * 24 * 60 * 60 * 1000)

    rotationCheckRunnable = Runnable {
      checkAndPerformRotation()
      // Schedule next check
      mainHandler.postDelayed(rotationCheckRunnable!!, intervalMs)
    }

    mainHandler.postDelayed(rotationCheckRunnable!!, intervalMs)
  }

  private fun stopPeriodicRotationCheck() {
    rotationCheckRunnable?.let { mainHandler.removeCallbacks(it) }
    rotationCheckRunnable = null
  }

  private fun checkAndPerformRotation() {
    val deps = dependencies ?: return

    val preferences = deps.context.getSharedPreferences(
      "com.sensitiveinfo.keyrotation",
      Context.MODE_PRIVATE
    )

    if (!preferences.getBoolean("enabled", true)) return

    val lastRotation = preferences.getLong("last_rotation_timestamp", 0)
    val intervalMs = preferences.getLong("rotation_interval_ms", 30L * 24 * 60 * 60 * 1000)
    val now = System.currentTimeMillis()

    if (now - lastRotation >= intervalMs) {
      // Perform automatic rotation
      coroutineScope.launch {
        try {
          val result = rotateKeys(RotateKeysRequest(reason = "Automatic time-based rotation", metadata = null))
          // Result is Promise, but we don't wait for it in background
        } catch (e: Exception) {
          // Log error but don't crash
          android.util.Log.e("KeyRotation", "Automatic rotation failed: ${e.message}")
        }
      }
    }
  }

  private suspend fun reEncryptAllItemsImpl(deps: Dependencies, newKeyVersion: String): ReEncryptAllItemsResponse {
    // Similar to reEncryptAllItems but synchronous
    val service = "" // Default service for now

    val entries = deps.storage.readAll(service)

    var reEncryptedCount = 0
    val errors = mutableListOf<ReEncryptError>()

    for ((key, entry) in entries) {
      try {
        // Re-encrypt if: (1) using old key, (2) metadata alias is empty, or (3) has ciphertext and iv
        val shouldReEncrypt = (entry.metadata.alias != newKeyVersion || entry.metadata.alias.isEmpty()) && 
                              entry.ciphertext != null && entry.iv != null
        
        if (shouldReEncrypt) {
          // Get access control from persisted
          val accessControl = accessControlFromPersisted(entry.metadata.accessControl) ?: AccessControl.NONE
          val securityLevel = securityLevelFromPersisted(entry.metadata.securityLevel) ?: SecurityLevel.SOFTWARE

          // Decrypt with old key (use metadata.alias or entry.alias as fallback)
          val oldKeyAlias = entry.metadata.alias.takeIf { it.isNotEmpty() } ?: entry.alias
          
          val resolution = deps.cryptoManager.buildResolutionForPersisted(
            accessControl = accessControl,
            securityLevel = securityLevel,
            authenticators = entry.authenticators,
            requiresAuth = entry.requiresAuthentication,
            invalidateOnEnrollment = entry.invalidateOnEnrollment,
            useStrongBox = entry.useStrongBox
          )

          val plaintext = deps.cryptoManager.decrypt(
            oldKeyAlias,
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
            newKeyVersion,
            plaintext,
            newResolution,
            null
          )

          // Update storage with new key alias
          val updatedEntry = entry.copy(
            ciphertext = encryption.ciphertext,
            iv = encryption.iv,
            metadata = PersistedMetadata(
              securityLevel = entry.metadata.securityLevel,
              backend = entry.metadata.backend,
              accessControl = entry.metadata.accessControl,
              timestamp = entry.metadata.timestamp,
              alias = newKeyVersion
            )
          )
          deps.storage.save(service, key, updatedEntry)

          reEncryptedCount++
        }
      } catch (e: Exception) {
        errors.add(ReEncryptError(key = key, error = e.message ?: "Unknown error"))
      }
    }

    return ReEncryptAllItemsResponse(
      itemsReEncrypted = reEncryptedCount.toDouble(),
      errors = errors.toTypedArray()
    )
  }
}
