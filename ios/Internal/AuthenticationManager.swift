import Foundation
import LocalAuthentication
import Security

/// Protocol for managing authentication and biometric operations.
///
/// Encapsulates all authentication prompt handling, LAContext creation,
/// and biometric evaluation. Follows Single Responsibility Principle.
///
/// @since 6.0.0
protocol AuthenticationManager {
  /// Create LAContext configured for the given authentication prompt.
  ///
  /// - Parameters:
  ///   - prompt: Optional authentication prompt with customization
  /// - Returns: Configured LAContext for biometric evaluation
  func makeLAContext(prompt: AuthenticationPrompt?) -> LAContext

  /// Perform Keychain query with authentication if needed.
  ///
  /// - Parameters:
  ///   - query: Base Keychain query
  ///   - prompt: Optional authentication prompt
  /// - Returns: Query result or nil if not found
  /// - Throws: RuntimeError if authentication fails
  func executeAuthenticatedQuery(
    _ query: [String: Any],
    prompt: AuthenticationPrompt?
  ) throws -> AnyObject?

  /// Check if error indicates authentication was canceled.
  ///
  /// - Parameters:
  ///   - status: OSStatus from Keychain operation
  /// - Returns: True if user canceled authentication
  func isAuthenticationCanceled(status: OSStatus) -> Bool

  /// Create error message for authentication-related OSStatus.
  ///
  /// - Parameters:
  ///   - status: OSStatus from operation
  /// - Returns: RuntimeError with appropriate message
  func makeAuthenticationError(for status: OSStatus) -> RuntimeError
}
