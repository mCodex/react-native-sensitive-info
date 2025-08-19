import Foundation
import Security
import LocalAuthentication
import SwiftUI
import NitroModules

#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

// MARK: - Extensions for SecurityLevel

public extension SecurityLevel {
    /// Human-readable label for UI/debugging.
    var displayName: String {
        switch self {
        case .standard:
            return "Standard Keychain"
        case .biometric:
            return "Biometric Protected"
        case .strongbox:
            return "Secure Enclave"
        }
    }
    
    @available(iOS 13.0, macOS 10.15, *)
    /// Suggested UI color for this level (SwiftUI only).
    var color: Color {
        switch self {
        case .standard:
            return .blue
        case .biometric:
            return .orange
        case .strongbox:
            return .green
        }
    }
    
    /// Get the next fallback level
    /// The next security level to try when the current one fails or is unavailable.
    var fallbackLevel: SecurityLevel? {
        switch self {
        case .strongbox:
            return .biometric
        case .biometric:
            return .standard
        case .standard:
            return nil
        }
    }
}

// MARK: - Error Handling

/// Simplified error types
/// Errors thrown by SensitiveInfo
public enum SensitiveInfoError: Error, LocalizedError {
    case keychainError(OSStatus, String)
    case biometricNotAvailable
    case operationFailed(String)
    
    public var errorDescription: String? {
        switch self {
        case .keychainError(let status, let context):
            return "Keychain error (\(status)) in \(context)"
        case .biometricNotAvailable:
            return "Biometric authentication is not available on this device"
        case .operationFailed(let message):
            return message
        }
    }
    
    /// Create error from OSStatus
    static func fromOSStatus(_ status: OSStatus, context: String) -> SensitiveInfoError {
        return .keychainError(status, context)
    }
}

// MARK: - Core Keychain Manager

/// Simplified keychain manager with automatic fallback
/// Utility for building queries and executing operations with fallbacks.
class KeychainManager {
    
    /// Execute keychain operation with automatic fallback
    /// Execute a keychain operation at a requested level with automatic fallback to lower levels.
    static func executeWithFallback<T>(
        key: String,
        options: StorageOptions?,
        operation: (SecurityLevel, [String: Any]) -> Result<T, Error>
    ) -> Result<T, Error> {
        let targetLevel = options?.securityLevel ?? .standard
        
        // Try the requested security level first
        let query = buildQuery(for: key, securityLevel: targetLevel, options: options)
        let result = operation(targetLevel, query)
        
        switch result {
        case .success(let value):
            return .success(value)
        case .failure(let error):
            // Check if we should attempt fallback
            if shouldFallback(from: targetLevel, error: error) {
                if let fallbackLevel = targetLevel.fallbackLevel {
                    print("⚠️ SensitiveInfo: Falling back from \(targetLevel.rawValue) to \(fallbackLevel.rawValue)")
                    let fallbackQuery = buildQuery(for: key, securityLevel: fallbackLevel, options: options)
                    return operation(fallbackLevel, fallbackQuery)
                }
            }
            return .failure(error)
        }
    }
    
    /// Determine if we should fallback based on the error
    /// Decide when to fall back to a lower security level based on common OSStatus codes.
    private static func shouldFallback(from level: SecurityLevel, error: Error) -> Bool {
        if let nsError = error as NSError? {
            let code = nsError.code
            // Fallback on common keychain errors that indicate the security level isn't available
            return code == errSecParam || // -50: Invalid parameter (common on simulator)
                   code == errSecItemNotFound || // Item not found (might exist at different security level)
                   code == -128 || // errSecUserCancel: User cancelled biometric
                   code == errSecAuthFailed || // Authentication failed
                   code == errSecNotAvailable // Feature not available
        }
        return level != .standard // Always allow fallback unless already at standard
    }
    
