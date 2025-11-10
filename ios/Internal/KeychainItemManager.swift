import Foundation
import LocalAuthentication
import NitroModules
import Security

/// Concrete implementation of ItemManager using Apple Keychain.
///
/// Handles all item CRUD operations with proper encryption, metadata management,
/// and authentication prompts. Follows Single Responsibility Principle by focusing
/// exclusively on item storage and retrieval operations.
///
/// Key responsibilities:
/// - Item encryption and decryption
/// - Keychain query building and execution
/// - Metadata encoding and decoding
/// - Access control resolution
/// - Authentication prompt handling
///
/// @since 6.0.0
final class KeychainItemManager: ItemManager {
  private let dependencies: Dependencies

  // MARK: - Initialization

  init(dependencies: Dependencies) {
    self.dependencies = dependencies
  }

  // MARK: - ItemManager Implementation

  func getItem(request: SensitiveInfoGetRequest) -> Promise<SensitiveInfoItem?> {
    Promise.async(dependencies.workQueue) { [self] in
      try dependencies.validator.validateKey(request.key)

      let service = normalizedService(request.service)
      let includeValue = request.includeValue ?? true

      var query = dependencies.queryBuilder.makeBaseQuery(
        key: request.key,
        service: service,
        synchronizable: request.iosSynchronizable ?? false
      )

      if let group = request.keychainGroup {
        query[kSecAttrAccessGroup as String] = group
      }

      query[kSecMatchLimit as String] = kSecMatchLimitOne
      query[kSecReturnAttributes as String] = kCFBooleanTrue

      if includeValue {
        query[kSecReturnData as String] = kCFBooleanTrue
      }

      guard let raw = try copyMatching(
        query: query,
        prompt: request.authenticationPrompt
      ) as? NSDictionary else {
        return nil
      }

      return try makeItem(from: raw, includeValue: includeValue)
    }
  }

  func setItem(request: SensitiveInfoSetRequest) -> Promise<MutationResult> {
    Promise.async(dependencies.workQueue) { [self] in
      try dependencies.validator.validateKey(request.key)
      try dependencies.validator.validateValue(request.value)

      let service = normalizedService(request.service)
      let resolved = try dependencies.accessControlManager.resolveAccessControl(
        preferred: request.accessControl
      )

      let alias = UUID().uuidString
      let keyData = try dependencies.cryptoService.createOrRetrieveEncryptionKey(
        alias: alias,
        accessControl: resolved.secAccessControl
      )

      let encryptedValue = try dependencies.cryptoService.encryptData(
        Data(request.value.utf8),
        withKey: keyData
      )

      let metadata = StorageMetadata(
        securityLevel: resolved.securityLevel,
        backend: .keychain,
        accessControl: resolved.accessControl,
        timestamp: Date().timeIntervalSince1970,
        alias: alias
      )

      var query = dependencies.queryBuilder.makeBaseQuery(
        key: request.key,
        service: service,
        synchronizable: request.iosSynchronizable ?? false
      )

      if let group = request.keychainGroup {
        query[kSecAttrAccessGroup as String] = group
      }

      var attributes = query
      attributes[kSecValueData as String] = encryptedValue

      if let accessControlRef = resolved.secAccessControl {
        attributes[kSecAttrAccessControl as String] = accessControlRef
      } else {
        attributes[kSecAttrAccessible as String] = resolved.accessible
      }

      attributes[kSecAttrGeneric as String] = try dependencies.metadataManager.encodeMetadata(
        metadata
      )

      deleteExisting(query: query)

      var status = SecItemAdd(attributes as CFDictionary, nil)

      if status == errSecParam, resolved.secAccessControl != nil {
        let fallbackMetadata = StorageMetadata(
          securityLevel: .software,
          backend: .keychain,
          accessControl: .standard,
          timestamp: Date().timeIntervalSince1970,
          alias: alias
        )

        var fallbackAttributes = query
        fallbackAttributes[kSecValueData as String] = encryptedValue
        fallbackAttributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlocked
        fallbackAttributes[kSecAttrGeneric as String] = try dependencies.metadataManager
          .encodeMetadata(fallbackMetadata)

        status = SecItemAdd(fallbackAttributes as CFDictionary, nil)

        return MutationResult(key: request.key, service: service, metadata: fallbackMetadata)
      }

      guard status == errSecSuccess || status == errSecDuplicateItem else {
        throw RuntimeError.error(withMessage: "Failed to store item: \(status)")
      }

      return MutationResult(key: request.key, service: service, metadata: metadata)
    }
  }

