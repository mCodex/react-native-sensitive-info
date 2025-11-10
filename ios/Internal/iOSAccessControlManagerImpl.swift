import Foundation
import Security
import NitroModules

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
  private let accessControlFactory: AccessControlFactory

  init(
    availabilityResolver: SecurityAvailabilityResolver = SecurityAvailabilityResolver()
  ) {
    self.accessControlFactory = AccessControlFactory(
      availabilityResolver: availabilityResolver
    )
  }

  // MARK: - AccessControlManager Implementation

  func resolveAccessControl(preferred: AccessControl?) throws -> ResolvedAccessControl {
    return try accessControlFactory.resolveAccessControl(accessControl: preferred ?? .none)
  }

  func getSecurityAvailability() -> SecurityAvailability {
    let availabilityResolver = SecurityAvailabilityResolver()
    let capabilities = availabilityResolver.resolve()
    return SecurityAvailability(
      secureEnclave: capabilities.secureEnclave,
      strongBox: capabilities.strongBox,
      biometry: capabilities.biometry,
      deviceCredential: capabilities.deviceCredential
    )
  }

  func createSecAccessControl(for policy: AccessControl) throws -> SecAccessControl? {
    let resolved = try resolveAccessControl(preferred: policy)
    return resolved.accessControlRef
  }
}
