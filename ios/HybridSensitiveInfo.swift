import Foundation
import LocalAuthentication
import NitroModules
import Security
import CommonCrypto

// MARK: - Crypto Helpers

private func encryptData(_ data: Data, withKey keyData: Data) throws -> Data {
  let keyLength = kCCKeySizeAES256
  let dataLength = data.count
  let bufferSize = dataLength + kCCBlockSizeAES128
  var buffer = Data(count: bufferSize)
  var numBytesEncrypted: size_t = 0

  let cryptStatus = keyData.withUnsafeBytes { keyBytes in
    data.withUnsafeBytes { dataBytes in
      buffer.withUnsafeMutableBytes { bufferBytes in
        CCCrypt(
          CCOperation(kCCEncrypt),
          CCAlgorithm(kCCAlgorithmAES),
          CCOptions(kCCOptionPKCS7Padding),
          keyBytes.baseAddress,
          keyLength,
          nil,
          dataBytes.baseAddress,
          dataLength,
          bufferBytes.baseAddress,
          bufferSize,
          &numBytesEncrypted
        )
      }
    }
  }

  guard cryptStatus == kCCSuccess else {
    throw RuntimeError.error(withMessage: "Encryption failed")
  }

  buffer.removeSubrange(numBytesEncrypted..<buffer.count)
  return buffer
}

private func decryptData(_ data: Data, withKey keyData: Data) throws -> Data {
  let keyLength = kCCKeySizeAES256
  let dataLength = data.count
  let bufferSize = dataLength + kCCBlockSizeAES128
  var buffer = Data(count: bufferSize)
  var numBytesDecrypted: size_t = 0

  let cryptStatus = keyData.withUnsafeBytes { keyBytes in
    data.withUnsafeBytes { dataBytes in
      buffer.withUnsafeMutableBytes { bufferBytes in
        CCCrypt(
          CCOperation(kCCDecrypt),
          CCAlgorithm(kCCAlgorithmAES),
          CCOptions(kCCOptionPKCS7Padding),
          keyBytes.baseAddress,
          keyLength,
          nil,
          dataBytes.baseAddress,
          dataLength,
          bufferBytes.baseAddress,
          bufferSize,
          &numBytesDecrypted
        )
      }
    }
  }

  guard cryptStatus == kCCSuccess else {
    throw RuntimeError.error(withMessage: "Decryption failed")
  }

  buffer.removeSubrange(numBytesDecrypted..<buffer.count)
  return buffer
}

private struct RawItem {
  let key: String
  let encryptedValue: Data
  let metadata: Data
}

/// Apple platforms implementation of the SensitiveInfo Nitro module.
///
/// Provides secure storage for sensitive data using Keychain with support for biometric,
/// device credential, and Secure Enclave authentication on iOS, macOS, visionOS, and watchOS.
///
/// The implementation follows a consistent pattern across all methods:
/// 1. Validate inputs using KeychainValidator
/// 2. Build Keychain queries using KeychainQueryBuilder
/// 3. Execute Keychain operations on dedicated work queue
/// 4. Encode/decode metadata using StorageMetadataHandler
/// 5. Return responses with consistent metadata
///
/// Example usage:
/// ```swift
/// let singleValue = try await sensitiveInfo.getItem(
///   request: SensitiveInfoGetRequest(key: "token", service: "auth")
/// )
/// ```
///
/// @since 6.0.0
final class HybridSensitiveInfo: HybridSensitiveInfoSpec {
  private let workQueue = DispatchQueue(label: "com.mcodex.sensitiveinfo.keychain", qos: .userInitiated)
  private let metadataHandler = StorageMetadataHandler()
  private let validator = KeychainValidator()
  private let queryBuilder = KeychainQueryBuilder(defaultService: Bundle.main.bundleIdentifier ?? "default")
  private let defaultService = Bundle.main.bundleIdentifier ?? "default"
  private let availabilityResolver = SecurityAvailabilityResolver()
  private lazy var accessControlResolver = AccessControlResolver { [weak self] in
    guard let self else {
      return (secureEnclave: false, strongBox: false, biometry: false, deviceCredential: false)
    }
    let availability = self.resolveAvailability()
    return (
      secureEnclave: availability.secureEnclave,
      strongBox: availability.strongBox,
      biometry: availability.biometry,
      deviceCredential: availability.deviceCredential
    )
  }

  private var rotationEventCallback: ((RotationEvent) -> Void)?
  private var rotationTimer: Timer?

