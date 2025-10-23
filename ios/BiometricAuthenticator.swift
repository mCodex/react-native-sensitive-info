import LocalAuthentication
import Security

/**
 * BiometricAuthenticator.swift
 *
 * Manages biometric authentication (Face ID, Touch ID) on iOS.
 *
 * **Architecture**:
 * - Uses LocalAuthentication framework (system-managed UI)
 * - Shows native Face ID or Touch ID prompt
 * - Handles device credential fallback (passcode/PIN)
 * - Automatic error handling and mapping
 *
 * **Security Properties**:
 * - User's biometric never exposed to app
 * - Authentication fails securely (no plaintext returned)
 * - OS manages biometric enrollment and device credential
 * - Fabric View support for modern UI integration
 *
 * # Example
 * ```swift
 * let authenticator = BiometricAuthenticator()
 *
 * let prompt = AuthenticationPrompt(
 *     title: "Unlock Token",
 *     description: "Authenticate to access your secure token"
 * )
 *
 * do {
 *     try await authenticator.authenticate(prompt)
 *     // User authenticated, proceed with decryption
 * } catch {
 *     // Handle authentication error
 * }
 * ```
 *
 * @see LAContext for documentation
 * @see LocalAuthentication framework
 */
class BiometricAuthenticator {

    /**
     * Checks if biometric authentication is available and enrolled.
     */
    func isBiometricAvailable() -> Bool {
        let context = LAContext()
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
    }

    /**
     * Checks if device has a passcode/PIN set.
     */
    func isDeviceCredentialAvailable() -> Bool {
        let context = LAContext()
        return context.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)
    }
    
    /**
     * Authenticates user with biometric or device credential.
     *
     * **Workflow**:
     * 1. Create LAContext for this authentication
     * 2. Build prompt with customizable text
     * 3. Request evaluation (Face ID, Touch ID, or passcode)
     * 4. Handle success/failure
     *
     * **Error Handling**:
     * - User cancels → E_AUTH_CANCELED
     * - Wrong biometric → E_AUTH_FAILED
     * - No biometric, fallback to passcode
     * - Too many failures → E_BIOMETRY_LOCKOUT
     *
     * - Parameter prompt: Customizable authentication prompt
     * - Parameter reason: (Deprecated, use prompt) Reason for authentication
     * - Throws: SensitiveInfoException if authentication fails
     *
     * # Example
     * ```swift
     * let prompt = AuthenticationPrompt(
     *     title: "Unlock Account",
     *     subtitle: "Biometric authentication required",
     *     description: "Access your session token"
     * )
     *
     * do {
     *     try await authenticator.authenticate(prompt)
     *     // Authenticated
     * } catch let error as SensitiveInfoException {
     *     switch error.code {
     *     case "E_AUTH_CANCELED":
     *         // User canceled
     *     case "E_AUTH_FAILED":
     *         // Failed, show retry UI
     *     default:
     *         print("Other error: \\(error)")
     *     }
     * }
     * ```
     */
    func authenticate(
        _ prompt: AuthenticationPrompt,
        reason: String? = nil
    ) async throws {
        let context = LAContext()
        context.localizedFallbackTitle = prompt.cancel

        var evaluateError: NSError?
        let policy = preferredPolicy(for: context)

        guard context.canEvaluatePolicy(policy, error: &evaluateError) else {
            if let evaluateError = evaluateError {
                throw mapError(evaluateError)
            }
            throw SensitiveInfoException.authenticationFailed("Authentication not available")
        }

        let reasonText = reason ?? prompt.localizedReason

        do {
            try await context.evaluatePolicy(policy, localizedReason: reasonText)
        } catch {
            throw mapError(error)
        }
    }

    // MARK: - Helpers

    private func preferredPolicy(for context: LAContext) -> LAPolicy {
        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) {
            return .deviceOwnerAuthenticationWithBiometrics
        }
        return .deviceOwnerAuthentication
    }
    
    /**
     * Maps iOS LocalAuthentication errors to SensitiveInfo error codes.
     *
     * - Parameter error: LA error
     * - Returns: Mapped SensitiveInfoException
     */
    private func mapError(_ error: Error) -> SensitiveInfoException {
        guard let laError = error as? LAError else {
            return SensitiveInfoException.authenticationFailed(error.localizedDescription)
        }
        
        switch laError.code {
        case .userCancel, .userFallback, .appCancel, .notInteractive:
            return SensitiveInfoException.authenticationCanceled
            
        case .authenticationFailed:
            return SensitiveInfoException.authenticationFailed(laError.friendlyMessage)
            
        case .touchIDLockout:
            return SensitiveInfoException.biometryLockout
            
        case .passcodeNotSet, .touchIDNotAvailable, .touchIDNotEnrolled:
            return SensitiveInfoException.authenticationFailed(laError.friendlyMessage)
            
        default:
            return SensitiveInfoException.authenticationFailed(laError.friendlyMessage)
        }
    }
}

/**
 * Customizable text for biometric authentication prompt.
 *
 * Shown in the OS-managed Face ID or Touch ID prompt.
 *
 * - Parameter title: Primary prompt title (required, e.g., "Unlock Account")
 * - Parameter subtitle: Optional secondary subtitle
 * - Parameter description: Optional detailed explanation
 * - Parameter cancel: Optional cancel button text (iOS only, usually "Cancel")
 *
 * # Example
 * ```swift
 * AuthenticationPrompt(
 *     title: "Unlock Your Account",
 *     subtitle: "Biometric authentication required",
 *     description: "Access your secure session token",
 *     cancel: "Cancel"
 * )
 * ```
 */
struct AuthenticationPrompt {
    let title: String
    let subtitle: String?
    let description: String?
    let cancel: String?
    
    init(
        title: String,
        subtitle: String? = nil,
        description: String? = nil,
        cancel: String? = nil
    ) {
        self.title = title
        self.subtitle = subtitle
        self.description = description
        self.cancel = cancel
    }
}

extension AuthenticationPrompt {
    /// Generates the best available localized reason for Keychain / LA prompts.
    var localizedReason: String {
        if let description = description, !description.isEmpty {
            return description
        }
        if let subtitle = subtitle, !subtitle.isEmpty {
            return subtitle
        }
        return title
    }
}
