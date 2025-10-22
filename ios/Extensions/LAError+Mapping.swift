import LocalAuthentication

/**
 * LAError+Mapping.swift
 *
 * Maps LocalAuthentication errors to SensitiveInfo error codes.
 *
 * Translates iOS-specific biometric errors to platform-agnostic codes
 * for consistent error handling in JavaScript.
 */

extension LAError {
    
    /// Maps LocalAuthentication error to SensitiveInfo error code.
    ///
    /// Translates iOS-specific biometric errors to codes that match
    /// Android error codes for consistent cross-platform error handling.
    ///
    /// - Returns: Error code string (e.g., "E_AUTH_FAILED")
    var sensitiveInfoCode: String {
        switch self.code {
        case .userCancel:
            return "E_AUTH_CANCELED"
        case .userFallback:
            return "E_AUTH_CANCELED"
        case .authenticationFailed:
            return "E_AUTH_FAILED"
        case .invalidContext:
            return "E_AUTH_FAILED"
        case .notInteractive:
            return "E_AUTH_CANCELED"
        case .passcodeNotSet:
            return "E_KEYSTORE_UNAVAILABLE"
        case .touchIDNotAvailable:
            return "E_AUTH_FAILED"
        case .touchIDNotEnrolled:
            return "E_AUTH_FAILED"
        case .touchIDLockout:
            return "E_BIOMETRY_LOCKOUT"
        case .appCancel:
            return "E_AUTH_CANCELED"
        case .invalidDimensions:
            return "E_AUTH_FAILED"
        case .deviceOwnerAuthenticationRequired:
            return "E_AUTH_FAILED"
        @unknown default:
            return "E_AUTH_FAILED"
        }
    }
    
    /// Localized message for this error.
    ///
    /// Returns a user-friendly error description.
    ///
    /// - Returns: Error message
    var friendlyMessage: String {
        switch self.code {
        case .userCancel, .userFallback, .appCancel, .notInteractive:
            return "Authentication was canceled"
        case .authenticationFailed:
            return "Authentication failed. Please try again."
        case .passcodeNotSet:
            return "Device passcode is not set"
        case .touchIDNotAvailable, .touchIDNotEnrolled:
            return "Face ID or Touch ID is not available"
        case .touchIDLockout:
            return "Too many failed authentication attempts. Please use device passcode."
        case .invalidContext:
            return "Invalid authentication context"
        case .invalidDimensions:
            return "Invalid context dimensions"
        case .deviceOwnerAuthenticationRequired:
            return "Device owner authentication is required"
        @unknown default:
            return "Authentication error"
        }
    }
}