  private struct ResolvedAccessControl {
    let accessControl: AccessControl
    let securityLevel: SecurityLevel
    let accessible: CFString
    let accessControlRef: SecAccessControl?
  }

  /// Stores or replaces an item in the Keychain, returning metadata describing the applied
  /// security policy.
  ///
  /// Process:
  /// 1. Validates key and value
  /// 2. Resolves service name and access control
  /// 3. Builds Keychain query for the key/service pair
  /// 4. Constructs attributes with value, access control, and metadata
  /// 5. Deletes any existing item
  /// 6. Attempts to add the item
  /// 7. Falls back to software-only if hardware policy unavailable
  /// 8. Returns mutation result with applied metadata
  ///
  /// @param request The set request containing key, value, and options
  /// @return Promise resolving to MutationResult with applied metadata
  /// @throws KeychainValidationError if key or value is invalid
  /// @throws RuntimeError if Keychain operation fails
  func setItem(request: SensitiveInfoSetRequest) throws -> Promise<MutationResult> {
    Promise.parallel(workQueue) { [self] in
      // Step 1: Validate inputs
      try validator.validateKey(request.key)
      try validator.validateValue(request.value)

      // Step 2: Resolve service and access control
      let service = normalizedService(request.service)
      let resolved = try resolveAccessControl(preferred: request.accessControl)

      // Step 3: Generate alias and create encryption key
      let alias = UUID().uuidString
      let keyData = try createEncryptionKey(alias: alias, accessControl: resolved.accessControlRef)

      // Step 4: Encrypt the value
      let encryptedValue = try encryptData(Data(request.value.utf8), withKey: keyData)

      // Step 5: Create metadata
      let metadata = StorageMetadata(
        securityLevel: resolved.securityLevel,
        backend: .keychain,
        accessControl: resolved.accessControl,
        timestamp: Date().timeIntervalSince1970,
        alias: alias
      )

      // Step 4: Build query using query builder
      var query = queryBuilder.makeBaseQuery(
        key: request.key,
        service: service,
        synchronizable: request.iosSynchronizable
      )
      if let group = request.keychainGroup {
        query[kSecAttrAccessGroup as String] = group
      }

      // Step 6: Build attributes
      var attributes = query
      attributes[kSecValueData as String] = encryptedValue
      if let accessControlRef = resolved.accessControlRef {
        attributes[kSecAttrAccessControl as String] = accessControlRef
      } else {
        attributes[kSecAttrAccessible as String] = resolved.accessible
      }
      attributes[kSecAttrGeneric as String] = try metadataHandler.encodeMetadata(metadata)

      // Step 6: Delete existing and add new
      deleteExisting(query: query)
      var status = SecItemAdd(attributes as CFDictionary, nil)

      if status == errSecSuccess {
        return MutationResult(metadata: metadata)
      }

      // Step 7: Fallback to software if hardware unavailable
      if status == errSecParam, resolved.accessControlRef != nil {
        let fallbackMetadata = StorageMetadata(
          securityLevel: .software,
          backend: .keychain,
          accessControl: .none,
          timestamp: Date().timeIntervalSince1970,
          alias: alias
        )

        var fallbackAttributes = query
        fallbackAttributes[kSecValueData as String] = encryptedValue
        fallbackAttributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        fallbackAttributes[kSecAttrGeneric as String] = try metadataHandler.encodeMetadata(fallbackMetadata)

        status = SecItemAdd(fallbackAttributes as CFDictionary, nil)
        if status == errSecSuccess {
          return MutationResult(metadata: fallbackMetadata)
        }
      }

      throw runtimeError(for: status, operation: "set")
    }
  }

