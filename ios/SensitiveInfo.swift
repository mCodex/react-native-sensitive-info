import Foundation
import LocalAuthentication

@objc(SensitiveInfo)
class SensitiveInfo: HybridSensitiveInfoSpec {

    // Batch setItems
    public func setItems(items: [[String: Any]]) async throws {
        for item in items {
            guard let key = item["key"] as? String, let value = item["value"] as? String else { continue }
            let options = item["options"] as? [String: Any]
            try await setItem(key: key, value: value, options: options)
        }
    }

    // Batch getItems
    public func getItems(keys: [String], options: [String: Any]?) async throws -> [String: String?] {
        var result: [String: String?] = [:]
        for key in keys {
            result[key] = try await getItem(key: key, options: options)
        }
        return result
    }

    // Batch deleteItems
    public func deleteItems(keys: [String]) async throws {
        for key in keys {
            try await deleteItem(key: key)
        }
    }

    // Map all Keychain and LAError codes to new error codes in result objects
    // Store metadata (biometric flags) securely in Keychain
    // Ensure all sensitive buffers are zeroed after use
    // Ensure all crypto/biometric operations are off the main thread

    private func mapKeychainError(_ status: OSStatus) -> Int {
        switch status {
        case errSecSuccess: return 0
        case errSecItemNotFound: return 404
        case errSecAuthFailed: return 401
        default: return Int(status)
        }
    }

    private func mapLAError(_ error: LAError) -> Int {
        switch error.code {
        case .userCancel: return 1001
        case .systemCancel: return 1002
        case .authenticationFailed: return 1003
        default: return error.errorCode
        }
    }

    // MARK: - Secure Storage (Keychain)

    public func setItem(key: String, value: String, options: [String: Any]?) async throws {
        guard let data = value.data(using: .utf8) else {
            throw NSError(domain: NSOSStatusErrorDomain, code: -1001, userInfo: [NSLocalizedDescriptionKey: "Unable to encode value as UTF-8"])
        }
        let service = "com.yourcompany.reactnativesensitiveinfo"
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecAttrService as String: service
        ]
        SecItemDelete(query as CFDictionary)

        var attributes: [String: Any] = query
        attributes[kSecValueData as String] = data

        if let requireBiometric = options?["requireBiometric"] as? Bool, requireBiometric {
            var error: Unmanaged<CFError>?
            let access = SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly, [.userPresence, .biometryCurrentSet], &error)
            if let access = access {
                attributes[kSecAttrAccessControl as String] = access
            } else {
                throw error!.takeRetainedValue() as Error
            }
            // Store metadata (biometric flags) securely in Keychain
            let metaKey = "\(key)_biometric"
            let metaQuery: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrAccount as String: metaKey,
                kSecAttrService as String: service
            ]
            SecItemDelete(metaQuery as CFDictionary)
            let metaData = "true".data(using: .utf8)!
            var metaAttributes = metaQuery
            metaAttributes[kSecValueData as String] = metaData
            metaAttributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly
            SecItemAdd(metaAttributes as CFDictionary, nil)
        } else {
            attributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly
        }

        let status = SecItemAdd(attributes as CFDictionary, nil)
        if status != errSecSuccess {
            throw NSError(domain: NSOSStatusErrorDomain, code: mapKeychainError(status), userInfo: [NSLocalizedDescriptionKey: "Unable to store item"])
        }
        memset(UnsafeMutableRawPointer(mutating: (data as NSData).bytes), 0, data.count)
    }
    }


    public func getItem(key: String, options: [String: Any]?) async throws -> String? {
        let service = "com.yourcompany.reactnativesensitiveinfo"
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecAttrService as String: service,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        if let requireBiometric = options?["requireBiometric"] as? Bool, requireBiometric {
            let context = LAContext()
            let prompt = (options?["promptOptions"] as? [String: Any])?["reason"] as? String ?? "Authenticate to access secure data"
            query[kSecUseOperationPrompt as String] = prompt
            query[kSecUseAuthenticationContext as String] = context
        }
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecSuccess, let data = item as? Data {
            defer { memset(UnsafeMutableRawPointer(mutating: (data as NSData).bytes), 0, data.count) }
            guard let value = String(data: data, encoding: .utf8) else {
                throw NSError(domain: NSOSStatusErrorDomain, code: -1002, userInfo: [NSLocalizedDescriptionKey: "Unable to decode value as UTF-8"])
            }
            return value
        } else if status == errSecItemNotFound {
            return nil
        } else {
            throw NSError(domain: NSOSStatusErrorDomain, code: mapKeychainError(status), userInfo: [NSLocalizedDescriptionKey: "Unable to retrieve item"])
        }
    }
    }


    public func deleteItem(key: String) async throws {
        let service = "com.yourcompany.reactnativesensitiveinfo"
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecAttrService as String: service
        ]
        let metaKey = "\(key)_biometric"
        let metaQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: metaKey,
            kSecAttrService as String: service
        ]
        let status = SecItemDelete(query as CFDictionary)
        SecItemDelete(metaQuery as CFDictionary)
        if status != errSecSuccess && status != errSecItemNotFound {
            throw NSError(domain: NSOSStatusErrorDomain, code: mapKeychainError(status), userInfo: [NSLocalizedDescriptionKey: "Unable to delete item"])
        }
    }
    }

    public func isBiometricAvailable() async throws -> Bool {
        let context = LAContext()
        var error: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        return available
    }

    public func authenticate(options: [String: Any]?) async throws -> Bool {
        let context = LAContext()
        let reason = (options?["reason"] as? String) ?? "Authenticate to continue"
        var authError: NSError?
        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &authError) {
            let success = try await withCheckedThrowingContinuation { continuation in
                context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, error in
                    if let error = error as? LAError {
                        switch error.code {
                        case .userCancel, .systemCancel:
                            continuation.resume(returning: false)
                        default:
                            continuation.resume(throwing: error)
                        }
                    } else if let error = error {
                        continuation.resume(throwing: error)
                    } else {
                        continuation.resume(returning: success)
                    }
                }
            }
            return success
        } else {
            throw authError ?? NSError(domain: "SensitiveInfo", code: -1, userInfo: [NSLocalizedDescriptionKey: "Biometrics not available"])
        }
    }
}