  func deleteItem(request: SensitiveInfoDeleteRequest) -> Promise<Bool> {
    Promise.async(dependencies.workQueue) { [self] in
      try dependencies.validator.validateKey(request.key)

      let service = normalizedService(request.service)

      var query = dependencies.queryBuilder.makeBaseQuery(
        key: request.key,
        service: service,
        synchronizable: request.iosSynchronizable ?? false
      )

      if let group = request.keychainGroup {
        query[kSecAttrAccessGroup as String] = group
      }

      let status = SecItemDelete(query as CFDictionary)

      guard status == errSecSuccess || status == errSecItemNotFound else {
        throw RuntimeError.error(withMessage: "Failed to delete item: \(status)")
      }

      return status == errSecSuccess
    }
  }

  func hasItem(request: SensitiveInfoHasRequest) -> Promise<Bool> {
    Promise.async(dependencies.workQueue) { [self] in
      try dependencies.validator.validateKey(request.key)

      let service = normalizedService(request.service)

      var query = dependencies.queryBuilder.makeBaseQuery(
        key: request.key,
        service: service,
        synchronizable: request.iosSynchronizable ?? false
      )

      if let group = request.keychainGroup {
        query[kSecAttrAccessGroup as String] = group
      }

      query[kSecMatchLimit as String] = kSecMatchLimitOne

      let status = SecItemCopyMatching(query as CFDictionary, nil)
      return status == errSecSuccess
    }
  }

  func getAllItems(request: SensitiveInfoEnumerateRequest?) -> Promise<[SensitiveInfoItem]> {
    Promise.async(dependencies.workQueue) { [self] in
      let service = normalizedService(request?.service)
      let includeValues = request?.includeValues ?? false

      var query = dependencies.queryBuilder.makeBaseQuery(
        key: nil,
        service: service,
        synchronizable: request?.iosSynchronizable ?? false
      )

      if let group = request?.keychainGroup {
        query[kSecAttrAccessGroup as String] = group
      }

      query[kSecMatchLimit as String] = kSecMatchLimitAll
      query[kSecReturnAttributes as String] = kCFBooleanTrue

      if includeValues {
        query[kSecReturnData as String] = kCFBooleanTrue
      }

      var result: CFTypeRef?
      let status = SecItemCopyMatching(query as CFDictionary, &result)

      guard status == errSecSuccess else {
        if status == errSecItemNotFound {
          return []
        }
        throw RuntimeError.error(withMessage: "Failed to enumerate items: \(status)")
      }

      guard let items = result as? [NSDictionary] else {
        return []
      }

      return try items.compactMap { dict in
        try makeItem(from: dict, includeValue: includeValues)
      }
    }
  }

  func clearService(request: SensitiveInfoOptions?) -> Promise<Void> {
    Promise.async(dependencies.workQueue) { [self] in
      let service = normalizedService(request?.service)

      var query = dependencies.queryBuilder.makeBaseQuery(
        key: nil,
        service: service,
        synchronizable: request?.iosSynchronizable ?? false
      )

      if let group = request?.keychainGroup {
        query[kSecAttrAccessGroup as String] = group
      }

      let status = SecItemDelete(query as CFDictionary)

      guard status == errSecSuccess || status == errSecItemNotFound else {
        throw RuntimeError.error(withMessage: "Failed to clear service: \(status)")
      }

      return ()
    }
  }

  // MARK: - Private Helpers

  private func normalizedService(_ service: String?) -> String {
    guard let service = service, !service.isEmpty else {
      return Bundle.main.bundleIdentifier ?? "default"
    }
    return service
  }

  private func copyMatching(
    query: [String: Any],
    prompt: AuthenticationPrompt?
  ) throws -> AnyObject? {
    var mutableQuery = query

    if let prompt = prompt {
      let context = dependencies.authenticationManager.makeLAContext(prompt: prompt)
      mutableQuery[kSecUseAuthenticationContext as String] = context
    }

    var result: CFTypeRef?
    let status = SecItemCopyMatching(mutableQuery as CFDictionary, &result)

    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw RuntimeError.error(withMessage: "Keychain query failed: \(status)")
    }

    return result as AnyObject?
  }

  private func deleteExisting(query: [String: Any]) {
    SecItemDelete(query as CFDictionary)
  }

  private func makeItem(
    from dict: NSDictionary,
    includeValue: Bool
  ) throws -> SensitiveInfoItem? {
    guard let account = dict[kSecAttrAccount as String] as? String else {
      return nil
    }

    let value: String? = if includeValue,
      let data = dict[kSecValueData as String] as? Data {
      String(data: data, encoding: .utf8)
    } else {
      nil
    }

    let metadata: StorageMetadata = if let metadataData = dict[kSecAttrGeneric as String] as? Data {
      try dependencies.metadataManager.decodeMetadata(metadataData) ?? defaultMetadata()
    } else {
      defaultMetadata()
    }

    return SensitiveInfoItem(
      value: value,
      metadata: metadata
    )
  }

  private func defaultMetadata() -> StorageMetadata {
    StorageMetadata(
      securityLevel: .software,
      backend: .keychain,
      accessControl: .standard,
      timestamp: Date().timeIntervalSince1970,
      alias: nil
    )
  }
}