    /// Build keychain query without specifying an account (for all items)
    static func buildQuery(securityLevel: SecurityLevel, options: StorageOptions?) -> [String: Any] {
        return buildQuery(for: nil, securityLevel: securityLevel, options: options)
    }
    /// Build keychain query for the specified security level and account key
    /// Build a keychain query for an optional account key at a given level.
    static func buildQuery(for key: String?, securityLevel: SecurityLevel, options: StorageOptions?) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "ReactNativeSensitiveInfo",
        ]
        
        // Only add account if key is provided and not empty (for specific item operations)
        if let key = key, !key.isEmpty {
            query[kSecAttrAccount as String] = key
        }
        
        // Use the provided security level (either from options or directly passed)
        let effectiveSecurityLevel = options?.securityLevel ?? securityLevel
        
        // Apply security level specific settings
        switch effectiveSecurityLevel {
        case .standard:
            // Basic keychain storage, no special flags needed
            break
            
        case .biometric:
            #if targetEnvironment(simulator)
            // On simulator, biometric isn't fully supported, so use standard
            print("⚠️ SensitiveInfo: Biometric not fully supported on simulator, using standard keychain")
            #else
            if #available(iOS 11.3, *) {
                var error: Unmanaged<CFError>?
                query[kSecAttrAccessControl as String] = SecAccessControlCreateWithFlags(
                    kCFAllocatorDefault,
                    kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                    [.biometryAny],
                    &error
                )
            }
            #endif
            
        case .strongbox:
            #if targetEnvironment(simulator)
            // Strongbox not available on simulator
            print("⚠️ SensitiveInfo: Strongbox not available on simulator, using standard keychain")
            #else
            if #available(iOS 13.0, *) {
                var error: Unmanaged<CFError>?
                query[kSecAttrAccessControl as String] = SecAccessControlCreateWithFlags(
                    kCFAllocatorDefault,
                    kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                    [.privateKeyUsage],
                    &error
                )
                query[kSecAttrTokenID as String] = kSecAttrTokenIDSecureEnclave
            }
            #endif
        }
        
        return query
    }
}

// MARK: - Main Implementation

/// Internal implementation that directly talks to Keychain APIs.
fileprivate class SensitiveInfoCore {
    
    /// Core implementation initializer
    init() {}
    
    // MARK: - Core Operations
    
    /// Store an item with automatic fallback
    public func setItem(key: String, value: String, options: StorageOptions?) throws {
        let result = KeychainManager.executeWithFallback(key: key, options: options) { level, query in
            var mutableQuery = query
            mutableQuery[kSecValueData as String] = value.data(using: .utf8)
            
            var resultRef: CFTypeRef?
            let status = SecItemAdd(mutableQuery as CFDictionary, &resultRef)
            if status == errSecDuplicateItem {
                // Item exists, update it
                let updateQuery: [String: Any] = [kSecValueData as String: value.data(using: .utf8)!]
                let updateStatus = SecItemUpdate(query as CFDictionary, updateQuery as CFDictionary)
                if updateStatus == errSecSuccess {
                    return .success(())
                } else {
                    return .failure(SensitiveInfoError.fromOSStatus(updateStatus, context: "updating item"))
                }
            } else if status == errSecSuccess {
                return .success(())
            } else {
                return .failure(SensitiveInfoError.fromOSStatus(status, context: "storing item"))
            }
        }
        
        switch result {
        case .success:
            break
        case .failure(let error):
            throw error
        }
    }
    
    /// Get an item with automatic fallback
    public func getItem(key: String, options: StorageOptions?) throws -> String? {
        let result = KeychainManager.executeWithFallback(key: key, options: options) { level, query in
            var mutableQuery = query
            mutableQuery[kSecReturnData as String] = true
            mutableQuery[kSecMatchLimit as String] = kSecMatchLimitOne
            
            var result: AnyObject?
            let status = SecItemCopyMatching(mutableQuery as CFDictionary, &result)
            
            if status == errSecSuccess {
                if let data = result as? Data,
                   let string = String(data: data, encoding: .utf8) {
                    // Wrap in String? to unify generic as String?
                    return .success(string as String?)
                } else {
                    return .failure(SensitiveInfoError.operationFailed("Invalid data format"))
                }
            } else if status == errSecItemNotFound {
                return .success(nil)
            } else {
                return .failure(SensitiveInfoError.fromOSStatus(status, context: "retrieving item"))
            }
        }
        
        switch result {
        case .success(let value):
            return value
        case .failure(let error):
            throw error
        }
    }
    
    /// Remove an item with automatic fallback
    public func removeItem(key: String, options: StorageOptions?) throws {
        let result = KeychainManager.executeWithFallback(key: key, options: options) { level, query in
            let status = SecItemDelete(query as CFDictionary)
            if status == errSecSuccess || status == errSecItemNotFound {
                return .success(())
            } else {
                return .failure(SensitiveInfoError.fromOSStatus(status, context: "removing item"))
            }
        }
        
        switch result {
        case .success:
            break
        case .failure(let error):
            throw error
        }
    }
    
    /// Get all items
    public func getAllItems(options: StorageOptions?) throws -> [String: String] {
        var allItems: [String: String] = [:]
        
        // Try all security levels to get all stored items
        let levels: [SecurityLevel] = [.standard, .biometric, .strongbox]
        
        for level in levels {
            let query = KeychainManager.buildQuery(securityLevel: level, options: nil)
            var mutableQuery = query
            mutableQuery[kSecReturnData as String] = true
            mutableQuery[kSecReturnAttributes as String] = true
            mutableQuery[kSecMatchLimit as String] = kSecMatchLimitAll
            
            var result: AnyObject?
            let status = SecItemCopyMatching(mutableQuery as CFDictionary, &result)
            
            if status == errSecSuccess {
                if let items = result as? [[String: Any]] {
                    for item in items {
                        if let account = item[kSecAttrAccount as String] as? String,
                           let data = item[kSecValueData as String] as? Data,
                           let value = String(data: data, encoding: .utf8) {
                            allItems[account] = value
                        }
                    }
                }
            }
        }
        
        return allItems
    }
    
    /// Clear all items
    public func clear(options: StorageOptions?) throws {
        let levels: [SecurityLevel] = [.standard, .biometric, .strongbox]
        
        for level in levels {
            let query = KeychainManager.buildQuery(securityLevel: level, options: nil)
            var mutableQuery = query
            
            SecItemDelete(mutableQuery as CFDictionary) // Ignore errors, some levels might not have items
        }
    }
    
    // MARK: - Capability Detection
    
    /// Check if biometric authentication is available
    public func isBiometricAvailable() -> Bool {
        #if targetEnvironment(simulator)
        return false // Biometric not fully supported on simulator
        #else
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        #endif
    }
    
    /// Check if Secure Enclave is available
    public func isStrongBoxAvailable() -> Bool {
        #if targetEnvironment(simulator)
        return false // Secure Enclave not available on simulator
        #else
        if #available(iOS 13.0, *) {
            return SecureEnclave.isAvailable
        }
        return false
        #endif
    }
}