  /// Fetches a single item and optionally includes the plaintext value if the client requested it.
  ///
  /// Process:
  /// 1. Validates the key
  /// 2. Resolves service name
  /// 3. Builds retrieval query using query builder
  /// 4. Executes Keychain query with optional authentication
  /// 5. Reconstructs item from Keychain attributes
  /// 6. Returns item or nil if not found
  ///
  /// @param request The get request with key and authentication prompt
  /// @return Promise resolving to SensitiveInfoItem or nil if not found
  /// @throws KeychainValidationError if key is invalid
  /// @throws RuntimeError if Keychain operation fails
  func getItem(request: SensitiveInfoGetRequest) throws -> Promise<SensitiveInfoItem?> {
    Promise.parallel(workQueue) { [self] in
      // Step 1: Validate key
      try validator.validateKey(request.key)

      // Step 2: Resolve service
      let service = normalizedService(request.service)
      let includeValue = request.includeValue ?? true

      // Step 3: Build retrieval query
      var query = queryBuilder.makeBaseQuery(
        key: request.key,
        service: service,
        synchronizable: request.iosSynchronizable
      )
      if let group = request.keychainGroup {
        query[kSecAttrAccessGroup as String] = group
      }
      query[kSecMatchLimit as String] = kSecMatchLimitOne
      query[kSecReturnAttributes as String] = kCFBooleanTrue
      if includeValue {
        query[kSecReturnData as String] = kCFBooleanTrue
      }

      // Step 4: Execute query
      guard let raw = try copyMatching(query: query, prompt: request.authenticationPrompt) as? NSDictionary else {
        return nil
      }

      // Step 5: Reconstruct item
      return try makeItem(from: raw, includeValue: includeValue)
    }
  }

  /// Removes a specific key/service pair from the Keychain.
  ///
  /// Process:
  /// 1. Validates the key
  /// 2. Resolves service name
  /// 3. Builds delete query using query builder
  /// 4. Executes Keychain delete
  /// 5. Returns success status
  ///
  /// @param request The delete request containing key
  /// @return Promise resolving to boolean (success)
  /// @throws KeychainValidationError if key is invalid
  /// @throws RuntimeError if Keychain operation fails
  func deleteItem(request: SensitiveInfoDeleteRequest) throws -> Promise<Bool> {
    Promise.parallel(workQueue) { [self] in
      // Step 1: Validate key
      try validator.validateKey(request.key)

      // Step 2: Resolve service
      let service = normalizedService(request.service)

      // Step 3: Build delete query
      var query = queryBuilder.makeBaseQuery(
        key: request.key,
        service: service,
        synchronizable: request.iosSynchronizable
      )
      if let group = request.keychainGroup {
        query[kSecAttrAccessGroup as String] = group
      }

      // Step 4: Execute delete
      let status = SecItemDelete(query as CFDictionary)

      // Step 5: Return status
      switch status {
      case errSecSuccess:
        return true
      case errSecItemNotFound:
        return false
      default:
        throw runtimeError(for: status, operation: "delete")
      }
    }
  }

  /// Checks for existence without allocating an item payload.
  ///
  /// Process:
  /// 1. Validates the key
  /// 2. Resolves service name
  /// 3. Builds existence check query
  /// 4. Executes Keychain query
  /// 5. Returns boolean existence
  ///
  /// @param request The has request containing key
  /// @return Promise resolving to boolean (exists)
  /// @throws KeychainValidationError if key is invalid
  /// @throws RuntimeError if Keychain operation fails
  func hasItem(request: SensitiveInfoHasRequest) throws -> Promise<Bool> {
    Promise.parallel(workQueue) { [self] in
      // Step 1: Validate key
      try validator.validateKey(request.key)

      // Step 2: Resolve service
      let service = normalizedService(request.service)

      // Step 3: Build query
      var query = queryBuilder.makeBaseQuery(
        key: request.key,
        service: service,
        synchronizable: request.iosSynchronizable
      )
      if let group = request.keychainGroup {
        query[kSecAttrAccessGroup as String] = group
      }
      query[kSecMatchLimit as String] = kSecMatchLimitOne
      query[kSecReturnAttributes as String] = kCFBooleanTrue

      // Step 4: Execute query
      let result = try copyMatching(query: query, prompt: request.authenticationPrompt)

      // Step 5: Return existence
      return result != nil
    }
  }

