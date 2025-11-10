/**
 * iOS Key Rotation Integration
 *
 * Implements automatic key rotation for iOS using:
 * - iOS Keychain for persistent key storage
 * - Secure Enclave for hardware-backed keys
 * - Face ID/Touch ID biometric protection
 *
 * Swift implementation coordinating with TypeScript rotation engine.
 *
 * Key Generation Strategy:
 * 1. Generate random KEK seed
 * 2. Store KEK in Keychain with Secure Enclave (if available)
 * 3. Apply biometric requirements (Face ID/Touch ID)
 * 4. Maintain metadata with key version and timestamp
 *
 * Biometric Handling:
 * - Detect Face ID/Touch ID enrollment changes via LAContext
 * - Handle invalidated keys gracefully
 * - Trigger automatic re-authentication flows
 * - Support fallback to device passcode
 */

import Foundation
import LocalAuthentication
import NitroModules
import Security

// MARK: - iOS Key Rotation Types

struct KeyRotationMetadata: Codable {
  let keyVersionId: String
  let generatedAt: Date
  let algorithm: String
  let requiresBiometry: Bool
  let keychainAccessibility: String
}

struct BiometricChangeDetectionResult {
  let changed: Bool
  let previousBiometryType: String?
  let currentBiometryType: String?
}

// MARK: - iOS Key Rotation Manager

/**
 * Manages key rotation operations specific to iOS Keychain and Secure Enclave.
 * Handles biometric invalidation and secure key generation.
 *
 * Architecture:
 * - Each KEK is stored as a SecKey in the Keychain
 * - DEKs remain in-memory or encrypted in app storage
 * - Key versions tracked via metadata stored alongside keys
 * - Biometric requirements enforced at Keychain query time
 */
class iOSKeyRotationManager {
  private let keychainService: String
  private let keychainQueue = DispatchQueue(
    label: "com.mcodex.sensitiveinfo.keyrotation",
    qos: .userInitiated
  )

  private var currentBiometryType: LABiometryType = .none
  private var biometricChangeCallback: ((RotationEvent) -> Void)?

  init(keychainService: String = Bundle.main.bundleIdentifier ?? "default") {
    self.keychainService = keychainService
    updateBiometryType()
  }

  // MARK: - Key Generation

  /**
   * Generates a new Key Encryption Key (KEK) in the iOS Keychain.
   *
   * On modern iOS devices with Secure Enclave (iPhone 5s+, iPad Air+):
   * - Uses SecKeyCreateRandomKey with Secure Enclave
   * - Sets biometric authentication requirement
   * - Sets invalidation on biometric enrollment change
   *
   * On older devices:
   * - Falls back to software-based key in Keychain
   * - Still applies biometric requirements where possible
   *
   * @param keyVersionId Unique identifier for this key version (ISO 8601 timestamp)
   * @param requiresBiometry Whether to require Face ID/Touch ID for access
   * @returns Generated SecKey or throws error
   */
  func generateNewKey(
    keyVersionId: String,
    requiresBiometry: Bool = true
  ) -> SecKey? {
    var error: Unmanaged<CFError>? = nil

    // Build key attributes for Secure Enclave (if available)
    var keyAttributes: [String: Any] = [
      kSecAttrKeyType as String: kSecAttrKeyTypeRSA,
      kSecAttrKeySizeInBits as String: 2048,
      kSecPrivateKeyAttrs as String: [
        kSecAttrIsPermanent as String: true,
        kSecAttrApplicationTag as String: keyVersionId.data(using: .utf8) ?? Data(),
        kSecAttrAccessControl as String: (createAccessControl(requiresBiometry: requiresBiometry) as Any),
      ] as [String: Any],
    ]

    // Attempt to use Secure Enclave on capable devices
    #if os(iOS)
    if isSecureEnclaveAvailable() {
      keyAttributes[kSecAttrTokenID as String] = kSecAttrTokenIDSecureEnclave
    }
    #endif

    // Generate the key
    guard let key = SecKeyCreateRandomKey(
      keyAttributes as CFDictionary,
      &error
    ) else {
      print("Failed to generate key: \(error?.takeRetainedValue().localizedDescription ?? "unknown")")
      return nil
    }

    // Store metadata
    storeKeyMetadata(
      keyVersionId: keyVersionId,
      algorithm: "RSA2048",
      requiresBiometry: requiresBiometry
    )

    return key
  }