// MARK: - Nitro Interface

public final class RNSensitiveInfo: HybridSensitiveInfoSpec_base, HybridSensitiveInfoSpec_protocol {
    private let implementation = SensitiveInfoCore()
    
    /// Module initializer
    public override init() {
        super.init()
    }

    /// Initialize module
    public var memorySize: Int {
        return MemoryLayout<RNSensitiveInfo>.size
    }
    
    // MARK: - Core Operations

    /// Retrieve a single item.
    /// - Parameters:
    ///   - key: The storage key.
    ///   - options: Optional storage/security options.
    /// - Returns: A Promise resolving to the stored string (or nil).
    public func getItem(key: String, options: StorageOptions?) throws -> Promise<String?> {
        return Promise.async { [unowned self] in
            try self.implementation.getItem(key: key, options: options)
        }
    }
    
    /// Store a single item.
    /// - Parameters:
    ///   - key: The storage key.
    ///   - value: The value to store.
    ///   - options: Optional storage/security options.
    public func setItem(key: String, value: String, options: StorageOptions?) throws -> Promise<Void> {
        return Promise.async { [unowned self] in
            try self.implementation.setItem(key: key, value: value, options: options)
        }
    }
    
    /// Remove a single item.
    /// - Parameters:
    ///   - key: The storage key.
    ///   - options: Optional storage/security options.
    public func removeItem(key: String, options: StorageOptions?) throws -> Promise<Void> {
        return Promise.async { [unowned self] in
            try self.implementation.removeItem(key: key, options: options)
        }
    }
    
    /// Retrieve all stored items as a dictionary.
    /// - Parameter options: Optional storage/security options.
    /// - Returns: A Promise resolving to a dictionary of key/value pairs.
    public func getAllItems(options: StorageOptions?) throws -> Promise<Dictionary<String, String>> {
        return Promise.async { [unowned self] in
            try self.implementation.getAllItems(options: options)
        }
    }
    
    /// Clear all items across all security levels.
    /// - Parameter options: Optional storage/security options.
    public func clear(options: StorageOptions?) throws -> Promise<Void> {
        return Promise.async { [unowned self] in
            try self.implementation.clear(options: options)
        }
    }
    
    // MARK: - Capability Detection

    /// Check whether biometric authentication is available on this device.
    public func isBiometricAvailable() throws -> Promise<Bool> {
        return Promise.async { [unowned self] in
            self.implementation.isBiometricAvailable()
        }
    }
    
    /// Check whether Secure Enclave (StrongBox equivalent) is available on this device.
    public func isStrongBoxAvailable() throws -> Promise<Bool> {
        return Promise.async { [unowned self] in
            self.implementation.isStrongBoxAvailable()
        }
    }
}