  /// Enumerates every item matching the provided service and inclusion options.
  ///
  /// Process:
  /// 1. Validates options (service if provided)
  /// 2. Resolves service name
  /// 3. Builds enumerate query
  /// 4. Executes Keychain query to retrieve all items
  /// 5. Reconstructs items from Keychain attributes
  /// 6. Filters and returns array of items
  ///
  /// @param request The enumerate request with optional include_values flag
  /// @return Promise resolving to array of SensitiveInfoItem
  /// @throws KeychainValidationError if service is invalid
  /// @throws RuntimeError if Keychain operation fails
  func getAllItems(request: SensitiveInfoEnumerateRequest?) throws -> Promise<[SensitiveInfoItem]> {
    Promise.parallel(workQueue) { [self] in
      // Step 1: Resolve options
      let includeValues = request?.includeValues ?? false
      let service = normalizedService(request?.service)

      // Step 2: Build enumerate query
      var query = queryBuilder.makeBaseQuery(
        key: nil,
        service: service,
        synchronizable: request?.iosSynchronizable
      )
      if let group = request?.keychainGroup {
        query[kSecAttrAccessGroup as String] = group
      }
      query[kSecMatchLimit as String] = kSecMatchLimitAll
      query[kSecReturnAttributes as String] = kCFBooleanTrue
      if includeValues {
        query[kSecReturnData as String] = kCFBooleanTrue
      }

      // Step 3: Execute query
      let result = try copyMatching(query: query, prompt: request?.authenticationPrompt)

      // Step 4: Reconstruct items
      guard let array = result as? [NSDictionary] else {
        return []
      }

      // Step 5: Filter and return
      return try array.compactMap { dict in
        try makeItem(from: dict, includeValue: includeValues)
      }
    }
  }

  /// Deletes all items for the requested service.
  ///
  /// Process:
  /// 1. Resolves service name
  /// 2. Builds delete query for all items in service
  /// 3. Executes Keychain delete
  /// 4. Returns success (treats not found as success)
  ///
  /// @param request Optional SensitiveInfoOptions containing service name
  /// @return Promise resolving to Void
  /// @throws RuntimeError if Keychain operation fails
  func clearService(request: SensitiveInfoOptions?) throws -> Promise<Void> {
    Promise.parallel(workQueue) { [self] in
      // Step 1: Resolve service
      let service = normalizedService(request?.service)

      // Step 2: Build delete query for all items
      var query = queryBuilder.makeBaseQuery(
        key: nil,
        service: service,
        synchronizable: request?.iosSynchronizable
      )
      if let group = request?.keychainGroup {
        query[kSecAttrAccessGroup as String] = group
      }

      // Step 3: Execute delete
      let status = SecItemDelete(query as CFDictionary)

      // Step 4: Return result
      switch status {
      case errSecSuccess, errSecItemNotFound:
        return ()
      default:
        throw runtimeError(for: status, operation: "clearService")
      }
    }
  }

  func getSupportedSecurityLevels() throws -> Promise<SecurityAvailability> {
    Promise.resolved(withResult: resolveAvailability())
  }

  /**
   * Initializes key rotation system.
   */
  func initializeKeyRotation(request: InitializeKeyRotationRequest) throws -> Promise<Void> {
    Promise.parallel(workQueue) { [self] in
      let defaults = UserDefaults.standard
      defaults.set(request.enabled ?? true, forKey: "keyRotationEnabled")
      defaults.set(request.rotationIntervalMs ?? (30 * 24 * 60 * 60 * 1000), forKey: "rotationIntervalMs")
      defaults.set(request.rotateOnBiometricChange ?? true, forKey: "rotateOnBiometricChange")
      defaults.set(request.rotateOnCredentialChange ?? true, forKey: "rotateOnCredentialChange")
      defaults.set(request.manualRotationEnabled ?? true, forKey: "manualRotationEnabled")
      defaults.set(request.maxKeyVersions ?? 2, forKey: "maxKeyVersions")
      defaults.set(request.backgroundReEncryption ?? true, forKey: "backgroundReEncryption")
      defaults.synchronize()

      // Start periodic rotation check if enabled
      if request.enabled ?? true {
        startPeriodicRotationCheck()
      } else {
        stopPeriodicRotationCheck()
      }

      return ()
    }
  }

