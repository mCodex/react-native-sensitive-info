import Foundation
import LocalAuthentication
import Security

/// Resolves and creates access control policies for Keychain items.
///
/// This factory creates SecAccessControl objects based on the requested security level,
/// managing the complexity of:
/// - Biometric authentication (Face ID, Touch ID)
/// - Device credentials (passcode)
/// - Secure Enclave integration
/// - Hardware-backed key storage
/// - Fallback policies when hardware is unavailable
///
/// Example:
/// ```swift
/// let factory = AccessControlFactory(availabilityResolver: resolver)
/// let resolved = try factory.resolveAccessControl(accessControl: .biometrycurrentset)
/// ```
///
/// @since 6.0.0
final class AccessControlFactory {
  private let availabilityResolver: SecurityAvailabilityResolver

  /// Initialize the access control factory.
  ///
  /// - Parameters:
  ///   - availabilityResolver: Resolves available security features
  init(
    availabilityResolver: SecurityAvailabilityResolver
  ) {
    self.availabilityResolver = availabilityResolver
  }

  /// Resolve the best available access control policy.
  ///
  /// Process:
  /// 1. Check requested access control type
  /// 2. Verify availability on current device
  /// 3. Create SecAccessControl with appropriate flags
  /// 4. Fall back to weaker policies if requested level unavailable
  /// 5. Return resolved policy with security level and accessible attribute
  ///
  /// - Parameter accessControl: Requested access control level
  /// - Returns: ResolvedAccessControl with matching security level
  /// - Throws: RuntimeError if access control creation fails
  func resolveAccessControl(accessControl: AccessControl) throws -> ResolvedAccessControl {
    let availability = availabilityResolver.resolve()

    switch accessControl {
    case .none:
      return ResolvedAccessControl(
        accessControl: .none,
        securityLevel: .software,
        accessible: kSecAttrAccessibleWhenUnlocked,
        accessControlRef: nil
      )

    case .strongbox:
      guard availability.strongBox else {
        // Fall back to device credential
        return try createDeviceCredentialControl()
      }
      return try createStrongBoxControl()

    case .biometrycurrentset:
      guard availability.biometry else {
        // Fall back to device credential
        return try createDeviceCredentialControl()
      }
      return try createBiometricControl()

    case .devicepasscode:
      return try createDeviceCredentialControl()

    case .secureenclavebiometry:
      guard availability.secureEnclave else {
        // Fall back to device credential
        return try createDeviceCredentialControl()
      }
      return try createSecureEnclaveControl()
    
    case .biometryany:
      guard availability.biometry else {
        // Fall back to device credential
        return try createDeviceCredentialControl()
      }
      return try createBiometricControl()
    
    @unknown default:
      return try createDeviceCredentialControl()
    }
  }

  /// Create access control for biometric authentication (Face ID / Touch ID).
  ///
  /// - Returns: ResolvedAccessControl configured for biometric
  /// - Throws: RuntimeError if SecAccessControl creation fails
  private func createBiometricControl() throws -> ResolvedAccessControl {
    var error: Unmanaged<CFError>?
    let control = SecAccessControlCreateWithFlags(
      kCFAllocatorDefault,
      kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      [.biometryCurrentSet, .privateKeyUsage],
      &error
    )

    guard let control = control else {
      throw RuntimeError.error(withMessage: "Failed to create biometric access control")
    }

    return ResolvedAccessControl(
      accessControl: .biometrycurrentset,
      securityLevel: .biometry,
      accessible: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      accessControlRef: control
    )
  }

  /// Create access control for device credentials (passcode).
  ///
  /// - Returns: ResolvedAccessControl configured for device credentials
  /// - Throws: RuntimeError if SecAccessControl creation fails
  private func createDeviceCredentialControl() throws -> ResolvedAccessControl {
    var error: Unmanaged<CFError>?
    let control = SecAccessControlCreateWithFlags(
      kCFAllocatorDefault,
      kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      [.devicePasscode, .privateKeyUsage],
      &error
    )

    guard let control = control else {
      throw RuntimeError.error(withMessage: "Failed to create device credential access control")
    }

    return ResolvedAccessControl(
      accessControl: .devicepasscode,
      securityLevel: .devicecredential,
      accessible: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      accessControlRef: control
    )
  }

  /// Create access control for Secure Enclave (hardware-backed keys).
  ///
  /// Secure Enclave requires special handling and may not be available on all devices.
  /// Falls back gracefully if unavailable.
  ///
  /// - Returns: ResolvedAccessControl configured for Secure Enclave
  /// - Throws: RuntimeError if creation fails
  private func createSecureEnclaveControl() throws -> ResolvedAccessControl {
    var error: Unmanaged<CFError>?
    let control = SecAccessControlCreateWithFlags(
      kCFAllocatorDefault,
      kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      [.privateKeyUsage],
      &error
    )

    guard let control = control else {
      throw RuntimeError.error(withMessage: "Failed to create Secure Enclave access control")
    }

    return ResolvedAccessControl(
      accessControl: .secureenclavebiometry,
      securityLevel: .secureenclave,
      accessible: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      accessControlRef: control
    )
  }

  /// Create access control for StrongBox (hardware-backed, biometric).
  ///
  /// StrongBox is the strongest available protection level on supported devices.
  ///
  /// - Returns: ResolvedAccessControl configured for StrongBox
  /// - Throws: RuntimeError if creation fails
  private func createStrongBoxControl() throws -> ResolvedAccessControl {
    var error: Unmanaged<CFError>?
    let control = SecAccessControlCreateWithFlags(
      kCFAllocatorDefault,
      kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      [.biometryCurrentSet, .privateKeyUsage],
      &error
    )

    guard let control = control else {
      throw RuntimeError.error(withMessage: "Failed to create StrongBox access control")
    }

    return ResolvedAccessControl(
      accessControl: .strongbox,
      securityLevel: .strongbox,
      accessible: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      accessControlRef: control
    )
  }
}
