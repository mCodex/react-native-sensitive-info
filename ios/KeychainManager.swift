import Security
import Foundation

/**
 * KeychainManager.swift
 *
 * Type-safe wrapper around iOS Keychain for secure storage.
 *
 * **Architecture**:
 * - Wraps Security framework Keychain API
 * - Provides modern Swift interface (Result, throws, async)
 * - Handles encoding/decoding of values
 * - Supports Secure Enclave (iOS 16+) and biometric access
 *
 * **Security Model**:
 * - Values encrypted by OS (even before Secure Enclave)
 * - Secure Enclave: Keys never leave hardware co-processor
 * - Biometric: Access control enforced by OS
 * - Device credential fallback always available
 *
 * **Query Structure**:
 * ```
 * [
 *   kSecClass: kSecClassGenericPassword,      // Type
 *   kSecAttrService: "myapp",                 // Namespace
 *   kSecAttrAccount: "auth-token",            // Key name
 *   kSecValueData: ...encrypted...,           // Value
 *   kSecAttrAccessControl: ...policy...,      // Access control
 *   kSecAttrAccessible: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
 * ]
 * ```
 *
 * @see Security framework documentation
 * @see https://developer.apple.com/documentation/security
 */
struct KeychainManager {

    let service: String

    // MARK: - Public API

    /**
     * Stores an encrypted value in Keychain.
     *
     * **Workflow**:
     * 1. Encode value to Data
     * 2. Create Keychain query with access control
     * 3. Optionally request Secure Enclave (iOS 16+)
     * 4. Store (or update if exists)
     *
     * - Parameter key: Unique key within service
     * - Parameter value: Value to store (encrypted by Keychain)
    * - Parameter accessControl: Access control policy (nil for software-only)
    * - Parameter useSecureEnclave: Requests Secure Enclave token (if available)
    * - Parameter metadata: Additional metadata stored alongside value
     * - Throws: KeychainError if operation fails
     *
     * # Example
     * ```swift
     * let keychain = KeychainManager(service: "myapp")
     *
     * try keychain.set(
     *     key: "auth-token",
     *     value: "jwt-token-xyz",
     *     accessControl: ...
     * )
     * ```
     */
    func set(
        key: String,
        value: String,
        accessControl: SecAccessControl?,
        useSecureEnclave: Bool,
        metadata: KeychainItemMetadata?
    ) throws {
        let valueData = value.data(using: .utf8) ?? Data()

        // Attempt to add first (handles access-control-only creation)
        var addQuery = baseQuery(for: key)
        addQuery[kSecValueData as String] = valueData
        addQuery[kSecUseDataProtectionKeychain as String] = true

        if let accessControl = accessControl {
            addQuery[kSecAttrAccessControl as String] = accessControl
        } else {
            addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        }

        if useSecureEnclave {
            addQuery[kSecAttrTokenID as String] = kSecAttrTokenIDSecureEnclave
        }

        if let encodedMetadata = metadata?.encoded() {
            addQuery[kSecAttrGeneric as String] = encodedMetadata
        }

        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)

