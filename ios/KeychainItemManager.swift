import Foundation
import Security
import CommonCrypto

/// Manages Keychain item operations: reading, writing, and deleting items.
///
/// This class abstracts all low-level Keychain API interactions, providing a clean interface
/// for storing and retrieving encrypted sensitive data. It handles:
/// - Keychain query construction
/// - Item encryption/decryption
/// - Metadata encoding/decoding
/// - Access control resolution
///
/// Example:
/// ```swift
/// let manager = KeychainItemManager(
///   queryBuilder: queryBuilder,
///   metadataHandler: metadataHandler
/// )
///
/// let item = try manager.getItem(
///   key: "token",
///   service: "auth",
///   options: options
/// )
/// ```
///
/// @since 6.0.0
final class KeychainItemManager {
  private let queryBuilder: KeychainQueryBuilder
  private let metadataHandler: StorageMetadataHandler
  private let cryptoService: CryptoService
  private let workQueue: DispatchQueue

  /// Initialize the Keychain item manager.
  ///
  /// - Parameters:
  ///   - queryBuilder: Constructs Keychain queries
  ///   - metadataHandler: Encodes/decodes metadata
  ///   - cryptoService: Handles encryption/decryption
  ///   - workQueue: Dispatch queue for Keychain operations
  init(
    queryBuilder: KeychainQueryBuilder,
    metadataHandler: StorageMetadataHandler,
    cryptoService: CryptoService,
    workQueue: DispatchQueue
  ) {
    self.queryBuilder = queryBuilder
    self.metadataHandler = metadataHandler
    self.cryptoService = cryptoService
    self.workQueue = workQueue
  }

  /// Retrieve an item from Keychain.
  ///
  /// Process:
  /// 1. Build Keychain query
  /// 2. Execute query synchronously
  /// 3. Decrypt value if present
  /// 4. Decode metadata
  /// 5. Return SensitiveInfoItem
  ///
  /// - Parameters:
  ///   - key: Storage key
  ///   - service: Service identifier
  ///   - options: Retrieval options (includeValue, etc.)
  ///   - group: Optional Keychain access group
  /// - Returns: Promise resolving to SensitiveInfoItem or null if not found
  /// - Throws: KeychainValidationError, CryptoError, or RuntimeError
  func getItem(
    key: String,
    service: String,
    options: SensitiveInfoOptions?,
    group: String? = nil
  ) -> Promise<SensitiveInfoItem?> {
    Promise.parallel(workQueue) { [self] in
      var query = queryBuilder.makeBaseQuery(key: key, service: service, synchronizable: options?.iosSynchronizable ?? false)
      if let group = group {
        query[kSecAttrAccessGroup as String] = group
      }
      query[kSecMatchLimit as String] = kSecMatchLimitOne
      query[kSecReturnData as String] = true
      query[kSecReturnAttributes as String] = true

      var result: CFTypeRef?
      let status = SecItemCopyMatching(query as CFDictionary, &result)

      guard status == errSecSuccess else {
        if status == errSecItemNotFound {
          return nil
        }
        throw RuntimeError.error(withMessage: "Failed to retrieve item: \(status)")
      }

      guard let dict = result as? [String: Any] else {
        throw RuntimeError.error(withMessage: "Invalid Keychain response")
      }

      let includeValue = options?.includeValue ?? true
      let timestamp = Date().timeIntervalSince1970

      if includeValue, let encryptedData = dict[kSecValueData as String] as? Data {
        let alias = dict[kSecAttrGeneric as String] as? Data
        let keyData = try cryptoService.retrieveEncryptionKey(alias: alias.flatMap { String(data: $0, encoding: .utf8) } ?? UUID().uuidString)
        let decryptedValue = try cryptoService.decryptData(encryptedData, withKey: keyData)
        let value = String(data: decryptedValue, encoding: .utf8) ?? ""

        var metadata = StorageMetadata(
          securityLevel: .unspecified,
          backend: .keychain,
          accessControl: .standard,
          timestamp: timestamp,
          alias: nil
        )

        if let metadataData = dict[kSecAttrGeneric as String] as? Data {
          metadata = try metadataHandler.decodeMetadata(metadataData)
        }

        return SensitiveInfoItem(value: value, metadata: metadata)
      } else {
        var metadata = StorageMetadata(
          securityLevel: .unspecified,
          backend: .keychain,
          accessControl: .standard,
          timestamp: timestamp,
          alias: nil
        )

        if let metadataData = dict[kSecAttrGeneric as String] as? Data {
          metadata = try metadataHandler.decodeMetadata(metadataData)
        }

        return SensitiveInfoItem(value: "", metadata: metadata)
      }
    }
  }

