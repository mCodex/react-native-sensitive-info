import Foundation
import Security
import LocalAuthentication

class SensitiveInfo: HybridSensitiveInfoSpec {
    
    private let standardService = "react-native-sensitive-info-standard"
    private let biometricService = "react-native-sensitive-info-biometric"
    private let strongboxService = "react-native-sensitive-info-strongbox"
    
    private func getService(for securityLevel: SecurityLevel?) -> String {
        guard let securityLevel = securityLevel else { return standardService }
        switch securityLevel {
        case .biometric:
            return biometricService
        case .strongbox:
            return strongboxService
        case .standard:
            return standardService
        }
    }
    
    private func getKeychainQuery(for key: String, service: String, securityLevel: SecurityLevel?) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        
        if securityLevel == .biometric {
            // Require biometric authentication for access
            query[kSecAttrAccessControl as String] = SecAccessControlCreateWithFlags(
                nil,
                kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                .biometryAny,
                nil
            )
        } else if securityLevel == .strongbox {
            // Use Secure Enclave if available (iOS 9.0+)
            if #available(iOS 9.0, *) {
                query[kSecAttrTokenID as String] = kSecAttrTokenIDSecureEnclave
                query[kSecAttrAccessControl as String] = SecAccessControlCreateWithFlags(
                    nil,
                    kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                    .privateKeyUsage,
                    nil
                )
            }
        }
        
        return query
    }
    
    private func setupAuthenticationContext(with options: StorageOptions?, operation: String) -> LAContext? {
        guard let options = options,
              let biometricOptions = options.biometricOptions else {
            return nil
        }
        
        let context = LAContext()
        let promptDescription = biometricOptions.promptDescription ?? "Authenticate to \(operation)"
        context.localizedReason = promptDescription
        
        return context
    }
    
    public func getItem(key: String, options: StorageOptions?) throws -> Promise<String?> {
        return Promise.async { () -> String? in
            let securityLevel = options?.securityLevel
            let service = self.getService(for: securityLevel)
            
            var query = self.getKeychainQuery(for: key, service: service, securityLevel: securityLevel)
            query[kSecReturnData as String] = true
            query[kSecMatchLimit as String] = kSecMatchLimitOne
            
            // Set up authentication context for biometric operations
            if securityLevel == .biometric, let context = self.setupAuthenticationContext(with: options, operation: "access \(key)") {
                query[kSecUseAuthenticationContext as String] = context
            }
            
            var item: CFTypeRef?
            let status = SecItemCopyMatching(query as CFDictionary, &item)
            
            guard status != errSecItemNotFound else { return nil }
            guard status == errSecSuccess,
                  let data = item as? Data,
                  let value = String(data: data, encoding: .utf8) else {
                throw NSError(domain: NSOSStatusErrorDomain, code: Int(status), userInfo: nil)
            }
            return value
        }
    }
    
    public func setItem(key: String, value: String, options: StorageOptions?) throws -> Promise<Void> {
        return Promise.async { () -> Void in
            let securityLevel = options?.securityLevel
            let service = self.getService(for: securityLevel)
            let data = value.data(using: .utf8)!
            
            var query = self.getKeychainQuery(for: key, service: service, securityLevel: securityLevel)
            
            // Set up authentication context for biometric operations
            if securityLevel == .biometric, let context = self.setupAuthenticationContext(with: options, operation: "store \(key)") {
                query[kSecUseAuthenticationContext as String] = context
            }
            
            // Check if item exists
            let status = SecItemCopyMatching(query as CFDictionary, nil)
            
            if status == errSecSuccess {
                // Update existing item
                let attributes: [String: Any] = [kSecValueData as String: data]
                let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
                guard updateStatus == errSecSuccess else {
                    throw NSError(domain: NSOSStatusErrorDomain, code: Int(updateStatus), userInfo: nil)
                }
            } else if status == errSecItemNotFound {
                // Add new item
                query[kSecValueData as String] = data
                let addStatus = SecItemAdd(query as CFDictionary, nil)
                guard addStatus == errSecSuccess else {
                    throw NSError(domain: NSOSStatusErrorDomain, code: Int(addStatus), userInfo: nil)
                }
            } else {
                throw NSError(domain: NSOSStatusErrorDomain, code: Int(status), userInfo: nil)
            }
        }
    }
    
    public func removeItem(key: String, options: StorageOptions?) throws -> Promise<Void> {
        return Promise.async { () -> Void in
            let securityLevel = options?.securityLevel
            let service = self.getService(for: securityLevel)
            
            var query = self.getKeychainQuery(for: key, service: service, securityLevel: securityLevel)
            
            // Set up authentication context for biometric operations
            if securityLevel == .biometric, let context = self.setupAuthenticationContext(with: options, operation: "remove \(key)") {
                query[kSecUseAuthenticationContext as String] = context
            }
            
            let status = SecItemDelete(query as CFDictionary)
            guard status == errSecSuccess || status == errSecItemNotFound else {
                throw NSError(domain: NSOSStatusErrorDomain, code: Int(status), userInfo: nil)
            }
        }
    }
    
    public func getAllItems(options: StorageOptions?) throws -> Promise<Dictionary<String, String>> {
        return Promise.async { () -> Dictionary<String, String> in
            let securityLevel = options?.securityLevel
            let service = self.getService(for: securityLevel)
            
            var query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecReturnAttributes as String: true,
                kSecReturnData as String: true,
                kSecMatchLimit as String: kSecMatchLimitAll
            ]
            
            // Set up authentication context for biometric operations
            if securityLevel == .biometric, let context = self.setupAuthenticationContext(with: options, operation: "access all items") {
                query[kSecUseAuthenticationContext as String] = context
            }
            
            var result: CFTypeRef?
            let status = SecItemCopyMatching(query as CFDictionary, &result)
            guard status == errSecSuccess || status == errSecItemNotFound else {
                throw NSError(domain: NSOSStatusErrorDomain, code: Int(status), userInfo: nil)
            }
            
            var dict = Dictionary<String, String>()
            if let items = result as? [[String: Any]] {
                for item in items {
                    if let account = item[kSecAttrAccount as String] as? String,
                       let data = item[kSecValueData as String] as? Data,
                       let value = String(data: data, encoding: .utf8) {
                        dict[account] = value
                    }
                }
            }
            return dict
        }
    }
    
    public func clear(options: StorageOptions?) throws -> Promise<Void> {
        return Promise.async { () -> Void in
            let securityLevel = options?.securityLevel
            let service = self.getService(for: securityLevel)
            
            var query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service
            ]
            
            // Set up authentication context for biometric operations
            if securityLevel == .biometric, let context = self.setupAuthenticationContext(with: options, operation: "clear all items") {
                query[kSecUseAuthenticationContext as String] = context
            }
            
            let status = SecItemDelete(query as CFDictionary)
            guard status == errSecSuccess || status == errSecItemNotFound else {
                throw NSError(domain: NSOSStatusErrorDomain, code: Int(status), userInfo: nil)
            }
        }
    }
    
    public func isBiometricAvailable() throws -> Promise<Bool> {
        return Promise.async { () -> Bool in
            let context = LAContext()
            var error: NSError?
            
            let canEvaluate = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
            return canEvaluate
        }
    }
    
    public func isStrongBoxAvailable() throws -> Promise<Bool> {
        return Promise.async { () -> Bool in
            // On iOS, this corresponds to Secure Enclave availability
            if #available(iOS 9.0, *) {
                let context = LAContext()
                return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) &&
                       context.biometryType != .none
            }
            return false
        }
    }
}
