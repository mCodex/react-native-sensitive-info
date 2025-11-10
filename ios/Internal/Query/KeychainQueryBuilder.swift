import Foundation
import Security

/**
 * Builds Keychain queries in a reusable, testable manner.
 *
 * Responsibilities:
 * - Construct base queries with service/key/synchronization settings
 * - Apply access control attributes
 * - Format query predicates consistently
 * - Support query modification for different operation types
 *
 * Separating query building from execution allows:
 * - Easy unit testing of query structure
 * - Query reuse across multiple methods
 * - Simpler mocking in tests
 * - Clear separation of concerns
 *
 * @since 6.0.0
 */
struct KeychainQueryBuilder {
  private let defaultService: String
  private let keychainGroup: String?

  /**
   * Initializes the query builder with service configuration.
   *
   * @param defaultService The default service to use if none specified (usually app bundle ID)
   * @param keychainGroup Optional keychain group for app extensions
   */
  init(
    defaultService: String = Bundle.main.bundleIdentifier ?? "default",
    keychainGroup: String? = nil
  ) {
    self.defaultService = defaultService
    self.keychainGroup = keychainGroup
  }

  /**
   * Builds a base query for the given key and service.
   *
   * This is the foundation for all other queries. It includes:
   * - Item class (generic password)
   * - Account (the key)
   * - Service identifier
   * - Keychain group (if configured)
   * - Synchronization settings
   *
   * @param key The Keychain key (account)
   * @param service The Keychain service (defaults to app bundle ID)
   * @param synchronizable Whether to sync via iCloud Keychain
   * @param accessGroup Optional keychain group for sharing across apps
   * @return Dictionary ready to use with SecItem functions
   *
   * @example
   * ```swift
   * let builder = KeychainQueryBuilder()
   * let query = builder.makeBaseQuery(
   *   key: "refreshToken",
   *   service: "com.example.auth"
   * )
   * ```
   */
  func makeBaseQuery(
    key: String?,
    service: String?,
    synchronizable: Bool = false,
    accessGroup: String? = nil
  ) -> [String: Any] {
    var query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
    ]

    if let key = key {
      query[kSecAttrAccount as String] = key
    }

    let finalService = service ?? defaultService
    if !finalService.isEmpty {
      query[kSecAttrService as String] = finalService
    }

    if synchronizable {
      query[kSecAttrSynchronizable as String] = kCFBooleanTrue
    }

    if let group = accessGroup ?? keychainGroup {
      query[kSecAttrAccessGroup as String] = group
    }

    return query
  }

  /**
   * Adds retrieval parameters to a query for fetch operations.
   *
   * Configures what data SecItemCopyMatching should return.
   *
   * @param query The base query to modify (mutated in-place)
   * @param returnData Whether to return the data value
   * @param returnAttributes Whether to return other attributes (metadata)
   *
   * @example
   * ```swift
   * var query = builder.makeBaseQuery(key: "token", service: "auth")
   * builder.addRetrievalParameters(to: &query, returnData: true, returnAttributes: true)
   * // Query now has kSecReturnData and kSecReturnAttributes set
   * ```
   */
  func addRetrievalParameters(
    to query: inout [String: Any],
    returnData: Bool = true,
    returnAttributes: Bool = true
  ) {
    if returnData {
      query[kSecReturnData as String] = kCFBooleanTrue
    }
    if returnAttributes {
      query[kSecReturnAttributes as String] = kCFBooleanTrue
    }
  }

  /**
   * Adds access control to a query.
   *
   * The access control determines what authentication is required
   * to access the stored data.
   *
   * @param query The query to modify (mutated in-place)
   * @param accessControl The SecAccessControl reference (nil to skip)
   *
   * @example
   * ```swift
   * var query = builder.makeBaseQuery(...)
   * if let acl = try createSecureEnclaveControl() {
   *   builder.addAccessControl(to: &query, acl)
   * }
   * ```
   */
  func addAccessControl(
    to query: inout [String: Any],
    _ accessControl: SecAccessControl?
  ) {
    if let control = accessControl {
      query[kSecAttrAccessControl as String] = control
    }
  }

  /**
   * Adds alternative accessibility level to a query.
   *
   * Used when access control is not applicable (software-only security).
   *
   * @param query The query to modify (mutated in-place)
   * @param accessible The accessibility level
   */
  func addAccessibility(
    to query: inout [String: Any],
    _ accessible: CFString
  ) {
    query[kSecAttrAccessible as String] = accessible
  }

  /**
   * Adds data to a query for write operations.
   *
   * @param query The query to modify (mutated in-place)
   * @param data The data to store
   *
   * @example
   * ```swift
   * var query = builder.makeBaseQuery(...)
   * let data = "secret".data(using: .utf8)!
   * builder.addData(to: &query, data)
   * ```
   */
  func addData(to query: inout [String: Any], _ data: Data) {
    query[kSecValueData as String] = data
  }

  /**
   * Adds generic attribute for metadata storage.
   *
   * The generic attribute is used to store JSON-encoded metadata
   * about the stored item (security level, access control, timestamp).
   *
   * @param query The query to modify (mutated in-place)
   * @param metadata The metadata Data to store
   */
  func addMetadata(to query: inout [String: Any], _ metadata: Data) {
    query[kSecAttrGeneric as String] = metadata
  }

  /**
   * Creates a query for deletion operations.
   *
   * Removes only the matching item(s), not attributes.
   *
   * @param query The base query to use
   * @return Query configured for deletion
   *
   * @example
   * ```swift
   * let baseQuery = builder.makeBaseQuery(key: "token", service: "auth")
   * let deleteQuery = builder.makeDeleteQuery(baseQuery)
   * SecItemDelete(deleteQuery as CFDictionary)
   * ```
   */
  func makeDeleteQuery(_ baseQuery: [String: Any]) -> [String: Any] {
    // Delete query is identical to base query - no special parameters needed
    baseQuery
  }

  /**
   * Creates a query for counting operations.
   *
   * Returns the number of matching items without returning the data.
   *
   * @param baseQuery The base query
   * @return Query configured for counting
   */
  func makeCountQuery(_ baseQuery: [String: Any]) -> [String: Any] {
    var query = baseQuery
    query[kSecMatchLimit as String] = kSecMatchLimitAll
    return query
  }
}