  /**
   * Rotates to a new key version.
   */
  func rotateKeys(request: RotateKeysRequest) throws -> Promise<RotationResult> {
    Promise.parallel(workQueue) { [self] in
      let manager = getiOSKeyRotationManager()

      // Set rotation in progress
      manager.setRotationInProgress(true)

      // Emit started event
      rotationEventCallback?(RotationEvent(
        type: "rotation:started",
        timestamp: Double(Date().timeIntervalSince1970 * 1000),
        reason: request.reason ?? "Manual rotation",
        itemsReEncrypted: nil,
        duration: nil
      ))

      let startTime = Date()

      do {
        // Generate a new key
        let newKeyId = ISO8601DateFormatter().string(from: Date())
        guard let _ = manager.generateNewKey(
          keyVersionId: newKeyId,
          requiresBiometry: true
        ) else {
          // Set rotation not in progress on failure
          manager.setRotationInProgress(false)

          rotationEventCallback?(RotationEvent(
            type: "rotation:failed",
            timestamp: Double(Date().timeIntervalSince1970 * 1000),
            reason: "Failed to generate new key",
            itemsReEncrypted: nil,
            duration: nil
          ))
          throw RuntimeError.error(withMessage: "Failed to generate new key for rotation")
        }

        // Rotate to the new key
        manager.rotateToNewKey(newKeyVersionId: newKeyId)

        // Perform re-encryption if enabled
        let defaults = UserDefaults.standard
        let backgroundReEncryption = defaults.bool(forKey: "backgroundReEncryption")
        var itemsReEncrypted = 0.0
        if backgroundReEncryption {
          let result = try reEncryptAllItemsImpl(service: defaultService, newKeyVersion: newKeyId)
          itemsReEncrypted = result.itemsReEncrypted
        }

        // Update last rotation timestamp
        defaults.set(Int64(Date().timeIntervalSince1970 * 1000), forKey: "lastRotationTimestamp")
        defaults.synchronize()

        let duration = Date().timeIntervalSince(startTime) * 1000

        // Set rotation not in progress
        manager.setRotationInProgress(false)

        // Emit completed event
        rotationEventCallback?(RotationEvent(
          type: "rotation:completed",
          timestamp: Double(Date().timeIntervalSince1970 * 1000),
          reason: request.reason ?? "Manual rotation",
          itemsReEncrypted: itemsReEncrypted,
          duration: duration
        ))

        // Return result
        return RotationResult(
          success: true,
          newKeyVersion: KeyVersion(id: newKeyId),
          itemsReEncrypted: itemsReEncrypted,
          duration: duration,
          reason: request.reason ?? "Manual rotation"
        )
      } catch {
        // Set rotation not in progress on any error
        manager.setRotationInProgress(false)
        throw error
      }
    }
  }

  func getRotationStatus() throws -> Promise<RotationStatus> {
    Promise.parallel(workQueue) { [self] in
      let manager = getiOSKeyRotationManager()

      let currentKey = manager.getCurrentKeyVersion()
      let availableVersions = manager.getAvailableKeyVersions()
      let isRotating = manager.isRotationInProgress()

      let defaults = UserDefaults.standard
      let lastRotationTimestamp = defaults.object(forKey: "lastRotationTimestamp") as? Int64

      return RotationStatus(
        isRotating: isRotating,
        currentKeyVersion: currentKey != nil ? KeyVersion(id: currentKey!) : nil,
        availableKeyVersions: availableVersions.map { KeyVersion(id: $0) },
        lastRotationTimestamp: lastRotationTimestamp != nil ? Double(lastRotationTimestamp!) : nil
      )
    }
  }

  /**
   * Subscribes to rotation events.
   */
  func onRotationEvent(callback: @escaping (RotationEvent) -> Void) throws -> () -> Void {
    rotationEventCallback = callback
    // Also set the biometric change callback to the same callback
    getiOSKeyRotationManager().setBiometricChangeCallback(callback)
    return { [weak self] in self?.rotationEventCallback = nil }
  }

  /**
   * Re-encrypts all items with the current key.
   * Migrates items encrypted with old keys to the current key version.
   */
  func reEncryptAllItems(request: ReEncryptAllItemsRequest) throws -> Promise<ReEncryptAllItemsResponse> {
    Promise.parallel(workQueue) { [self] in
      let manager = getiOSKeyRotationManager()

      // Step 1: Get current key version
      guard let currentKeyVersion = manager.getCurrentKeyVersion() else {
        throw RuntimeError.error(withMessage: "No current key version available")
      }

      // Step 2: Resolve service
      let service = self.normalizedService(request.service)

      // Step 3: Get all items for the service
      let items = try self.getAllItemsRaw(service: service)

      var reEncryptedCount = 0
      var errors: [ReEncryptError] = []

      // Step 4: Re-encrypt items that use old keys
      for item in items {
        do {
          let metadata = try self.metadataHandler.decodeMetadata(from: item.metadata) ?? StorageMetadata(
            securityLevel: .software,
            backend: .keychain,
            accessControl: .none,
            timestamp: Date().timeIntervalSince1970,
            alias: ""
          )

          if metadata.alias != currentKeyVersion {
            // Decrypt with old key
            let oldKeyData = try self.retrieveEncryptionKey(alias: metadata.alias)
            let decryptedData = try decryptData(item.encryptedValue, withKey: oldKeyData)

            // Resolve access control for the new key
            let resolvedAccessControl = try self.resolveAccessControl(preferred: metadata.accessControl)

            // Encrypt with new key
            let newKeyData = try self.createEncryptionKey(alias: currentKeyVersion, accessControl: resolvedAccessControl.accessControlRef)
            let newEncryptedData = try encryptData(decryptedData, withKey: newKeyData)

            // Update metadata
            let newMetadata = StorageMetadata(
              securityLevel: resolvedAccessControl.securityLevel,
              backend: metadata.backend,
              accessControl: resolvedAccessControl.accessControl,
              timestamp: Date().timeIntervalSince1970,
              alias: currentKeyVersion
            )

            // Update Keychain item
            try self.updateItem(
              key: item.key,
              service: service,
              encryptedValue: newEncryptedData,
              metadata: newMetadata
            )

            reEncryptedCount += 1
          }
        } catch {
          errors.append(ReEncryptError(key: item.key, error: error.localizedDescription))
        }
      }

      // Step 5: Return results
      return ReEncryptAllItemsResponse(
        itemsReEncrypted: Double(reEncryptedCount),
        errors: errors
      )
    }
  }