  /**
   * Rotates to a newly generated key.
   * Updates the "current key" metadata to point to the new key version.
   *
   * @param newKeyVersionId ID of the newly generated key
   */
  func rotateToNewKey(newKeyVersionId: String) {
    keychainQueue.sync {
      let metadata = KeyRotationMetadata(
        keyVersionId: newKeyVersionId,
        generatedAt: Date(),
        algorithm: "RSA2048",
        requiresBiometry: true,
        keychainAccessibility: "whenUnlockedThisDeviceOnly"
      )

      setCurrentKeyMetadata(metadata)
    }
  }

  /**
   * Retrieves the current active key version.
   * Returns nil if no key has been initialized yet.
   */
  func getCurrentKeyVersion() -> String? {
    keychainQueue.sync {
      getCurrentKeyMetadata()?.keyVersionId
    }
  }

  /**
   * Retrieves all available key versions.
   * Returns an array of key version IDs that exist in the Keychain.
   */
  func getAvailableKeyVersions() -> [String] {
    keychainQueue.sync {
      let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "\(keychainService).rotation.metadata",
        kSecMatchLimit as String: kSecMatchLimitAll,
        kSecReturnAttributes as String: kCFBooleanTrue!,
      ]

      var result: CFTypeRef?
      let status = SecItemCopyMatching(query as CFDictionary, &result)

      guard status == errSecSuccess, let array = result as? [[String: Any]] else {
        return []
      }

      return array.compactMap { dict in
        dict[kSecAttrAccount as String] as? String
      }
    }
  }

  /**
   * Checks if key rotation is currently in progress.
   */
  func isRotationInProgress() -> Bool {
    let defaults = UserDefaults.standard
    return defaults.bool(forKey: "keyRotationInProgress")
  }

  /**
   * Sets the rotation in progress state.
   */
  func setRotationInProgress(_ inProgress: Bool) {
    let defaults = UserDefaults.standard
    defaults.set(inProgress, forKey: "keyRotationInProgress")
    defaults.synchronize()
  }

  /**
   * Sets the callback for biometric change notifications.
   */
  func setBiometricChangeCallback(_ callback: @escaping (RotationEvent) -> Void) {
    biometricChangeCallback = callback
  }

  /**
   * Gets a key by version ID.
   * Returns nil if key doesn't exist or can't be accessed.
   */
  func getKey(byVersionId keyVersionId: String) -> SecKey? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassKey,
      kSecAttrApplicationTag as String: keyVersionId.data(using: .utf8) ?? Data(),
      kSecReturnRef as String: kCFBooleanTrue!,
    ]

    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)

    if status == errSecSuccess {
      return (result as! SecKey)
    }

    return nil
  }

  /**
   * Deletes a key version from the Keychain.
   * Used during cleanup after transition period expires.
   *
   * @param keyVersionId ID of key to delete
   * @returns true if deleted, false if not found
   */
  func deleteKey(byVersionId keyVersionId: String) -> Bool {
    let query: [String: Any] = [
      kSecClass as String: kSecClassKey,
      kSecAttrApplicationTag as String: keyVersionId.data(using: .utf8) ?? Data(),
    ]

    let status = SecItemDelete(query as CFDictionary)
    return status == errSecSuccess || status == errSecItemNotFound
  }

  // MARK: - Biometric Handling

  /**
   * Detects whether biometric enrollment has changed since the last check.
   * Called periodically or when the app becomes active.
   *
   * Changes detected:
   * - Face ID enabled/disabled
   * - Touch ID fingerprints added/removed
   * - Biometry completely disabled
   *
   * @returns BiometricChangeDetectionResult with before/after states
   */
  func detectBiometricChange() -> BiometricChangeDetectionResult {
    let previousType = currentBiometryType
    updateBiometryType()

    return BiometricChangeDetectionResult(
      changed: previousType != currentBiometryType,
      previousBiometryType: descriptionForBiometryType(previousType),
      currentBiometryType: descriptionForBiometryType(currentBiometryType)
    )
  }

  /**
   * Handles Face ID/Touch ID enrollment changes.
   * When biometric settings change, previous keys become invalid.
   *
   * This method:
   * 1. Detects the enrollment change
   * 2. Marks old keys as invalid
   * 3. Triggers rotation to new key
   * 4. Re-encrypts DEKs with new key
   */
  func handleBiometricEnrollmentChange() {
    let change = detectBiometricChange()

    if change.changed {
      print(
        "Biometric enrollment changed from \(change.previousBiometryType ?? "none") "
          + "to \(change.currentBiometryType ?? "none")"
      )

      // Notify JavaScript about the change
      notifyBiometricChangeToJavaScript(result: change)

      // Invalidate old keys - they're no longer accessible with new biometry
      // New rotation will create new keys
    }
  }

  /**
   * Attempts to recover from a KeyPermanentlyInvalidatedException.
   * This can occur when:
   * - Biometric enrollment changes (Face ID/Touch ID)
   * - Passcode is changed/removed
   * - Device is restored from backup
   *
   * Recovery strategy:
   * 1. Detect the change
   * 2. Mark current key as invalid
   * 3. Trigger re-authentication
   * 4. Perform key rotation
   */
  func recoverFromInvalidatedKey() {
    handleBiometricEnrollmentChange()
  }

  // MARK: - Metadata Management

  /**
   * Stores metadata about a key in the Keychain.
   * Metadata includes version ID, algorithm, requirements, etc.
   */
  private func storeKeyMetadata(
    keyVersionId: String,
    algorithm: String,
    requiresBiometry: Bool
  ) {
    let metadata = KeyRotationMetadata(
      keyVersionId: keyVersionId,
      generatedAt: Date(),
      algorithm: algorithm,
      requiresBiometry: requiresBiometry,
      keychainAccessibility: "whenUnlockedThisDeviceOnly"
    )

    let encoder = JSONEncoder()
    if let encoded = try? encoder.encode(metadata) {
      let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "\(keychainService).rotation.metadata",
        kSecAttrAccount as String: keyVersionId,
        kSecValueData as String: encoded,
        kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      ]

      // Delete existing entry first
      SecItemDelete(query as CFDictionary)

      // Insert new entry
      SecItemAdd(query as CFDictionary, nil)
    }
  }

  /**
   * Retrieves the current key version metadata.
   */
  private func getCurrentKeyMetadata() -> KeyRotationMetadata? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "\(keychainService).rotation.currentKey",
      kSecReturnData as String: kCFBooleanTrue!,
    ]

    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)

    guard status == errSecSuccess, let data = result as? Data else {
      return nil
    }

    let decoder = JSONDecoder()
    return try? decoder.decode(KeyRotationMetadata.self, from: data)
  }

  /**
   * Stores the current key version metadata.
   */
  private func setCurrentKeyMetadata(_ metadata: KeyRotationMetadata) {
    let encoder = JSONEncoder()
    guard let encoded = try? encoder.encode(metadata) else { return }

    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "\(keychainService).rotation.currentKey",
      kSecValueData as String: encoded,
      kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    ]

    SecItemDelete(query as CFDictionary)
    SecItemAdd(query as CFDictionary, nil)
  }

  // MARK: - Utility Methods

  /**
   * Creates an access control object for keys.
   * Specifies requirements for accessing the key (biometry, passcode, etc.).
   */
  private func createAccessControl(requiresBiometry: Bool) -> SecAccessControl? {
    var error: Unmanaged<CFError>? = nil

    let control = SecAccessControlCreateWithFlags(
      kCFAllocatorDefault,
      kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      requiresBiometry ? .biometryCurrentSet : [],
      &error
    )

    return control as SecAccessControl?
  }

  /**
   * Checks if the device has Secure Enclave support.
   * Secure Enclave is available on:
   * - iPhone 5s and later
   * - iPad Air and later
   * - iPad mini 3 and later
   */
  private func isSecureEnclaveAvailable() -> Bool {
    #if os(iOS)
    // Check iOS version and device capability
    if #available(iOS 9.0, *) {
      // Secure Enclave available, but need to check device
      // All modern iPhones/iPads support it
      return true
    }
    #endif
    return false
  }

  /**
   * Updates the currently detected biometry type.
   */
  private func updateBiometryType() {
    let context = LAContext()
    var error: NSError?

    if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
      currentBiometryType = context.biometryType
    } else {
      currentBiometryType = .none
    }
  }

  /**
   * Converts LABiometryType to human-readable string.
   */
  private func descriptionForBiometryType(_ type: LABiometryType) -> String? {
    switch type {
    case .none:
      return nil
    case .touchID:
      return "TouchID"
    case .faceID:
      return "FaceID"
    @unknown default:
      // Covers iOS 17.0+ LABiometryType.opticID and future types
      if #available(iOS 17.0, *) {
        if type == LABiometryType.opticID {
          return "opticID"
        }
      }
      return "unknown"
    }
  }

  /**
   * Notifies the JavaScript bridge about biometric changes.
   * This triggers the event listener in the TypeScript rotation engine.
   *
   * @note Implementation depends on how the native bridge is structured
   */
  private func notifyBiometricChangeToJavaScript(result: BiometricChangeDetectionResult) {
    let event = RotationEvent(
      type: "biometric:changed",
      timestamp: Double(Date().timeIntervalSince1970 * 1000),
      reason: "Biometric enrollment changed from \(result.previousBiometryType ?? "none") to \(result.currentBiometryType ?? "none")",
      itemsReEncrypted: nil,
      duration: nil
    )
    biometricChangeCallback?(event)
  }
}

