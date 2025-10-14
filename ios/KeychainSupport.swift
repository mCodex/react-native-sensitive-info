import Foundation
import Security
import React
#if canImport(LocalAuthentication)
import LocalAuthentication
#endif

/// Produces the various query dictionaries needed to talk to the Keychain APIs.
enum KeychainQueryBuilder {
  static let secItemClasses: [CFString] = [kSecClassGenericPassword, kSecClassInternetPassword]

  static func baseQuery(for key: String, options: KeychainOptions) -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: key,
      kSecAttrService as String: options.service,
      kSecAttrSynchronizable as String: options.synchronizable
    ]
  }

  static func lookupQuery(from base: [String: Any], options: KeychainOptions) -> [String: Any] {
    var query = base
    query[kSecReturnAttributes as String] = true
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne

    if let prompt = options.operationPrompt, !prompt.isEmpty {
      query[kSecUseOperationPrompt as String] = prompt
    }

    if !options.touchID, let accessible = options.accessibleOption {
      query[kSecAttrAccessible as String] = accessible.cfValue
    }

    return query
  }

  static func existsQuery(for key: String, options: KeychainOptions) -> [String: Any] {
    var query = baseQuery(for: key, options: options)
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    return query
  }

  static func allItemsQuery(options: KeychainOptions) -> [String: Any] {
    var query: [String: Any] = [
      kSecReturnAttributes as String: true,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitAll,
      kSecAttrSynchronizable as String: kSecAttrSynchronizableAny
    ]

    if !options.service.isEmpty {
      query[kSecAttrService as String] = options.service
    }

    return query
  }
}

/// Applies secure defaults to outgoing queries so we never forget to configure access control.
enum KeychainProtection {
  static func apply(to query: inout [String: Any], options: KeychainOptions) throws {
    guard options.touchID else {
      query[kSecAttrAccessible as String] = options.effectiveAccessible.cfValue
      return
    }

    #if os(tvOS)
    throw NSError(domain: "SensitiveInfo", code: -1, userInfo: [NSLocalizedDescriptionKey: "Biometric storage is not supported on tvOS."])
    #else
    let accessControl = try makeAccessControl(options: options)
    query.removeValue(forKey: kSecAttrAccessible as String)
    query[kSecAttrAccessControl as String] = accessControl
    #endif
  }

  #if !os(tvOS)
  static func makeAccessControl(options: KeychainOptions) throws -> SecAccessControl {
    let accessible = options.accessibleOption ?? .whenPasscodeSetThisDeviceOnly
    let flags = options.accessControlOption ?? options.defaultBiometricFlags

    var error: Unmanaged<CFError>?
    guard let accessControl = SecAccessControlCreateWithFlags(nil, accessible.cfValue, flags.cfValue, &error) else {
      let cfError = error?.takeRetainedValue()
      throw cfError ?? NSError(domain: "SensitiveInfo", code: -2, userInfo: [NSLocalizedDescriptionKey: "Failed to configure access control"])
    }

    return accessControl
  }
  #endif
}

/// Transparently upgrades older keychain entries to the stronger accessibility class without disrupting callers.
final class KeychainMigrator {
  func needsMigration(item: [String: Any], options: KeychainOptions) -> Bool {
    guard !options.touchID, options.accessibleOption == nil else { return false }
    guard let rawAccessible = item[kSecAttrAccessible as String],
          let current = KeychainAccessible(rawValueAny: rawAccessible) else { return false }
    return current.isWeakerThanRecommended
  }

  func migrate(baseQuery: [String: Any], options: KeychainOptions) {
    var updateQuery = baseQuery
    let attributes: [String: Any] = [kSecAttrAccessible as String: KeychainDefaults.recommendedAccessible.cfValue]
    let status = SecItemUpdate(updateQuery as CFDictionary, attributes as CFDictionary)
    if status != errSecSuccess {
      RCTLogWarn("[react-native-sensitive-info] Failed to migrate keychain item. Status: \(status)")
    }
  }
}

/// Human-readable messages for the most common Keychain errors.
enum KeychainMessages {
  static func message(for error: NSError) -> String {
    switch error.code {
    case errSecUnimplemented: return "Function or operation not implemented."
    case errSecIO: return "I/O error."
    case errSecOpWr: return "File already open with write permission."
    case errSecParam: return "One or more parameters were invalid."
    case errSecAllocate: return "Failed to allocate memory."
    case errSecUserCanceled: return "User canceled the operation."
    case errSecBadReq: return "Bad parameter or invalid state."
    case errSecNotAvailable: return "No keychain is available. Restart your device and try again."
    case errSecDuplicateItem: return "The item already exists in the keychain."
    case errSecItemNotFound: return "The item does not exist in the keychain."
    case errSecInteractionNotAllowed: return "User interaction is not allowed."
    case errSecDecode: return "Unable to decode the stored data."
    case errSecAuthFailed: return "Authentication failed."
    default:
      return error.localizedDescription
    }
  }
}