  // MARK: - Keychain helpers

  private func deleteExisting(query: [String: Any]) {
    var deleteQuery = query
    deleteQuery[kSecReturnData as String] = nil
    deleteQuery[kSecReturnAttributes as String] = nil
    deleteQuery[kSecMatchLimit as String] = kSecMatchLimitOne
    SecItemDelete(deleteQuery as CFDictionary)
  }

  private func copyMatching(query: [String: Any], prompt: AuthenticationPrompt?) throws -> AnyObject? {
#if targetEnvironment(simulator)
    try performSimulatorBiometricPromptIfNeeded(prompt: prompt)
#endif
    var result: CFTypeRef?
    var status = SecItemCopyMatching(query as CFDictionary, &result)

    if status == errSecInteractionNotAllowed || status == errSecAuthFailed {
      var authQuery = query
      authQuery[kSecUseOperationPrompt as String] = prompt?.title ?? "Authenticate to access sensitive data"
      let context = makeLAContext(prompt: prompt)
      authQuery[kSecUseAuthenticationContext as String] = context
      status = SecItemCopyMatching(authQuery as CFDictionary, &result)
    }

    switch status {
    case errSecSuccess:
      return result as AnyObject?
    case errSecItemNotFound:
      return nil
    default:
      throw runtimeError(for: status, operation: "fetch")
    }
  }

  private func makeItem(from dictionary: NSDictionary, includeValue: Bool) throws -> SensitiveInfoItem {
    guard
      let key = dictionary[kSecAttrAccount as String] as? String,
      let service = dictionary[kSecAttrService as String] as? String
    else {
      throw RuntimeError.error(withMessage: "[E_INVALID_RESPONSE] Unexpected keychain payload shape")
    }

    let metadata = try metadataHandler.decodeMetadata(from: dictionary[kSecAttrGeneric as String] as? Data) ?? StorageMetadata(
      securityLevel: .software,
      backend: .keychain,
      accessControl: .none,
      timestamp: Date().timeIntervalSince1970,
      alias: ""
    )

    var value: String?
    if includeValue {
      if let encryptedData = dictionary[kSecValueData as String] as? Data {
        let keyData = try retrieveEncryptionKey(alias: metadata.alias)
        let decryptedData = try decryptData(encryptedData, withKey: keyData)
        value = String(data: decryptedData, encoding: .utf8)
      }
    }

    return SensitiveInfoItem(key: key, service: service, value: value, metadata: metadata)
  }

  // MARK: - Access control resolution

  /// Maps the JS access-control request to the closest policy supported by the current device.
  private func resolveAccessControl(preferred: AccessControl?) throws -> ResolvedAccessControl {
    let preferredPolicy = preferred.flatMap { AccessPolicy(rawValue: $0.stringValue) }
    let context = try accessControlResolver.resolve(preferred: preferredPolicy)
    let accessControl = AccessControl(fromString: context.policy.rawValue) ?? .none
    let securityLevel = SecurityLevel(fromString: context.securityLevel.rawValue) ?? .software

    return ResolvedAccessControl(
      accessControl: accessControl,
      securityLevel: securityLevel,
      accessible: context.accessible,
      accessControlRef: context.accessControlRef
    )
  }

  // MARK: - Availability