        switch addStatus {
        case errSecSuccess:
            return

        case errSecDuplicateItem:
            // Update existing value (metadata + plaintext). Access control is immutable.
            var updateAttributes: [String: Any] = [
                kSecValueData as String: valueData
            ]

            if let encodedMetadata = metadata?.encoded() {
                updateAttributes[kSecAttrGeneric as String] = encodedMetadata
            }

            let updateStatus = SecItemUpdate(
                baseQuery(for: key) as CFDictionary,
                updateAttributes as CFDictionary
            )

            guard updateStatus == errSecSuccess else {
                throw KeychainError.updateFailed(updateStatus)
            }

        default:
            throw KeychainError.addFailed(addStatus)
        }
    }
    
    /**
     * Retrieves a value from Keychain.
     *
     * **Automatic Security**:
     * - Decryption happens in Keychain (hardware if available)
     * - If access control requires biometric, system prompts user
     * - Value never leaves Keychain in unencrypted form unless granted
     *
     * - Parameter key: Unique key within service
    * - Parameter prompt: Optional custom prompt text shown by Keychain
    * - Returns: Decrypted value + metadata, or nil if not found
     * - Throws: KeychainError if operation fails
     *
     * # Example
     * ```swift
     * let keychain = KeychainManager(service: "myapp")
     *
     * if let token = try keychain.get(key: "auth-token") {
     *     print("Token: \\(token)")
     * } else {
     *     print("Not found")
     * }
     * ```
     */
    func get(
        key: String,
        prompt: AuthenticationPrompt? = nil
    ) throws -> KeychainPayload? {
        var query = baseQuery(for: key)
        query[kSecReturnData as String] = true
        query[kSecReturnAttributes as String] = true
        query[kSecUseDataProtectionKeychain as String] = true

        if let prompt = prompt {
            query[kSecUseOperationPrompt as String] = prompt.localizedReason
        }

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        switch status {
        case errSecSuccess:
            break
        case errSecItemNotFound:
            return nil
        default:
            throw KeychainError.retrieveFailed(status)
        }

        guard
            let item = result as? [String: Any],
            let data = item[kSecValueData as String] as? Data,
            let value = String(data: data, encoding: .utf8)
        else {
            throw KeychainError.decodingFailed
        }

        let metadata: KeychainItemMetadata?
        if let metadataData = item[kSecAttrGeneric as String] as? Data {
            metadata = KeychainItemMetadata.decode(metadataData)
        } else {
            metadata = nil
        }

        return KeychainPayload(value: value, metadata: metadata)
    }
    
    /**
     * Checks if a key exists in Keychain.
     *
     * - Parameter key: Key to check
     * - Returns: true if key exists
     */
    func exists(key: String) -> Bool {
        let status = SecItemCopyMatching(baseQuery(for: key) as CFDictionary, nil)
        return status == errSecSuccess
    }
    
    /**
     * Deletes a key from Keychain.
     *
     * - Parameter key: Key to delete
     * - Throws: KeychainError if operation fails
     */
    func delete(key: String) throws {
        let status = SecItemDelete(baseQuery(for: key) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.deleteFailed(status)
        }
    }
    
    /**
     * Lists all keys in this service.
     *
     * - Returns: Array of key names
     */
    func allKeys() throws -> [String] {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecReturnAttributes as String: true,
            kSecMatchLimit as String: kSecMatchLimitAll
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess else {
            if status == errSecItemNotFound {
                return []
            }
            throw KeychainError.retrieveFailed(status)
        }
        
        guard let items = result as? [[String: Any]] else {
            return []
        }
        
        return items.compactMap { item in
            item[kSecAttrAccount as String] as? String
        }
    }
    
    /**
     * Deletes all items in this service.
     *
     * - Throws: KeychainError if operation fails
     */
    func deleteAll() throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service
        ]

        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.deleteFailed(status)
        }
    }

    // MARK: - Helpers

    private func baseQuery(for key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
    }
}

/**
 * Keychain-related errors.
 */
enum KeychainError: Error {
    case addFailed(OSStatus)
    case updateFailed(OSStatus)
    case retrieveFailed(OSStatus)
    case deleteFailed(OSStatus)
    case invalidData
    case decodingFailed
    
    var localizedDescription: String {
        switch self {
        case .addFailed(let status):
            return "Failed to add to Keychain: \(status)"
        case .updateFailed(let status):
            return "Failed to update Keychain: \(status)"
        case .retrieveFailed(let status):
            return "Failed to retrieve from Keychain: \(status)"
        case .deleteFailed(let status):
            return "Failed to delete from Keychain: \(status)"
        case .invalidData:
            return "Invalid data in Keychain"
        case .decodingFailed:
            return "Failed to decode Keychain data"
        }
    }
}

/// Value returned from Keychain lookups including metadata.
struct KeychainPayload {
    let value: String
    let metadata: KeychainItemMetadata?
}
