import Foundation
import Security
#if canImport(LocalAuthentication)
import LocalAuthentication
#endif

/// Common default values shared by the Keychain helpers.
enum KeychainDefaults {
  /// Default service name for new items. Matches the legacy implementation to avoid breaking existing data.
  static let service = "app"
  /// Recommended accessibility for non-biometric items. Keeps secrets on-device while allowing background access after unlock.
  static let recommendedAccessible: KeychainAccessible = .whenUnlockedThisDeviceOnly
}

/// Normalised view of the configuration options we receive from JavaScript.
struct KeychainOptions {
  let service: String
  let synchronizable: Any
  let touchID: Bool
  let accessibleOption: KeychainAccessible?
  let accessControlOption: AccessControlFlag?
  let operationPrompt: String?
  let localizedFallbackTitle: String?
  let invalidateBiometricEnrollment: Bool

  init(dictionary: NSDictionary, invalidateBiometricEnrollment: Bool) {
    let raw = dictionary as? [String: Any] ?? [:]

    service = (raw["keychainService"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty
      ?? KeychainDefaults.service

    if let syncValue = raw["kSecAttrSynchronizable"] {
      if let boolValue = syncValue as? Bool {
        synchronizable = boolValue ? kCFBooleanTrue! : kCFBooleanFalse!
      } else if let stringValue = (syncValue as? String)?.lowercased() {
        switch stringValue {
        case "enabled", "true":
          synchronizable = kCFBooleanTrue!
        case "disabled", "false":
          synchronizable = kCFBooleanFalse!
        case "any", "ksecattrsynchronizableany":
          synchronizable = kSecAttrSynchronizableAny
        default:
          synchronizable = syncValue
        }
      } else {
        synchronizable = syncValue
      }
    } else {
      synchronizable = kSecAttrSynchronizableAny
    }

    touchID = (raw["touchID"] as? Bool) ?? false
    accessibleOption = (raw["kSecAttrAccessible"] as? String).flatMap(KeychainAccessible.init)
    accessControlOption = (raw["kSecAccessControl"] as? String).flatMap(AccessControlFlag.init)
    operationPrompt = raw["kSecUseOperationPrompt"] as? String
    localizedFallbackTitle = raw["kLocalizedFallbackTitle"] as? String
    self.invalidateBiometricEnrollment = invalidateBiometricEnrollment
  }

  var effectiveAccessible: KeychainAccessible {
    accessibleOption ?? KeychainDefaults.recommendedAccessible
  }

  #if !os(tvOS)
  /// Chooses the right LocalAuthentication policy based on the configured fallback title.
  var policy: LAPolicy {
    if let fallback = localizedFallbackTitle, !fallback.isEmpty {
      return .deviceOwnerAuthentication
    }
    return .deviceOwnerAuthenticationWithBiometrics
  }
  #endif

  /// Default access-control flags to use when the caller does not provide anything explicit.
  var defaultBiometricFlags: AccessControlFlag {
    invalidateBiometricEnrollment ? .biometryCurrentSet : .biometryAny
  }
}

/// Maps JS string values to the corresponding `SecAccessControl` flags.
enum AccessControlFlag: String {
  case applicationPassword = "kSecAccessControlApplicationPassword"
  case privateKeyUsage = "kSecAccessControlPrivateKeyUsage"
  case devicePasscode = "kSecAccessControlDevicePasscode"
  case touchIDAny = "kSecAccessControlTouchIDAny"
  case touchIDCurrentSet = "kSecAccessControlTouchIDCurrentSet"
  case biometryAny = "kSecAccessControlBiometryAny"
  case biometryCurrentSet = "kSecAccessControlBiometryCurrentSet"
  case userPresence = "kSecAccessControlUserPresence"

  var flag: SecAccessControlCreateFlags {
    switch self {
    case .applicationPassword:
      return .applicationPassword
    case .privateKeyUsage:
      return .privateKeyUsage
    case .devicePasscode:
      return .devicePasscode
    case .touchIDAny:
      return .touchIDAny
    case .touchIDCurrentSet:
      return .touchIDCurrentSet
    case .biometryAny:
      if #available(iOS 11.3, macOS 10.13.4, *) {
        return .biometryAny
      }
      return .touchIDAny
    case .biometryCurrentSet:
      if #available(iOS 11.3, macOS 10.13.4, *) {
        return .biometryCurrentSet
      }
      return .touchIDCurrentSet
    case .userPresence:
      return .userPresence
    }
  }
}

/// Keychain accessibility wrappers make the code more type-safe than relying on raw strings.
enum KeychainAccessible: String {
  case afterFirstUnlock = "kSecAttrAccessibleAfterFirstUnlock"
  case always = "kSecAttrAccessibleAlways"
  case whenPasscodeSetThisDeviceOnly = "kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly"
  case whenUnlockedThisDeviceOnly = "kSecAttrAccessibleWhenUnlockedThisDeviceOnly"
  case afterFirstUnlockThisDeviceOnly = "kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly"
  case alwaysThisDeviceOnly = "kSecAttrAccessibleAlwaysThisDeviceOnly"
  case whenUnlocked = "kSecAttrAccessibleWhenUnlocked"

  init?(rawValueAny value: Any) {
    if let stringValue = value as? String {
      self.init(rawValue: stringValue)
      return
    }
    if let stringValue = value as? NSString {
      self.init(rawValue: stringValue as String)
      return
    }
    return nil
  }

  var cfValue: CFString {
    switch self {
    case .afterFirstUnlock: return kSecAttrAccessibleAfterFirstUnlock
    case .always: return kSecAttrAccessibleAlways
    case .whenPasscodeSetThisDeviceOnly: return kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly
    case .whenUnlockedThisDeviceOnly: return kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    case .afterFirstUnlockThisDeviceOnly: return kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    case .alwaysThisDeviceOnly: return kSecAttrAccessibleAlwaysThisDeviceOnly
    case .whenUnlocked: return kSecAttrAccessibleWhenUnlocked
    }
  }

  /// Flags entries that should be migrated to the stronger default accessibility.
  var isWeakerThanRecommended: Bool {
    switch self {
    case .whenUnlockedThisDeviceOnly, .whenPasscodeSetThisDeviceOnly:
      return false
    case .always, .alwaysThisDeviceOnly, .afterFirstUnlock, .afterFirstUnlockThisDeviceOnly, .whenUnlocked:
      return true
    }
  }
}

extension String {
  var nonEmpty: String? {
    isEmpty ? nil : self
  }
}