  private func resolveAvailability() -> SecurityAvailability {
    let capabilities = availabilityResolver.resolve()
    return SecurityAvailability(
      secureEnclave: capabilities.secureEnclave,
      strongBox: capabilities.strongBox,
      biometry: capabilities.biometry,
      deviceCredential: capabilities.deviceCredential
    )
  }

  // MARK: - Utilities

  /// Mirrors Android's namespace resolution so metadata stays comparable across platforms.
  private func normalizedService(_ service: String?) -> String {
    service?.isEmpty == false ? service! : defaultService
  }

  private func makeLAContext(prompt: AuthenticationPrompt?) -> LAContext {
    let context = LAContext()
    if let cancel = prompt?.cancel {
      context.localizedCancelTitle = cancel
    }
    if let description = prompt?.description {
      context.localizedReason = description
    } else if let title = prompt?.title {
      context.localizedReason = title
    }
    if let subtitle = prompt?.subtitle {
      context.localizedFallbackTitle = subtitle
    }
    return context
  }

  private func runtimeError(for status: OSStatus, operation: String) -> RuntimeError {
    if isAuthenticationCanceled(status: status) {
      return RuntimeError.error(withMessage: "[E_AUTH_CANCELED] Authentication prompt canceled by the user.")
    }
    let message = SecCopyErrorMessageString(status, nil) as String? ?? "OSStatus(\(status))"
    return RuntimeError.error(withMessage: "Keychain \(operation) failed: \(message)")
  }

  private func isAuthenticationCanceled(status: OSStatus) -> Bool {
    switch status {
    case errSecUserCanceled:
      return true
    default:
      return false
    }
  }

  private func createEncryptionKey(alias: String, accessControl: SecAccessControl?) throws -> Data {
    // Try to retrieve existing key
    do {
      return try retrieveEncryptionKey(alias: alias)
    } catch {
      // Key doesn't exist, create it
    }

    // Create a random AES256 key
    var keyData = Data(count: kCCKeySizeAES256)
    let result = keyData.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, kCCKeySizeAES256, $0.baseAddress!) }
    guard result == errSecSuccess else {
      throw RuntimeError.error(withMessage: "Failed to generate encryption key")
    }

    // Store the key in Keychain as generic password
    var keyAttributes: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "\(defaultService).encryptionKeys",
      kSecAttrAccount as String: alias,
      kSecValueData as String: keyData,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
    ]

    if let accessControl = accessControl {
      keyAttributes[kSecAttrAccessControl as String] = accessControl
    }

    let status = SecItemAdd(keyAttributes as CFDictionary, nil)
    guard status == errSecSuccess else {
      throw RuntimeError.error(withMessage: "Failed to store encryption key")
    }

    return keyData
  }

  private func retrieveEncryptionKey(alias: String) throws -> Data {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "\(defaultService).encryptionKeys",
      kSecAttrAccount as String: alias,
      kSecReturnData as String: true
    ]

    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    guard status == errSecSuccess, let keyData = result as? Data else {
      throw RuntimeError.error(withMessage: "Failed to retrieve encryption key")
    }

    return keyData
  }

  private func getAllItemsRaw(service: String) throws -> [RawItem] {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecMatchLimit as String: kSecMatchLimitAll,
      kSecReturnAttributes as String: kCFBooleanTrue,
      kSecReturnData as String: kCFBooleanTrue,
    ]

    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)

    guard status == errSecSuccess, let array = result as? [[String: Any]] else {
      return []
    }

    return array.compactMap { dict in
      guard
        let key = dict[kSecAttrAccount as String] as? String,
        let encryptedValue = dict[kSecValueData as String] as? Data,
        let metadata = dict[kSecAttrGeneric as String] as? Data
      else {
        return nil
      }
      return RawItem(key: key, encryptedValue: encryptedValue, metadata: metadata)
    }
  }

  private func updateItem(key: String, service: String, encryptedValue: Data, metadata: StorageMetadata) throws {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: key,
      kSecAttrService as String: service,
    ]

    let updateAttributes: [String: Any] = [
      kSecValueData as String: encryptedValue,
      kSecAttrGeneric as String: try metadataHandler.encodeMetadata(metadata),
    ]

    let status = SecItemUpdate(query as CFDictionary, updateAttributes as CFDictionary)
    guard status == errSecSuccess else {
      throw RuntimeError.error(withMessage: "Failed to update item")
    }
  }

