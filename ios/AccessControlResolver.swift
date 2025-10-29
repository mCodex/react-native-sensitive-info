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
            // Strongest: Secure Enclave + Biometric (current set)
            return AccessControlConfig(
                preference: "secureEnclaveBiometry",
                flags: [.biometryCurrentSet],
                secureEnclave: true,
                biometric: true,
                securityLevel: "secureEnclave"
            )

        case "biometryCurrentSet":
            return AccessControlConfig(
                preference: "biometryCurrentSet",
                flags: [.biometryCurrentSet],
                secureEnclave: false,
                biometric: true,
                securityLevel: "biometry"
            )

        case "biometryAny":
            return AccessControlConfig(
                preference: "biometryAny",
                flags: [.biometryAny],
                secureEnclave: false,
                biometric: true,
                securityLevel: "biometry"
            )

        case "devicePasscode":
            return AccessControlConfig(
                preference: "devicePasscode",
                flags: [.devicePasscode],
                secureEnclave: false,
                biometric: false,
                securityLevel: "deviceCredential"
            )

        case "none":
            return AccessControlConfig(
                preference: "none",
                flags: [],
                secureEnclave: false,
                biometric: false,
                securityLevel: "software"
            )

        default:
            return resolve("secureEnclaveBiometry")
        }
    }
}

/**
 * Resolved access control configuration.
 */
struct AccessControlConfig {
    /// Original preference string (echoed back to JS metadata)
    let preference: String

    /// SecAccessControl flags to apply
    let flags: SecAccessControlCreateFlags

    /// Should request Secure Enclave (iOS 16+)
    let secureEnclave: Bool

    /// Does this require biometric?
    let biometric: Bool

    /// Resulting security level for reporting
    let securityLevel: String

    /**
     * Creates Keychain access control object if flags are present.
     *
     * - Returns: SecAccessControl or nil when no access control required
     * - Throws: SensitiveInfoException when creation fails
     */
    func makeSecAccessControl() throws -> SecAccessControl? {
        guard !flags.isEmpty else {
            return nil
        }

        var error: Unmanaged<CFError>?
        guard let control = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            flags,
            &error
        ) else {
            let reason = (error?.takeRetainedValue() as Error?)?.localizedDescription ?? "Unknown error"
            throw SensitiveInfoException.encryptionFailed("Failed to create access control: \(reason)")
        }

        return control
    }

    /// Encodes metadata for persistence in Keychain attributes.
    func metadata(
        timestamp: TimeInterval = Date().timeIntervalSince1970,
        secureEnclaveActive: Bool? = nil
    ) -> KeychainItemMetadata {
        let effectiveLevel: String

        if secureEnclave,
           let secureEnclaveActive = secureEnclaveActive,
           !secureEnclaveActive {
            // Secure Enclave requested but unavailable; downgrade to next best level.
            effectiveLevel = biometric ? "biometry" : "deviceCredential"
        } else {
            effectiveLevel = securityLevel
        }

        return KeychainItemMetadata(
            accessControl: preference,
            securityLevel: effectiveLevel,
            timestamp: timestamp
        )
    }
}

// MARK: - Keychain Metadata Encoding

/// Lightweight metadata persisted alongside Keychain values.
struct KeychainItemMetadata: Codable {
    let accessControl: String
    let securityLevel: String
    let timestamp: TimeInterval

    /// Encodes metadata as Data suitable for kSecAttrGeneric.
    func encoded() -> Data? {
        try? JSONEncoder().encode(self)
    }

    /// Decodes metadata from Keychain attributes.
    static func decode(_ data: Data) -> KeychainItemMetadata? {
        try? JSONDecoder().decode(KeychainItemMetadata.self, from: data)
    }
}
