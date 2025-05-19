import Foundation
import NitroModules
import LocalAuthentication

class SensitiveInfo: HybridSensitiveInfoSpec {
    private func mapKeychainError(_ status: OSStatus) -> Int {
        switch status {
        case errSecSuccess: return 0
        case errSecItemNotFound: return 404
        case errSecAuthFailed: return 401
        default: return Int(status)
        }
    }

    func setItem(
        key: String,
        value: String,
        requireBiometric: Bool?,
        promptTitle: String?,
        promptSubtitle: String?,
        promptDescription: String?,
        promptNegativeButton: String?,
        promptReason: String?
    ) throws -> Promise<Void> {
        let promise = Promise<Void>()
        DispatchQueue.global().async {
            do {
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

                if requireBiometric == true {
                    var error: Unmanaged<CFError>?
                    let access = SecAccessControlCreateWithFlags(
                        nil,
                        kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
                        [.userPresence, .biometryCurrentSet],
                        &error
                    )
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
                    throw NSError(domain: NSOSStatusErrorDomain, code: self.mapKeychainError(status), userInfo: [NSLocalizedDescriptionKey: "Unable to store item"])
                }
                memset(UnsafeMutableRawPointer(mutating: (data as NSData).bytes), 0, data.count)
                promise.resolve(withResult: ())
            } catch {
                promise.reject(withError: error)
            }
        }
        return promise
    }

    func getItem(
        key: String,
        requireBiometric: Bool?,
        promptTitle: String?,
        promptSubtitle: String?,
        promptDescription: String?,
        promptNegativeButton: String?,
        promptReason: String?
    ) throws -> Promise<String?> {
        let promise = Promise<String?>()
        DispatchQueue.global().async {
            do {
                let service = "com.yourcompany.reactnativesensitiveinfo"
                var query: [String: Any] = [
                    kSecClass as String: kSecClassGenericPassword,
                    kSecAttrAccount as String: key,
                    kSecAttrService as String: service,
                    kSecReturnData as String: true,
                    kSecMatchLimit as String: kSecMatchLimitOne
                ]
                if requireBiometric == true {
                    let context = LAContext()
                    let prompt = promptReason ?? "Authenticate to access secure data"
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
                    promise.resolve(withResult: value)
                } else if status == errSecItemNotFound {
                    promise.resolve(withResult: nil)
                } else {
                    throw NSError(domain: NSOSStatusErrorDomain, code: self.mapKeychainError(status), userInfo: [NSLocalizedDescriptionKey: "Unable to retrieve item"])
                }
            } catch {
                promise.reject(withError: error)
            }
        }
        return promise
    }

    func deleteItem(key: String) throws -> Promise<Void> {
        let promise = Promise<Void>()
        DispatchQueue.global().async {
            do {
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
                    throw NSError(domain: NSOSStatusErrorDomain, code: self.mapKeychainError(status), userInfo: [NSLocalizedDescriptionKey: "Unable to delete item"])
                }
                promise.resolve(withResult: ())
            } catch {
                promise.reject(withError: error)
            }
        }
        return promise
    }

    func isBiometricAvailable() throws -> Promise<Bool> {
        let promise = Promise<Bool>()
        DispatchQueue.global().async {
            let context = LAContext()
            var error: NSError?
            let available = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
            promise.resolve(withResult: available)
        }
        return promise
    }

    func authenticate(
        promptTitle: String?,
        promptSubtitle: String?,
        promptDescription: String?,
        promptNegativeButton: String?,
        promptReason: String?
    ) throws -> Promise<Bool> {
        let promise = Promise<Bool>()
        DispatchQueue.global().async {
            let context = LAContext()
            let reason = promptReason ?? "Authenticate to continue"
            var authError: NSError?
            if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &authError) {
                context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, error in
                    if let error = error as? LAError {
                        switch error.code {
                        case .userCancel, .systemCancel:
                            promise.resolve(withResult: false)
                        default:
                            promise.reject(withError: error)
                        }
                    } else if let error = error {
                        promise.reject(withError: error)
                    } else {
                        promise.resolve(withResult: success)
                    }
                }
            } else {
                promise.reject(withError: authError ?? NSError(domain: "SensitiveInfo", code: -1, userInfo: [NSLocalizedDescriptionKey: "Biometrics not available"]))
            }
        }
        return promise
    }
}