#if targetEnvironment(simulator)
  private func performSimulatorBiometricPromptIfNeeded(prompt: AuthenticationPrompt?) throws {
    guard let prompt else { return }

    let context = makeLAContext(prompt: prompt)
    var error: NSError?

    guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error),
          context.biometryType != .none else {
      return
    }

    let reason = prompt.description ?? prompt.title ?? "Authenticate to continue"
    let semaphore = DispatchSemaphore(value: 0)
    var evaluationError: Error?

    DispatchQueue.main.async {
      context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, policyError in
        if !success {
          evaluationError = policyError
        }
        semaphore.signal()
      }
    }

    semaphore.wait()

    if let evaluationError {
      if let laError = evaluationError as? LAError {
        switch laError.code {
        case .userCancel, .userFallback, .systemCancel:
          throw RuntimeError.error(withMessage: "[E_AUTH_CANCELED] Authentication prompt canceled by the user.")
        default:
          break
        }
      }

      throw RuntimeError.error(withMessage: "Keychain fetch failed: \(evaluationError.localizedDescription)")
    }
  }
#endif

  // MARK: - Key Rotation Helpers

  private func startPeriodicRotationCheck() {
    stopPeriodicRotationCheck()

    let defaults = UserDefaults.standard
    let intervalMs = defaults.double(forKey: "rotationIntervalMs")
    let intervalSeconds = intervalMs / 1000.0

    rotationTimer = Timer.scheduledTimer(withTimeInterval: intervalSeconds, repeats: true) { [weak self] _ in
      self?.checkAndPerformRotation()
    }
  }

  private func stopPeriodicRotationCheck() {
    rotationTimer?.invalidate()
    rotationTimer = nil
  }

  private func checkAndPerformRotation() {
    let defaults = UserDefaults.standard
    guard defaults.bool(forKey: "keyRotationEnabled") else { return }

    // Check for biometric changes
    getiOSKeyRotationManager().handleBiometricEnrollmentChange()

    let lastRotation = defaults.object(forKey: "lastRotationTimestamp") as? Int64 ?? 0
    let intervalMs = defaults.double(forKey: "rotationIntervalMs")
    let now = Int64(Date().timeIntervalSince1970 * 1000)

    if Double(now - lastRotation) >= intervalMs {
      // Perform automatic rotation
      DispatchQueue.global(qos: .background).async { [weak self] in
        do {
          _ = try self?.rotateKeys(request: RotateKeysRequest(reason: "Automatic time-based rotation", metadata: nil))
        } catch {
          print("Automatic rotation failed: \(error.localizedDescription)")
        }
      }
    }
  }

  private func reEncryptAllItemsImpl(service: String, newKeyVersion: String) throws -> ReEncryptAllItemsResponse {
    let items = try getAllItemsRaw(service: service)

    var reEncryptedCount = 0
    var errors: [ReEncryptError] = []

    for item in items {
      do {
        let metadata = try metadataHandler.decodeMetadata(from: item.metadata) ?? StorageMetadata(
          securityLevel: .software,
          backend: .keychain,
          accessControl: .none,
          timestamp: Date().timeIntervalSince1970,
          alias: ""
        )

        if metadata.alias != newKeyVersion {
          // Decrypt with old key
          let oldKeyData = try retrieveEncryptionKey(alias: metadata.alias)
          let decryptedData = try decryptData(item.encryptedValue, withKey: oldKeyData)

          // Resolve access control for the new key
          let resolvedAccessControl = try resolveAccessControl(preferred: metadata.accessControl)

          // Encrypt with new key
          let newKeyData = try createEncryptionKey(alias: newKeyVersion, accessControl: resolvedAccessControl.accessControlRef)
          let newEncryptedData = try encryptData(decryptedData, withKey: newKeyData)

          // Update metadata
          let newMetadata = StorageMetadata(
            securityLevel: resolvedAccessControl.securityLevel,
            backend: metadata.backend,
            accessControl: resolvedAccessControl.accessControl,
            timestamp: Date().timeIntervalSince1970,
            alias: newKeyVersion
          )

          // Update Keychain item
          try updateItem(
            key: item.key,
            service: service,
            encryptedValue: newEncryptedData,
            metadata: newMetadata
          )

          reEncryptedCount += 1
        }
      } catch {
        errors.append(ReEncryptError(key: item.key, error: error.localizedDescription))
      }
    }

    return ReEncryptAllItemsResponse(
      itemsReEncrypted: Double(reEncryptedCount),
      errors: errors
    )
  }
}