import Foundation
import Security

/// Represents resolved access control with platform-specific details.
struct ResolvedAccessControl {
  let accessControl: AccessControl
  let securityLevel: SecurityLevel
  let accessible: CFString
  let accessControlRef: SecAccessControl?
}

/// Protocol for managing access control resolution and operations.
///
/// Encapsulates all access control policies and their resolution logic.
/// Follows Single Responsibility Principle by focusing on access control.
///
/// @since 6.0.0
protocol AccessControlManager {
  /// Resolve access control to platform-supported policy.
  ///
  /// - Parameters:
  ///   - preferred: Preferred access control from request
  /// - Returns: Resolved access control with platform support details
  /// - Throws: RuntimeError if resolution fails
  func resolveAccessControl(preferred: AccessControl?) throws -> ResolvedAccessControl

  /// Get current security availability.
  ///
  /// - Returns: Available security features on this device
  func getSecurityAvailability() -> SecurityAvailability

  /// Create SecAccessControl for the given policy.
  ///
  /// - Parameters:
  ///   - policy: Access control policy
  /// - Returns: SecAccessControl reference or nil if unsupported
  /// - Throws: RuntimeError if creation fails
  func createSecAccessControl(for policy: AccessControl) throws -> SecAccessControl?
}
