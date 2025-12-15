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
/// Consumers interact with the generated JS API:
/// ```ts
/// import { setItem } from 'react-native-sensitive-info'
/// await setItem('session-token', 'secret', { accessControl: 'secureEnclaveBiometry' })
/// ```
///
/// The Swift bridge runs keychain queries on a dedicated queue, encodes consistent metadata, and
/// returns results that mirror the TypeScript types shipped in the package across iOS, macOS,
/// visionOS, and watchOS.
public final class HybridSensitiveInfo: HybridSensitiveInfoSpec {
  private let workQueue = DispatchQueue(label: "com.mcodex.sensitiveinfo.keychain", qos: .userInitiated)
  private let encoder: JSONEncoder = {
    let encoder = JSONEncoder()
    encoder.outputFormatting = []
    return encoder
  }()
  private let decoder = JSONDecoder()
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
  /// security policy. If the requested hardware policy is unavailable (for example, simulators with
  /// no passcode), we fall back to a software-only accessibility to keep the call successful.
  public func setItem(request: SensitiveInfoSetRequest) throws -> Promise<MutationResult> {
    Promise.parallel(workQueue) { [self] in
      let service = normalizedService(request.service)
      let resolved = try resolveAccessControl(preferred: request.accessControl)

      let metadata = StorageMetadata(
        securityLevel: resolved.securityLevel,
        backend: .keychain,
        accessControl: resolved.accessControl,
        timestamp: Date().timeIntervalSince1970
      )

      let query = makeBaseQuery(
        key: request.key,
        service: service,
        synchronizable: request.iosSynchronizable,
        accessGroup: request.keychainGroup
      )

      var attributes = query
      attributes[kSecValueData as String] = Data(request.value.utf8)
      if let accessControlRef = resolved.accessControlRef {
        attributes[kSecAttrAccessControl as String] = accessControlRef
      } else {
        attributes[kSecAttrAccessible as String] = resolved.accessible
      }
      attributes[kSecAttrGeneric as String] = try encoder.encode(PersistedMetadata(metadata: metadata))

      deleteExisting(query: query)
      var status = SecItemAdd(attributes as CFDictionary, nil)
      if status == errSecSuccess {
        return MutationResult(metadata: metadata)
      }

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
        fallbackAttributes[kSecAttrGeneric as String] = try encoder.encode(PersistedMetadata(metadata: fallbackMetadata))

        status = SecItemAdd(fallbackAttributes as CFDictionary, nil)
        if status == errSecSuccess {
          return MutationResult(metadata: fallbackMetadata)
        }
      }

      throw runtimeError(for: status, operation: "set")
    }
  }

  /// Fetches a single item and optionally includes the plaintext value if the client requested it.
  public func getItem(request: SensitiveInfoGetRequest) throws -> Promise<Variant_NullType_SensitiveInfoItem> {
    Promise.parallel(workQueue) { [self] in
      let service = normalizedService(request.service)
      let includeValue = request.includeValue ?? true

      var query = makeBaseQuery(
        key: request.key,
        service: service,
        synchronizable: request.iosSynchronizable,
        accessGroup: request.keychainGroup
      )
      query[kSecMatchLimit as String] = kSecMatchLimitOne
      query[kSecReturnAttributes as String] = kCFBooleanTrue
      if includeValue {
        query[kSecReturnData as String] = kCFBooleanTrue
      }

      guard let raw = try copyMatching(query: query, prompt: request.authenticationPrompt) as? NSDictionary else {
        return Variant_NullType_SensitiveInfoItem.first(NullType.null)
      }

      let item = try makeItem(from: raw, includeValue: includeValue)
      return Variant_NullType_SensitiveInfoItem.second(item)
    }
  }

  /// Removes a specific key/service pair from the Keychain.
  public func deleteItem(request: SensitiveInfoDeleteRequest) throws -> Promise<Bool> {
    Promise.parallel(workQueue) { [self] in
      let service = normalizedService(request.service)
      let query = makeBaseQuery(
        key: request.key,
        service: service,
        synchronizable: request.iosSynchronizable,
        accessGroup: request.keychainGroup
      )

      let status = SecItemDelete(query as CFDictionary)
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
  public func hasItem(request: SensitiveInfoHasRequest) throws -> Promise<Bool> {
    Promise.parallel(workQueue) { [self] in
      let service = normalizedService(request.service)
      var query = makeBaseQuery(
        key: request.key,
        service: service,
        synchronizable: request.iosSynchronizable,
        accessGroup: request.keychainGroup
      )
      query[kSecMatchLimit as String] = kSecMatchLimitOne
      query[kSecReturnAttributes as String] = kCFBooleanTrue

      let result = try copyMatching(query: query, prompt: request.authenticationPrompt)
      return result != nil
    }
  }

  /// Enumerates every item matching the provided service and inclusion options.
  ///
  /// ```ts
  /// const items = await SensitiveInfo.getAllItems({ service: 'vault', includeValues: true })
  /// ```
  public func getAllItems(request: SensitiveInfoEnumerateRequest?) throws -> Promise<[SensitiveInfoItem]> {
    Promise.parallel(workQueue) { [self] in
      let includeValues = request?.includeValues ?? false
      let service = normalizedService(request?.service)

      var query = makeBaseQuery(
        key: nil,
        service: service,
        synchronizable: request?.iosSynchronizable,
        accessGroup: request?.keychainGroup
      )
      query[kSecMatchLimit as String] = kSecMatchLimitAll
      query[kSecReturnAttributes as String] = kCFBooleanTrue
      if includeValues {
        query[kSecReturnData as String] = kCFBooleanTrue
      }

      let result = try copyMatching(query: query, prompt: request?.authenticationPrompt)
      guard let array = result as? [NSDictionary] else {
        return []
      }

      return try array.compactMap { dict in
        try makeItem(from: dict, includeValue: includeValues)
      }
    }
  }

  /// Deletes all items for the requested service.
  public func clearService(request: SensitiveInfoOptions?) throws -> Promise<Void> {
    Promise.parallel(workQueue) { [self] in
      let service = normalizedService(request?.service)
      let query = makeBaseQuery(
        key: nil,
        service: service,
        synchronizable: request?.iosSynchronizable,
        accessGroup: request?.keychainGroup
      )

      let status = SecItemDelete(query as CFDictionary)
      switch status {
      case errSecSuccess, errSecItemNotFound:
        return ()
      default:
        throw runtimeError(for: status, operation: "clearService")
      }
    }
  }

  public func getSupportedSecurityLevels() throws -> Promise<SecurityAvailability> {
    Promise.resolved(withResult: resolveAvailability())
  }

  // MARK: - Keychain helpers

  private func makeBaseQuery(
    key: String?,
    service: String,
    synchronizable: Bool?,
    accessGroup: String?
  ) -> [String: Any] {
    var query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service
    ]

    if let account = key {
      query[kSecAttrAccount as String] = account
    }

    if synchronizable == true {
      query[kSecAttrSynchronizable as String] = kCFBooleanTrue
    }

    if let group = accessGroup {
      query[kSecAttrAccessGroup as String] = group
    }

    return query
  }

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
      throw RuntimeError.error(withMessage: "Unexpected keychain payload shape")
    }

    let metadata = decodeMetadata(from: dictionary) ?? StorageMetadata(
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

  private func decodeMetadata(from dictionary: NSDictionary) -> StorageMetadata? {
    guard let raw = dictionary[kSecAttrGeneric as String] as? Data else {
      return nil
    }

    do {
      let payload = try decoder.decode(PersistedMetadata.self, from: raw)
      return payload.toStorageMetadata()
    } catch {
      return nil
    }
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
