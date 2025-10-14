import Foundation
import Security

enum AccessControlResolverError: Error {
  case unableToCreateAccessControl
}

enum AccessPolicy: String {
  case secureEnclaveBiometry = "secureEnclaveBiometry"
  case biometryCurrentSet = "biometryCurrentSet"
  case biometryAny = "biometryAny"
  case devicePasscode = "devicePasscode"
  case none = "none"
}

enum SecurityTier: String {
  case secureEnclave = "secureEnclave"
  case strongBox = "strongBox"
  case biometry = "biometry"
  case deviceCredential = "deviceCredential"
  case software = "software"
}

struct AccessControlContext {
  let policy: AccessPolicy
  let securityLevel: SecurityTier
  let accessible: CFString
  let accessControlRef: SecAccessControl?
}

final class AccessControlResolver {
  private let resolveAvailability: () -> (secureEnclave: Bool, strongBox: Bool, biometry: Bool, deviceCredential: Bool)
  private let defaultOrder: [AccessPolicy] = [
    .secureEnclaveBiometry,
    .biometryCurrentSet,
    .biometryAny,
    .devicePasscode,
    .none
  ]

  init(resolveAvailability: @escaping () -> (secureEnclave: Bool, strongBox: Bool, biometry: Bool, deviceCredential: Bool)) {
    self.resolveAvailability = resolveAvailability
  }

  func resolve(preferred: AccessPolicy?) throws -> AccessControlContext {
    let availability = resolveAvailability()
    let ordered = orderedPreferences(preferred: preferred)

    for candidate in ordered {
      if let context = try attemptResolve(candidate, availability: availability) {
        return context
      }
    }

    return AccessControlContext(
      policy: .none,
      securityLevel: .software,
      accessible: kSecAttrAccessibleAfterFirstUnlock,
      accessControlRef: nil
    )
  }

  private func orderedPreferences(preferred: AccessPolicy?) -> [AccessPolicy] {
    guard let preferred else {
      return defaultOrder
    }
    if preferred == .none {
      return [.none]
    }
    return [preferred] + defaultOrder.filter { $0 != preferred }
  }

  private func attemptResolve(
    _ candidate: AccessPolicy,
  availability: (secureEnclave: Bool, strongBox: Bool, biometry: Bool, deviceCredential: Bool)
  ) throws -> AccessControlContext? {
    switch candidate {
    case .secureEnclaveBiometry:
      guard availability.secureEnclave, availability.deviceCredential else { return nil }
      let accessControl = try makeAccessControl(flags: [.biometryCurrentSet])
      return AccessControlContext(
        policy: .secureEnclaveBiometry,
        securityLevel: .secureEnclave,
        accessible: kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
        accessControlRef: accessControl
      )
    case .biometryCurrentSet:
      guard availability.biometry, availability.deviceCredential else { return nil }
      let accessControl = try makeAccessControl(flags: [.biometryCurrentSet])
      let security: SecurityTier = availability.secureEnclave ? .secureEnclave : .biometry
      return AccessControlContext(
        policy: .biometryCurrentSet,
        securityLevel: security,
        accessible: kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
        accessControlRef: accessControl
      )
    case .biometryAny:
      guard availability.biometry, availability.deviceCredential else { return nil }
      let accessControl = try makeAccessControl(flags: [.biometryAny])
      let security: SecurityTier = availability.secureEnclave ? .secureEnclave : .biometry
      return AccessControlContext(
        policy: .biometryAny,
        securityLevel: security,
        accessible: kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
        accessControlRef: accessControl
      )
    case .devicePasscode:
      guard availability.deviceCredential else { return nil }
      let accessControl = try makeAccessControl(flags: [.devicePasscode])
      return AccessControlContext(
        policy: .devicePasscode,
        securityLevel: .deviceCredential,
        accessible: kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
        accessControlRef: accessControl
      )
    case .none:
      return AccessControlContext(
        policy: .none,
        securityLevel: .software,
        accessible: kSecAttrAccessibleAfterFirstUnlock,
        accessControlRef: nil
      )
    }
  }

  private func makeAccessControl(flags: SecAccessControlCreateFlags) throws -> SecAccessControl {
    var error: Unmanaged<CFError>?
    guard let control = SecAccessControlCreateWithFlags(
      kCFAllocatorDefault,
      kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
      flags,
      &error
    ) else {
      if let existing = error?.takeRetainedValue() {
        throw existing
      }
      throw AccessControlResolverError.unableToCreateAccessControl
    }
    return control
  }
}