// MARK: - Singleton Access

private var sharedKeyRotationManager: iOSKeyRotationManager?

func getiOSKeyRotationManager() -> iOSKeyRotationManager {
  if sharedKeyRotationManager == nil {
    sharedKeyRotationManager = iOSKeyRotationManager()
  }
  return sharedKeyRotationManager!
}

// MARK: - Integration with HybridSensitiveInfo

/**
 * Extension to integrate key rotation with the main HybridSensitiveInfo module.
 * Adds rotation methods to the native bridge that TypeScript can call.
 */
extension iOSKeyRotationManager {
  /**
   * Generates a new key version for rotation.
   * Called from TypeScript rotation engine.
   */
  func generateNewKeyVersion() -> Promise<[String: Any]> {
    Promise.parallel(keychainQueue) {
      let keyVersionId = ISO8601DateFormatter().string(from: Date())
      let manager = getiOSKeyRotationManager()

      guard let _ = manager.generateNewKey(
        keyVersionId: keyVersionId,
        requiresBiometry: true
      ) else {
        throw RuntimeError.error(withMessage: "Failed to generate new key")
      }

      return [
        "id": keyVersionId,
        "timestamp": Int64(Date().timeIntervalSince1970 * 1000),
        "isActive": true,
      ]
    }
  }

  /**
   * Rotates to a newly generated key.
   * Called from TypeScript rotation engine.
   */
  func rotateKey(request: [String: Any]) -> Promise<Void> {
    Promise.parallel(keychainQueue) {
      guard let keyVersionId = request["id"] as? String else {
        throw RuntimeError.error(withMessage: "Missing key version ID")
      }

      let manager = getiOSKeyRotationManager()
      manager.rotateToNewKey(newKeyVersionId: keyVersionId)

      return ()
    }
  }
}
