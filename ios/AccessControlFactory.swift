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
/// let resolved = try factory.resolve(accessControl: .biometric)
/// ```
///
/// @since 6.0.0
final class AccessControlFactory {
  private let availabilityResolver: SecurityAvailabilityResolver
  private let workQueue: DispatchQueue

  /// Initialize the access control factory.
  ///
  /// - Parameters:
  ///   - availabilityResolver: Resolves available security features
  ///   - workQueue: Dispatch queue for Keychain operations
  init(
    availabilityResolver: SecurityAvailabilityResolver,
    workQueue: DispatchQueue? = nil
  ) {
    self.availabilityResolver = availabilityResolver
    self.workQueue = workQueue ?? DispatchQueue(label: "com.mcodex.sensitiveinfo.accesscontrol", qos: .userInitiated)
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
  /// - Returns: Promise resolving to ResolvedAccessControl
  /// - Throws: RuntimeError if access control creation fails
  func resolve(accessControl: AccessControl) -> Promise<ResolvedAccessControl> {
    Promise.parallel(workQueue) { [self] in
      let availability = availabilityResolver.resolveAvailability()

      switch accessControl {
      case .standard:
        return ResolvedAccessControl(
          accessControl: .standard,
          securityLevel: .standard,
          accessible: kSecAttrAccessibleWhenUnlocked,
          accessControlRef: nil
        )

      case .strongBox:
        guard availability.strongBox else {
          // Fall back to device credential
          return try createDeviceCredentialControl()
        }
        return try createStrongBoxControl()

      case .biometric:
        guard availability.biometry else {
          // Fall back to device credential
          return try createDeviceCredentialControl()
        }
        return try createBiometricControl()

      case .deviceCredential:
        return try createDeviceCredentialControl()

      case .secureEnclave:
        guard availability.secureEnclave else {
          // Fall back to device credential
          return try createDeviceCredentialControl()
        }
        return try createSecureEnclaveControl()
      }
    }
  }

  /// Create access control for biometric authentication (Face ID / Touch ID).
  ///
  /// - Returns: ResolvedAccessControl configured for biometric
  /// - Throws: RuntimeError if SecAccessControl creation fails
  private func createBiometricControl() throws -> ResolvedAccessControl {
    var error: Throwable?
    let control = SecAccessControlCreateWithFlags(
      nil,
      kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      [.biometryCurrentSet, .privateKeyUsage],
      &error
    )

    guard let control = control else {
      throw RuntimeError.error(withMessage: "Failed to create biometric access control")
    }

    return ResolvedAccessControl(
      accessControl: .biometric,
      securityLevel: .biometric,
      accessible: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      accessControlRef: control
    )
  }

  /// Create access control for device credentials (passcode).
  ///
  /// - Returns: ResolvedAccessControl configured for device credentials
  /// - Throws: RuntimeError if SecAccessControl creation fails
  private func createDeviceCredentialControl() throws -> ResolvedAccessControl {
    var error: Throwable?
    let control = SecAccessControlCreateWithFlags(
      nil,
      kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      [.devicePasscode, .privateKeyUsage],
      &error
    )

    guard let control = control else {
      throw RuntimeError.error(withMessage: "Failed to create device credential access control")
    }

    return ResolvedAccessControl(
      accessControl: .deviceCredential,
      securityLevel: .deviceCredential,
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
    var error: Throwable?
    let control = SecAccessControlCreateWithFlags(
      nil,
      kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      [.privateKeyUsage],
      &error
    )

    guard let control = control else {
      throw RuntimeError.error(withMessage: "Failed to create Secure Enclave access control")
    }

    return ResolvedAccessControl(
      accessControl: .secureEnclave,
      securityLevel: .hardwareBacked,
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
    var error: Throwable?
    let control = SecAccessControlCreateWithFlags(
      nil,
      kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      [.biometryCurrentSet, .privateKeyUsage],
      &error
    )

    guard let control = control else {
      throw RuntimeError.error(withMessage: "Failed to create StrongBox access control")
    }

    return ResolvedAccessControl(
      accessControl: .strongBox,
      securityLevel: .hardwareBacked,
      accessible: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      accessControlRef: control
    )
  }
}

/// Resolved access control with metadata.
///
/// Contains the SecAccessControl object and related metadata needed by Keychain operations.
struct ResolvedAccessControl {
  /// The access control enum value
  let accessControl: AccessControl

  /// The security level achieved
  let securityLevel: SecurityLevel

  /// The kSecAttrAccessible attribute value
  let accessible: CFString

  /// The SecAccessControl reference (nil for software-only policies)
  let accessControlRef: SecAccessControl?
}
