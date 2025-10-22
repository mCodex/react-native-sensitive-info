import Foundation

/**
 * SensitiveInfoException.swift
 *
 * Error types for SensitiveInfo operations.
 *
 * Provides platform-agnostic error codes that map to JavaScript error codes.
 * Used for consistent error handling across iOS and Android.
 */

enum SensitiveInfoException: Error {
    
    /// The requested secret was not found.
    case notFound(key: String, service: String)
    
    /// The stored key has been invalidated (biometric enrollment changed).
    case keyInvalidated(key: String)
    
    /// User canceled authentication.
    case authenticationCanceled
    
    /// Biometric authentication failed.
    case authenticationFailed(_ reason: String)
    
    /// Biometric is locked out after too many attempts.
    case biometryLockout
    
    /// Keychain is unavailable.
    case keychainUnavailable(_ reason: String)
    
    /// Encryption operation failed.
    case encryptionFailed(_ reason: String)
    
    /// Decryption operation failed.
    case decryptionFailed(_ reason: String)
    
    /// Invalid configuration.
    case invalidConfiguration(_ parameter: String, _ reason: String)
    
    /// Maps error to JavaScript error code.
    var code: String {
        switch self {
        case .notFound:
            return "E_NOT_FOUND"
        case .keyInvalidated:
            return "E_KEY_INVALIDATED"
        case .authenticationCanceled:
            return "E_AUTH_CANCELED"
        case .authenticationFailed:
            return "E_AUTH_FAILED"
        case .biometryLockout:
            return "E_BIOMETRY_LOCKOUT"
        case .keychainUnavailable:
            return "E_KEYSTORE_UNAVAILABLE"
        case .encryptionFailed:
            return "E_ENCRYPTION_FAILED"
        case .decryptionFailed:
            return "E_DECRYPTION_FAILED"
        case .invalidConfiguration:
            return "E_INVALID_CONFIGURATION"
        }
    }
    
    /// Human-readable error message.
    var message: String {
        switch self {
        case .notFound(let key, let service):
            return "Secret '\(key)' not found in service '\(service)'"
        case .keyInvalidated(let key):
            return "Key '\(key)' has been invalidated (biometric enrollment changed?)"
        case .authenticationCanceled:
            return "User canceled authentication"
        case .authenticationFailed(let reason):
            return "Biometric authentication failed: \(reason)"
        case .biometryLockout:
            return "Biometric authentication is locked out. Use device passcode to unlock."
        case .keychainUnavailable(let reason):
            return "Keychain unavailable: \(reason)"
        case .encryptionFailed(let reason):
            return "Encryption failed: \(reason)"
        case .decryptionFailed(let reason):
            return "Decryption failed: \(reason)"
        case .invalidConfiguration(let parameter, let reason):
            return "Invalid configuration for '\(parameter)': \(reason)"
        }
    }
    
    var localizedDescription: String {
        message
    }
}
