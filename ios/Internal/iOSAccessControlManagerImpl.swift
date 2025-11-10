import Foundation
import Security

/// Concrete implementation of AccessControlManager for iOS.
///
/// Resolves access control policies to platform capabilities:
/// - Maps requested policies to available hardware
/// - Creates SecAccessControl objects for Keychain
/// - Handles fallback when hardware not available
/// - Tracks security availability
///
/// @since 6.0.0
final class iOSAccessControlManager: AccessControlManager {
  private let availabilityResolver: SecurityAvailabilityResolver
  private let accessControlFactory: AccessControlFactory

  init(
    availabilityResolver: SecurityAvailabilityResolver = SecurityAvailabilityResolver(),
    accessControlFactory: AccessControlFactory = AccessControlFactory()
  ) {
    self.availabilityResolver = availabilityResolver
    self.accessControlFactory = accessControlFactory
  }

  // MARK: - AccessControlManager Implementation

  func resolveAccessControl(preferred: AccessControl?) throws -> ResolvedAccessControl {
    let availability = availabilityResolver.resolve()
    let preferredPolicy = preferred.flatMap { AccessPolicy(rawValue: $0.stringValue) }

    let secAccessControl = try createSecAccessControlIfAvailable(
      for: preferredPolicy,
      availability: availability
    )

    let resolvedPolicy = mapToAvailablePolicy(preferred: preferredPolicy, availability: availability)
    let securityLevel = mapToSecurityLevel(policy: resolvedPolicy)
    let accessible = mapToAccessible(policy: resolvedPolicy)

    return ResolvedAccessControl(
      accessControl: AccessControl(fromString: resolvedPolicy.rawValue) ?? .none,
      securityLevel: securityLevel,
      accessible: accessible,
      accessControlRef: secAccessControl
    )
  }

  func getSecurityAvailability() -> SecurityAvailability {
    let capabilities = availabilityResolver.resolve()
    return SecurityAvailability(
      secureEnclave: capabilities.secureEnclave,
      strongBox: capabilities.strongBox,
      biometry: capabilities.biometry,
      deviceCredential: capabilities.deviceCredential
    )
  }

  func createSecAccessControl(for policy: AccessControl) throws -> SecAccessControl? {
    guard let accessPolicy = AccessPolicy(rawValue: policy.stringValue) else {
      return nil
    }

    return try createSecAccessControlIfAvailable(
      for: accessPolicy,
      availability: availabilityResolver.resolve()
    )
  }

  // MARK: - Private Helpers

  private func createSecAccessControlIfAvailable(
    for policy: AccessPolicy?,
    availability: SecurityAvailabilityResolver.Capabilities
  ) throws -> SecAccessControl? {
    guard let policy = policy else { return nil }

    // Try to create with requested policy
    if let secAccessControl = try accessControlFactory.createBiometricAccessControl() {
      return secAccessControl
    }

    if let secAccessControl = try accessControlFactory.createDeviceCredentialAccessControl() {
      return secAccessControl
    }

    if availability.secureEnclave {
      if let secAccessControl = try accessControlFactory.createSecureEnclaveAccessControl() {
        return secAccessControl
      }
    }

    if availability.strongBox {
      if let secAccessControl = try accessControlFactory.createStrongBoxAccessControl() {
        return secAccessControl
      }
    }

    return nil
  }

  private func mapToAvailablePolicy(
    preferred: AccessPolicy?,
    availability: SecurityAvailabilityResolver.Capabilities
  ) -> AccessPolicy {
    guard let preferred = preferred else {
      return .none
    }

    switch preferred {
    case .biometric:
      return availability.biometry ? .biometric : .deviceCredential
    case .deviceCredential:
      return availability.deviceCredential ? .deviceCredential : .none
    case .secureEnclave:
      return availability.secureEnclave ? .secureEnclave : .software
    case .strongBox:
      return availability.strongBox ? .strongBox : .software
    case .none, .software:
      return .software
    @unknown default:
      return .software
    }
  }

  private func mapToSecurityLevel(policy: AccessPolicy) -> SecurityLevel {
    switch policy {
    case .biometric:
      return .biometric
    case .deviceCredential:
      return .deviceCredential
    case .secureEnclave, .strongBox:
      return .hardwareBacked
    case .software, .none:
      return .software
    @unknown default:
      return .software
    }
  }

  private func mapToAccessible(policy: AccessPolicy) -> CFString {
    switch policy {
    case .biometric, .deviceCredential, .secureEnclave, .strongBox:
      return kSecAttrAccessibleAfterFirstUnlock
    case .software, .none:
      return kSecAttrAccessibleWhenUnlocked
    @unknown default:
      return kSecAttrAccessibleWhenUnlocked
    }
  }
}
