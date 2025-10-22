import LocalAuthentication
import Security
import Foundation

/**
 * AccessControlResolver.swift
 *
 * Maps user-facing access control preferences to Keychain SecAccessControl policies.
 *
 * **What this does**:
 * - Converts high-level options like "secureEnclaveBiometry" to Keychain flags
 * - Handles API version differences (iOS 16+ for Secure Enclave)
 * - Provides fallback strategies when requested features unavailable
 *
 * **Security Decisions**:
 * - Secure Enclave (iOS 16+): Strongest isolation, key never leaves enclave
 * - Biometric: Face/Touch ID protection, user-friendly
 * - Device Credential: Passcode/PIN, always available
 * - Software: No additional access control
 *
 * **API Versions**:
 * - iOS 16+: Can use Secure Enclave explicitly via SecAccessControl
 * - iOS 11-15: Keychain provides best available (usually software)
 * - iOS 10: Limited to basic access control options
 */
struct AccessControlResolver {
    
    /**
     * Resolves access control preference to concrete Keychain policy.
     *
     * Maps high-level API options to SecAccessControl flags.
     *
     * - Parameter preference: User-requested access control (e.g., "secureEnclaveBiometry")
     * - Returns: Resolved configuration with flags and metadata
     *
     * # Example
     * ```swift
     * let config = AccessControlResolver.resolve("secureEnclaveBiometry")
     * // Returns: Biometric policy with Secure Enclave request
     * ```
     */
    static func resolve(_ preference: String?) -> AccessControlConfig {
        switch preference {
        case "secureEnclaveBiometry":
            // Strongest: Secure Enclave + Biometric
            return AccessControlConfig(
                flags: [.biometryCurrentSet, .userPresence],
                secureEnclave: true,
                biometric: true,
                securityLevel: "biometry"
            )
            
        case "biometryCurrentSet":
            // Biometric protection (enrollment-specific)
            return AccessControlConfig(
                flags: [.biometryCurrentSet, .userPresence],
                secureEnclave: false,
                biometric: true,
                securityLevel: "biometry"
            )
            
        case "biometryAny":
            // Biometric protection (any enrollment)
            return AccessControlConfig(
                flags: [.biometryAny, .userPresence],
                secureEnclave: false,
                biometric: true,
                securityLevel: "biometry"
            )
            
        case "devicePasscode":
            // Device credential protection
            return AccessControlConfig(
                flags: [.userPresence],
                secureEnclave: false,
                biometric: false,
                securityLevel: "deviceCredential"
            )
            
        case "none":
            // No additional access control
            return AccessControlConfig(
                flags: [],
                secureEnclave: false,
                biometric: false,
                securityLevel: "software"
            )
            
        default:
            // Default to strongest available
            return resolve("secureEnclaveBiometry")
        }
    }
}

/**
 * Resolved access control configuration.
 */
struct AccessControlConfig {
    /// SecAccessControl flags to apply
    let flags: [SecAccessControlCreateFlags]
    
    /// Should request Secure Enclave (iOS 16+)
    let secureEnclave: Bool
    
    /// Does this require biometric?
    let biometric: Bool
    
    /// Resulting security level for reporting
    let securityLevel: String
    
    /**
     * Creates Keychain access control object.
     *
     * - Returns: SecAccessControl, or nil if creation fails
     */
    func createSecAccessControl() -> SecAccessControl? {
        var error: Unmanaged<CFError>?
        
        let flags: SecAccessControlCreateFlags = self.flags.isEmpty ? [] : self.flags.reduce([], { combined, flag in
            combined.union(flag)
        })
        
        guard let accessControl = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            flags,
            &error
        ) else {
            return nil
        }
        
        return (accessControl as SecAccessControl)
    }
}
