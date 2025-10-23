import Foundation
import Security
import LocalAuthentication

/**
 * HybridSensitiveInfo.swift
 *
 * Universal platform implementation of the SensitiveInfo v5.6.0 API.
 *
 * Supports iOS, macOS, visionOS, and watchOS with unified Keychain integration.
 *
 * **Supported Platforms**:
 * - 🍎 iOS 13+ (iPhone, iPad)
 * - 🖥️ macOS 10.15+ (Intel, Apple Silicon)
 * - 👓 visionOS 1.0+ (Apple Vision Pro)
 * - ⌚ watchOS 6+ (Apple Watch)
 *
 * **Architecture**:
 * - Keychain for secure encrypted storage (platform-native)
 * - LocalAuthentication for biometric access (Face ID, Touch ID)
 * - Secure Enclave (iOS 16+, macOS 13+) for hardware-backed keys
 * - Pure Swift implementation (no Objective-C++ bridge)
 * - Automatic platform capability detection
 *
 * **Platform-Specific Features**:
 * - **iOS**: Face ID, Touch ID, Secure Enclave
 * - **macOS**: Touch ID (M1+), iCloud Keychain sync
 * - **visionOS**: Optic ID biometric support
 * - **watchOS**: Device passcode (no biometric, limited UI)
 *
 * **Security Model**:
 * 1. Secrets encrypted in Keychain (OS-managed)
 * 2. Hardware-backed encryption when available
 * 3. Secure Enclave isolation on supported platforms
 * 4. Biometric access control (platform-specific)
 * 5. Device credential fallback universal
 *
 * **v5 Compatibility**:
 * - 100% API-compatible with v5.0.0+ signatures
 * - Automatic transparent migration of v5 secrets
 * - Identical behavior and error codes
 *
 * # Example
 * ```swift
 * let sensitiveInfo = HybridSensitiveInfo()
 *
 * // Store with biometric protection (auto-adapts to platform)
 * try await sensitiveInfo.setItem(
 *     key: "auth-token",
 *     value: "jwt-xyz",
 *     service: "myapp",
 *     accessControl: "biometryOrDevicePasscode"
 * )
 *
 * // Retrieve (triggers biometric on iOS/macOS, passcode on watchOS)
 * if let item = try await sensitiveInfo.getItem(
 *     key: "auth-token",
 *     service: "myapp"
 * ) {
 *     print("Token: \\(item.value)")
 * }
 * ```
 *
 * @see KeychainManager for storage implementation
 * @see BiometricAuthenticator for authentication handling
 * @see AccessControlResolver for platform-aware policy resolution
 */
struct HybridSensitiveInfo {
    
    private let biometricAuthenticator = BiometricAuthenticator()
    private let defaultAccessControlName = "secureEnclaveBiometry"

    // MARK: - Helpers

    private func resolveService(_ service: String?) -> String {
        guard let service = service?.trimmingCharacters(in: .whitespacesAndNewlines), !service.isEmpty else {
            return Bundle.main.bundleIdentifier ?? "default"
        }
        return service
    }

    private func keychain(for service: String?) -> KeychainManager {
        KeychainManager(service: resolveService(service))
    }

    private func resolveAccessControl(_ preference: String?) throws -> (config: AccessControlConfig, control: SecAccessControl?) {
        let config = AccessControlResolver.resolve(preference)
        let control = try config.makeSecAccessControl()
        return (config, control)
    }

    private func ensureAuthenticationIfNeeded(
        config: AccessControlConfig,
        prompt: AuthenticationPrompt?
    ) async throws {
        guard config.biometric else { return }
        let promptToUse = prompt ?? AuthenticationPrompt(title: "Authenticate")
        try await biometricAuthenticator.authenticate(promptToUse)
    }

    private func makeMetadata(from metadata: KeychainItemMetadata?) -> StorageMetadata {
        StorageMetadata(
            securityLevel: metadata?.securityLevel ?? "software",
            accessControl: metadata?.accessControl ?? defaultAccessControlName,
            backend: "keychain",
            timestamp: metadata?.timestamp ?? currentTimestamp()
        )
    }

    private func currentTimestamp() -> TimeInterval {
        Date().timeIntervalSince1970
    }
    
