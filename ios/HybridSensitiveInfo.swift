import Foundation
import LocalAuthentication
import NitroModules
import Security

private struct PersistedMetadata: Codable {
  let securityLevel: String
  let backend: String
  let accessControl: String
  let timestamp: Double

  init(metadata: StorageMetadata) {
    securityLevel = metadata.securityLevel.stringValue
    backend = metadata.backend.stringValue
    accessControl = metadata.accessControl.stringValue
    timestamp = metadata.timestamp
  }

  func toStorageMetadata() -> StorageMetadata? {
    guard
      let level = SecurityLevel(fromString: securityLevel),
      let backend = StorageBackend(fromString: backend),
      let access = AccessControl(fromString: accessControl)
    else {
      return nil
    }
    return StorageMetadata(securityLevel: level, backend: backend, accessControl: access, timestamp: timestamp)
  }
}

private struct ResolvedAccessControl {
  let accessControl: AccessControl
  let securityLevel: SecurityLevel
  let accessible: CFString
  let accessControlRef: SecAccessControl?
}

final class HybridSensitiveInfo: HybridSensitiveInfoSpec {
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

  override func setItem(request: SensitiveInfoSetRequest) throws -> Promise<MutationResult> {
    Promise.parallel { [self] in
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
      attributes[kSecAttrAccessible as String] = resolved.accessible
      if let accessControlRef = resolved.accessControlRef {
        attributes[kSecAttrAccessControl as String] = accessControlRef
      }
      attributes[kSecAttrGeneric as String] = try encoder.encode(PersistedMetadata(metadata: metadata))

      deleteExisting(query: query)
      try addItem(attributes: attributes)

      return MutationResult(metadata: metadata)
    }
  }

  override func getItem(request: SensitiveInfoGetRequest) throws -> Promise<SensitiveInfoItem?> {
    Promise.parallel { [self] in
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

      guard let raw = try copyMatching(query: query, prompt: request.authenticationPrompt) else {
        return nil
      }

      return try makeItem(from: raw, includeValue: includeValue)
    }
  }

  override func deleteItem(request: SensitiveInfoDeleteRequest) throws -> Promise<Bool> {
    Promise.parallel { [self] in
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

  override func hasItem(request: SensitiveInfoHasRequest) throws -> Promise<Bool> {
    Promise.parallel { [self] in
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

  override func getAllItems(request: SensitiveInfoEnumerateRequest?) throws -> Promise<[SensitiveInfoItem]> {
    Promise.parallel { [self] in
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

  override func clearService(request: SensitiveInfoOptions?) throws -> Promise<Void> {
    Promise.parallel { [self] in
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

  override func getSupportedSecurityLevels() throws -> Promise<SecurityAvailability> {
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

  private func addItem(attributes: [String: Any]) throws {
    let status = SecItemAdd(attributes as CFDictionary, nil)
    guard status == errSecSuccess else {
      throw runtimeError(for: status, operation: "set")
    }
  }

  private func copyMatching(query: [String: Any], prompt: AuthenticationPrompt?) throws -> AnyObject? {
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
      } else if let cfData = dictionary[kSecValueData as String] as? CFData {
        value = String(data: cfData as Data, encoding: .utf8)
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
    let message = SecCopyErrorMessageString(status, nil) as String? ?? "OSStatus(\(status))"
    return RuntimeError.error(withMessage: "Keychain \(operation) failed: \(message)")
  }
}
