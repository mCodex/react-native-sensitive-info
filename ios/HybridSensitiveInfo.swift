import Foundation
import LocalAuthentication
import NitroModules
import Security

private struct ResolvedAccessControl {
  let accessControl: AccessControl
  let securityLevel: SecurityLevel
  let accessible: CFString
  let accessControlRef: SecAccessControl?
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

      // Step 3: Create metadata
      let metadata = StorageMetadata(
        securityLevel: resolved.securityLevel,
        backend: .keychain,
        accessControl: resolved.accessControl,
        timestamp: Date().timeIntervalSince1970
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

      // Step 5: Build attributes
      var attributes = query
      attributes[kSecValueData as String] = Data(request.value.utf8)
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
          timestamp: Date().timeIntervalSince1970
        )

        var fallbackAttributes = query
        fallbackAttributes[kSecValueData as String] = Data(request.value.utf8)
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
    var status = performCopyMatching(query as CFDictionary, result: &result)

    if status == errSecInteractionNotAllowed || status == errSecAuthFailed {
      var authQuery = query
      authQuery[kSecUseOperationPrompt as String] = prompt?.title ?? "Authenticate to access sensitive data"
      let context = makeLAContext(prompt: prompt)
      authQuery[kSecUseAuthenticationContext as String] = context
      status = performCopyMatching(authQuery as CFDictionary, result: &result)
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
      timestamp: Date().timeIntervalSince1970
    )

    var value: String?
    if includeValue {
      if let data = dictionary[kSecValueData as String] as? Data {
        value = String(data: data, encoding: .utf8)
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

  private func performCopyMatching(_ query: CFDictionary, result: inout CFTypeRef?) -> OSStatus {
    if Thread.isMainThread {
      return SecItemCopyMatching(query, &result)
    }

    var status: OSStatus = errSecSuccess
    DispatchQueue.main.sync {
      status = SecItemCopyMatching(query, &result)
    }
    return status
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
}