  /// Store or replace an item in Keychain.
  ///
  /// Process:
  /// 1. Generate encryption key and alias
  /// 2. Encrypt value
  /// 3. Build Keychain query and attributes
  /// 4. Delete existing item
  /// 5. Add new item
  /// 6. Handle failures by falling back to software-only policy
  ///
  /// - Parameters:
  ///   - key: Storage key
  ///   - value: Plaintext value to store
  ///   - service: Service identifier
  ///   - accessControl: Access control policy
  ///   - metadata: Item metadata
  ///   - group: Optional Keychain access group
  /// - Returns: Promise resolving to MutationResult with applied metadata
  /// - Throws: Keychain operation errors
  func setItem(
    key: String,
    value: String,
    service: String,
    accessControl: ResolvedAccessControl,
    metadata: StorageMetadata,
    group: String? = nil
  ) -> Promise<MutationResult> {
    Promise.parallel(workQueue) { [self] in
      let encryptedValue = try cryptoService.encryptData(Data(value.utf8), alias: metadata.alias ?? UUID().uuidString)

      var query = queryBuilder.makeBaseQuery(key: key, service: service, synchronizable: false)
      if let group = group {
        query[kSecAttrAccessGroup as String] = group
      }

      var attributes = query
      attributes[kSecValueData as String] = encryptedValue
      if let accessControlRef = accessControl.accessControlRef {
        attributes[kSecAttrAccessControl as String] = accessControlRef
      } else {
        attributes[kSecAttrAccessible as String] = accessControl.accessible
      }
      attributes[kSecAttrGeneric as String] = try metadataHandler.encodeMetadata(metadata)

      // Delete existing item first
      SecItemDelete(query as CFDictionary)

      // Add new item
      var status = SecItemAdd(attributes as CFDictionary, nil)

      // If hardware policy not available, fall back to software
      if status == errSecUnsupportedFormat {
        var fallbackAttributes = query
        fallbackAttributes[kSecValueData as String] = encryptedValue
        fallbackAttributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlocked
        fallbackAttributes[kSecAttrGeneric as String] = try metadataHandler.encodeMetadata(metadata)

        status = SecItemAdd(fallbackAttributes as CFDictionary, nil)
      }

      guard status == errSecSuccess || status == errSecDuplicateItem else {
        throw RuntimeError.error(withMessage: "Failed to store item: \(status)")
      }

      return MutationResult(
        key: key,
        service: service,
        metadata: metadata
      )
    }
  }

  /// Delete an item from Keychain.
  ///
  /// - Parameters:
  ///   - key: Storage key
  ///   - service: Service identifier
  ///   - group: Optional Keychain access group
  /// - Returns: Promise resolving to MutationResult
  /// - Throws: Keychain operation errors
  func deleteItem(
    key: String,
    service: String,
    group: String? = nil
  ) -> Promise<MutationResult> {
    Promise.parallel(workQueue) { [self] in
      var query = queryBuilder.makeBaseQuery(key: key, service: service, synchronizable: false)
      if let group = group {
        query[kSecAttrAccessGroup as String] = group
      }

      let status = SecItemDelete(query as CFDictionary)

      guard status == errSecSuccess || status == errSecItemNotFound else {
        throw RuntimeError.error(withMessage: "Failed to delete item: \(status)")
      }

      return MutationResult(
        key: key,
        service: service,
        metadata: StorageMetadata(
          securityLevel: .unspecified,
          backend: .keychain,
          accessControl: .standard,
          timestamp: Date().timeIntervalSince1970,
          alias: nil
        )
      )
    }
  }

  /// Check if an item exists in Keychain.
  ///
  /// - Parameters:
  ///   - key: Storage key
  ///   - service: Service identifier
  ///   - group: Optional Keychain access group
  /// - Returns: Promise resolving to boolean
  func hasItem(
    key: String,
    service: String,
    group: String? = nil
  ) -> Promise<Bool> {
    Promise.parallel(workQueue) { [self] in
      var query = queryBuilder.makeBaseQuery(key: key, service: service, synchronizable: false)
      if let group = group {
        query[kSecAttrAccessGroup as String] = group
      }
      query[kSecMatchLimit as String] = kSecMatchLimitOne

      let status = SecItemCopyMatching(query as CFDictionary, nil)
      return status == errSecSuccess
    }
  }
}