    /**
     * Stores a secret in secure Keychain storage.
     *
     * **Workflow**:
     * 1. Resolve service name (defaults to app bundle ID)
     * 2. Resolve access control policy
     * 3. Create Keychain access control if needed
     * 4. Store in Keychain
     * 5. Return metadata
     *
     * **Automatic Security**:
     * - Keychain encrypts value automatically
     * - Biometric access control enforced by OS
     * - Device credential fallback always available
     * - Secure Enclave used if available
     *
     * - Parameter key: Unique identifier within service
     * - Parameter value: Secret value to store
     * - Parameter service: Service namespace (defaults to bundle ID)
     * - Parameter accessControl: Access control policy (defaults to "secureEnclaveBiometry")
    * - Parameter authenticationPrompt: Custom prompt shown before secure operations
     * - Returns: Metadata describing security level
     * - Throws: SensitiveInfoException if storage fails
     *
     * # Example
     * ```swift
     * let result = try await sensitiveInfo.setItem(
     *     key: "api-key",
     *     value: "sk-123abc",
     *     service: "myapp",
     *     accessControl: "secureEnclaveBiometry"
     * )
     *
     * print("Stored with level: \\(result.metadata.securityLevel)")
     * // Output: "Stored with level: biometry"
     * ```
     */
    func setItem(
        key: String,
        value: String,
        service: String? = nil,
        accessControl: String? = nil,
        authenticationPrompt: AuthenticationPrompt? = nil
    ) async throws -> StorageResult {
        let (config, control) = try resolveAccessControl(accessControl)
        try await ensureAuthenticationIfNeeded(config: config, prompt: authenticationPrompt)

        let now = currentTimestamp()
        let secureEnclaveEnabled = config.secureEnclave && isSecureEnclaveAvailable()
        let metadata = config.metadata(timestamp: now, secureEnclaveActive: secureEnclaveEnabled)

        let keychain = keychain(for: service)
        try keychain.set(
            key: key,
            value: value,
            accessControl: control,
            useSecureEnclave: secureEnclaveEnabled,
            metadata: metadata
        )

        return StorageResult(metadata: makeMetadata(from: metadata))
    }
    
    /**
     * Retrieves and decrypts a secret from Keychain.
     *
     * **Automatic Security**:
     * - If value requires biometric, OS prompts user
     * - Biometric authentication happens in hardware if available
     * - Value never exposed in plaintext until user authenticates
     *
     * **Workflow**:
     * 1. Resolve service name
     * 2. Look up in Keychain
     * 3. Decrypt (may trigger biometric prompt)
     * 4. Return plaintext with metadata
     *
     * - Parameter key: Unique identifier within service
     * - Parameter service: Service namespace (defaults to bundle ID)
     * - Parameter authenticationPrompt: Customize biometric prompt
     * - Returns: Secret with metadata, or nil if not found
     * - Throws: SensitiveInfoException if retrieval/decryption fails
     *
     * # Example
     * ```swift
     * if let item = try await sensitiveInfo.getItem(
     *     key: "api-key",
     *     service: "myapp"
     * ) {
     *     print("API Key: \\(item.value)")
     *     print("Security: \\(item.metadata.securityLevel)")
     * } else {
     *     print("API key not found")
     * }
     * ```
     */
    func getItem(
        key: String,
        service: String? = nil,
        authenticationPrompt: AuthenticationPrompt? = nil
    ) async throws -> SensitiveInfoItem? {
        let resolvedService = resolveService(service)
        let keychain = keychain(for: service)

        guard let payload = try keychain.get(key: key, prompt: authenticationPrompt) else {
            return nil
        }

        return SensitiveInfoItem(
            key: key,
            service: resolvedService,
            value: payload.value,
            metadata: makeMetadata(from: payload.metadata)
        )
    }
    
    /**
     * Deletes a secret from Keychain.
     *
     * **Warning**: This is irreversible!
     *
     * - Parameter key: Unique identifier within service
     * - Parameter service: Service namespace (defaults to bundle ID)
     * - Throws: SensitiveInfoException if deletion fails
     *
     * # Example
     * ```swift
     * try await sensitiveInfo.deleteItem(
     *     key: "api-key",
     *     service: "myapp"
     * )
     * print("API key deleted")
     * ```
     */
    func deleteItem(
        key: String,
        service: String? = nil
    ) async throws {
        try keychain(for: service).delete(key: key)
    }
    
