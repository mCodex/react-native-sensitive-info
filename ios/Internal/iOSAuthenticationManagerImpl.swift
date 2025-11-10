import Foundation
import LocalAuthentication
import Security
import NitroModules

/// Concrete implementation of AuthenticationManager for iOS.
///
/// Handles all biometric and authentication operations:
/// - LAContext creation and configuration
/// - Biometric evaluation on simulator
/// - Error mapping for authentication failures
/// - Custom prompt handling
///
/// @since 6.0.0
final class iOSAuthenticationManager: AuthenticationManager {
  
  // MARK: - AuthenticationManager Implementation

  func makeLAContext(prompt: AuthenticationPrompt?) -> LAContext {
    let context = LAContext()

    if let cancel = prompt?.cancel {
      context.localizedCancelTitle = cancel
    }

    if let description = prompt?.description {
      context.localizedReason = description
    } else if let title = prompt?.title {
      context.localizedReason = title
    }

    if let subtitle = prompt?.subtitle {
      context.localizedFallbackTitle = subtitle
    }

    return context
  }

  func executeAuthenticatedQuery(
    _ query: [String: Any],
    prompt: AuthenticationPrompt?
  ) throws -> AnyObject? {
#if targetEnvironment(simulator)
    try performSimulatorBiometricPromptIfNeeded(prompt: prompt)
#endif

    var result: CFTypeRef?
    var status = SecItemCopyMatching(query as CFDictionary, &result)

    if status == errSecInteractionNotAllowed || status == errSecAuthFailed {
      var authQuery = query
      authQuery[kSecUseOperationPrompt as String] = prompt?.title ?? "Authenticate to access sensitive data"
      let context = makeLAContext(prompt: prompt)
      authQuery[kSecUseAuthenticationContext as String] = context
      status = SecItemCopyMatching(authQuery as CFDictionary, &result)
    }

    switch status {
    case errSecSuccess:
      return result as AnyObject?
    case errSecItemNotFound:
      return nil
    default:
      throw makeError(for: status, operation: "fetch")
    }
  }

  func isAuthenticationCanceled(status: OSStatus) -> Bool {
    status == errSecUserCanceled
  }

  func makeAuthenticationError(for status: OSStatus) -> RuntimeError {
    if isAuthenticationCanceled(status: status) {
      return RuntimeError.error(withMessage: "[E_AUTH_CANCELED] Authentication prompt canceled by the user.")
    }
    let message = SecCopyErrorMessageString(status, nil) as String? ?? "OSStatus(\(status))"
    return RuntimeError.error(withMessage: "Authentication failed: \(message)")
  }

  // MARK: - Private Helpers

  private func makeError(for status: OSStatus, operation: String) -> RuntimeError {
    if isAuthenticationCanceled(status: status) {
      return RuntimeError.error(withMessage: "[E_AUTH_CANCELED] Authentication prompt canceled by the user.")
    }
    let message = SecCopyErrorMessageString(status, nil) as String? ?? "OSStatus(\(status))"
    return RuntimeError.error(withMessage: "Keychain \(operation) failed: \(message)")
  }

#if targetEnvironment(simulator)
  private func performSimulatorBiometricPromptIfNeeded(prompt: AuthenticationPrompt?) throws {
    guard let prompt else { return }

    let context = makeLAContext(prompt: prompt)
    var error: NSError?

    guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error),
          context.biometryType != .none else {
      return
    }

    let reason = prompt.description ?? prompt.title ?? "Authenticate to continue"
    let semaphore = DispatchSemaphore(value: 0)
    var evaluationError: Error?

    DispatchQueue.main.async {
      context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, policyError in
        if !success {
          evaluationError = policyError
        }
        semaphore.signal()
      }
    }

    semaphore.wait()

    if let evaluationError {
      if let laError = evaluationError as? LAError {
        switch laError.code {
        case .userCancel, .userFallback, .systemCancel:
          throw RuntimeError.error(withMessage: "[E_AUTH_CANCELED] Authentication prompt canceled by the user.")
        default:
          break
        }
      }

      throw RuntimeError.error(withMessage: "Keychain fetch failed: \(evaluationError.localizedDescription)")
    }
  }
#endif
}