    /**
     * Checks if a secret exists.
     *
     * Does NOT decrypt or require authentication.
     * Useful for checking presence before attempting retrieval.
     *
     * - Parameter key: Unique identifier within service
     * - Parameter service: Service namespace (defaults to bundle ID)
     * - Returns: true if secret exists
     *
     * # Example
     * ```swift
     * if await sensitiveInfo.hasItem(key: "auth-token", service: "myapp") {
     *     let item = try await sensitiveInfo.getItem(key: "auth-token")
     * } else {
     *     showLoginScreen()
     * }
     * ```
     */
    func hasItem(
        key: String,
        service: String? = nil
    ) async -> Bool {
        keychain(for: service).exists(key: key)
    }
    
    /**
     * Lists all secret keys in a service.
     *
     * Does NOT retrieve values, just key names.
     *
     * - Parameter service: Service namespace (defaults to bundle ID)
     * - Returns: Array of key names
     * - Throws: SensitiveInfoException if lookup fails
     *
     * # Example
     * ```swift
     * let keys = try await sensitiveInfo.getAllItems(service: "myapp")
     * for key in keys {
     *     print("Found key: \\(key)")
     * }
     * ```
     */
    func getAllItems(service: String? = nil) async throws -> [String] {
        try keychain(for: service).allKeys()
    }
    
    /**
     * Deletes all secrets in a service.
     *
     * **Warning**: This is irreversible!
     *
     * - Parameter service: Service namespace (defaults to bundle ID)
     * - Throws: SensitiveInfoException if operation fails
     *
     * # Example
     * ```swift
     * // On logout, clear all app secrets
     * try await sensitiveInfo.clearService(service: "myapp")
     * ```
     */
    func clearService(service: String? = nil) async throws {
        try keychain(for: service).deleteAll()
    }
    
    /**
     * Gets supported security levels on this device.
     *
     * Use to determine which security features can be offered to users.
     *
     * **Returns**:
     * - biometry: Face ID or Touch ID available
     * - deviceCredential: Device passcode/PIN set
     * - secureEnclave: iOS 16+ with hardware support
     * - software: Software-only (always available as fallback)
     *
     * - Returns: Availability of each security level
     *
     * # Example
     * ```swift
     * let caps = try await sensitiveInfo.getSupportedSecurityLevels()
     *
     * if caps.biometry {
     *     showBiometricOption()
     * } else if caps.deviceCredential {
     *     showPasscodeOption()
     * } else {
     *     showSoftwareOnlyWarning()
     * }
     * ```
     */
    func getSupportedSecurityLevels() async throws -> SecurityAvailability {
        return SecurityAvailability(
            secureEnclave: isSecureEnclaveAvailable(),
            biometry: biometricAuthenticator.isBiometricAvailable(),
            deviceCredential: biometricAuthenticator.isDeviceCredentialAvailable()
        )
    }
    
    /**
     * Checks if Secure Enclave is available.
     *
     * **Platform Support**:
     * - iOS 16+ (A7+ chips)
     * - macOS 13+ (Apple Silicon)
     * - visionOS 1.0+
     * - watchOS: Not supported
     *
     * - Returns: true if platform supports Secure Enclave
     */
    private func isSecureEnclaveAvailable() -> Bool {
        #if os(iOS)
        return ProcessInfo.processInfo.isOperatingSystemAtLeast(
            OperatingSystemVersion(majorVersion: 16, minorVersion: 0, patchVersion: 0)
        )
        #elseif os(macOS)
        return ProcessInfo.processInfo.isOperatingSystemAtLeast(
            OperatingSystemVersion(majorVersion: 13, minorVersion: 0, patchVersion: 0)
        )
        #elseif os(visionOS)
        return true  // All visionOS versions support Secure Enclave
        #elseif os(watchOS)
        return false  // watchOS doesn't support Secure Enclave
        #else
        return false
        #endif
    }
    
}

// MARK: - Data Types

/**
 * Result of a storage operation.
 */
struct StorageResult {
    let metadata: StorageMetadata
}

/**
 * A stored secret with metadata.
 */
struct SensitiveInfoItem {
    let key: String
    let service: String
    let value: String
    let metadata: StorageMetadata
}

/**
 * Metadata describing how a secret is protected.
 */
struct StorageMetadata {
    let securityLevel: String  // "biometry", "deviceCredential", "secureEnclave", "software"
    let accessControl: String  // "secureEnclaveBiometry", "devicePasscode", etc
    let backend: String        // "keychain"
    let timestamp: TimeInterval
}

/**
 * Available security features on the device.
 */
struct SecurityAvailability {
    let secureEnclave: Bool
    let biometry: Bool
    let deviceCredential: Bool
}
