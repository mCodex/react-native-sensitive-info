import Foundation
import NitroModules

/// Concrete implementation of RotationManager for iOS key rotation.
///
/// Handles all key rotation operations including initialization, rotation,
/// status tracking, and re-encryption. Manages rotation events and
/// periodic rotation checks following the rotation lifecycle pattern.
///
/// @since 6.0.0
final class KeyRotationManagerImpl: RotationManager {
  private let dependencies: Dependencies
  private let itemManager: ItemManager
  private var rotationEventCallback: ((RotationEvent) -> Void)?
  private var rotationTimer: Timer?
  private let defaultService: String

  // MARK: - Initialization

  init(
    dependencies: Dependencies,
    itemManager: ItemManager,
    defaultService: String = Bundle.main.bundleIdentifier ?? "default"
  ) {
    self.dependencies = dependencies
    self.itemManager = itemManager
    self.defaultService = defaultService
  }

  // MARK: - RotationManager Implementation

  func initializeKeyRotation(request: InitializeKeyRotationRequest) -> Promise<Void> {
    Promise.async { [self] in
      let defaults = UserDefaults.standard
      defaults.set(request.enabled, forKey: "keyRotationEnabled")
      defaults.set(request.rotationIntervalMs, forKey: "rotationIntervalMs")
      defaults.set(request.rotateOnBiometricChange, forKey: "rotateOnBiometricChange")
      defaults.set(request.rotateOnCredentialChange, forKey: "rotateOnCredentialChange")
      defaults.set(request.manualRotationEnabled, forKey: "manualRotationEnabled")
      defaults.set(request.maxKeyVersions, forKey: "maxKeyVersions")
      defaults.set(request.backgroundReEncryption, forKey: "backgroundReEncryption")
      defaults.synchronize()

      if request.enabled {
        startPeriodicRotationCheck()
      } else {
        stopPeriodicRotationCheck()
      }

      return ()
    }
  }

  func rotateKeys(request: RotateKeysRequest) -> Promise<RotationResult> {
    Promise.async { [self] in
      let manager = dependencies.keyRotationManager

      manager.setRotationInProgress(true)

      emitEvent(RotationEvent(
        type: "rotation:started",
        timestamp: Double(Date().timeIntervalSince1970 * 1000),
        reason: request.reason ?? "Manual rotation",
        itemsReEncrypted: nil,
        duration: nil
      ))

      let startTime = Date()

      do {
        let newKeyId = ISO8601DateFormatter().string(from: Date())
        guard let _ = manager.generateNewKey(
          keyVersionId: newKeyId,
          requiresBiometry: true
        ) else {
          manager.setRotationInProgress(false)

          emitEvent(RotationEvent(
            type: "rotation:failed",
            timestamp: Double(Date().timeIntervalSince1970 * 1000),
            reason: "Failed to generate new key",
            itemsReEncrypted: nil,
            duration: nil
          ))

          throw RuntimeError.error(withMessage: "Failed to generate new key for rotation")
        }

        manager.rotateToNewKey(newKeyVersionId: newKeyId)

        let defaults = UserDefaults.standard
        let backgroundReEncryption = defaults.bool(forKey: "backgroundReEncryption")
        var itemsReEncrypted = 0.0

        if backgroundReEncryption {
          let result = try reEncryptAllItemsImpl(service: defaultService, newKeyVersion: newKeyId)
          itemsReEncrypted = result.itemsReEncrypted
        }

        defaults.set(Int64(Date().timeIntervalSince1970 * 1000), forKey: "lastRotationTimestamp")
        defaults.synchronize()

        let duration = Date().timeIntervalSince(startTime) * 1000

        manager.setRotationInProgress(false)

        emitEvent(RotationEvent(
          type: "rotation:completed",
          timestamp: Double(Date().timeIntervalSince1970 * 1000),
          reason: request.reason ?? "Manual rotation",
          itemsReEncrypted: itemsReEncrypted,
          duration: duration
        ))

        return RotationResult(
          success: true,
          newKeyVersion: KeyVersion(id: newKeyId),
          itemsReEncrypted: itemsReEncrypted,
          duration: duration,
          reason: request.reason ?? "Manual rotation"
        )
      } catch {
        manager.setRotationInProgress(false)
        throw error
      }
    }
  }

  func getRotationStatus() -> Promise<RotationStatus> {
    Promise.async { [self] in
      let manager = dependencies.keyRotationManager

      let currentKey = manager.getCurrentKeyVersion()
      let availableVersions = manager.getAvailableKeyVersions()
      let isRotating = manager.isRotationInProgress()

      let defaults = UserDefaults.standard
      let lastRotationTimestamp = defaults.object(forKey: "lastRotationTimestamp") as? Int64

      return RotationStatus(
        isRotating: isRotating,
        currentKeyVersion: currentKey != nil ? KeyVersion(id: currentKey!) : nil,
        availableKeyVersions: availableVersions.map { KeyVersion(id: $0) },
        lastRotationTimestamp: lastRotationTimestamp != nil ? Double(lastRotationTimestamp!) : nil
      )
    }
  }

  func onRotationEvent(callback: @escaping (RotationEvent) -> Void) -> () -> Void {
    rotationEventCallback = callback
    dependencies.keyRotationManager.setBiometricChangeCallback(callback)
    return { [weak self] in self?.rotationEventCallback = nil }
  }

  func reEncryptAllItems(request: ReEncryptAllItemsRequest) -> Promise<ReEncryptAllItemsResponse> {
    Promise.async { [self] in
      let manager = dependencies.keyRotationManager

      guard let currentKeyVersion = manager.getCurrentKeyVersion() else {
        throw RuntimeError.error(withMessage: "No current key version available")
      }

      let service = request.service?.isEmpty == false ? request.service! : defaultService
      let items = try getAllItemsRaw(service: service)

      var reEncryptedCount = 0
      var errors: [ReEncryptError] = []

      for item in items {
        do {
          let metadata = try dependencies.metadataHandler.decodeMetadata(from: item.metadata) ?? StorageMetadata(
            securityLevel: .software,
            backend: .keychain,
            accessControl: .none,
            timestamp: Date().timeIntervalSince1970,
            alias: ""
          )

          if metadata.alias != currentKeyVersion {
            let oldKeyData = try dependencies.cryptoService.retrieveEncryptionKey(alias: metadata.alias)
            let decryptedData = try dependencies.cryptoService.decryptData(item.encryptedValue, withKey: oldKeyData)

            let resolvedAccessControl = try dependencies.accessControlResolver.resolve(preferred: metadata.accessControl)

            let newKeyData = try dependencies.cryptoService.createOrRetrieveEncryptionKey(
              alias: currentKeyVersion,
              accessControl: resolvedAccessControl.accessControlRef
            )
            let newEncryptedData = try dependencies.cryptoService.encryptData(decryptedData, withKey: newKeyData)

            let newMetadata = StorageMetadata(
              securityLevel: resolvedAccessControl.securityLevel,
              backend: metadata.backend,
              accessControl: resolvedAccessControl.accessControl,
              timestamp: Date().timeIntervalSince1970,
              alias: currentKeyVersion
            )

            try updateItem(
              key: item.key,
              service: service,
              encryptedValue: newEncryptedData,
              metadata: newMetadata
            )

            reEncryptedCount += 1
          }
        } catch {
          errors.append(ReEncryptError(key: item.key, error: error.localizedDescription))
        }
      }

      return ReEncryptAllItemsResponse(
        itemsReEncrypted: Double(reEncryptedCount),
        errors: errors
      )
    }
  }

  // MARK: - Private Helpers

  private func emitEvent(_ event: RotationEvent) {
    rotationEventCallback?(event)
  }

  private func startPeriodicRotationCheck() {
    stopPeriodicRotationCheck()

    let defaults = UserDefaults.standard
    let intervalMs = defaults.double(forKey: "rotationIntervalMs")
    let intervalSeconds = intervalMs / 1000.0

    rotationTimer = Timer.scheduledTimer(withTimeInterval: intervalSeconds, repeats: true) { [weak self] _ in
      self?.checkAndPerformRotation()
    }
  }

  private func stopPeriodicRotationCheck() {
    rotationTimer?.invalidate()
    rotationTimer = nil
  }

  private func checkAndPerformRotation() {
    let defaults = UserDefaults.standard
    guard defaults.bool(forKey: "keyRotationEnabled") else { return }

    dependencies.keyRotationManager.handleBiometricEnrollmentChange()

    let lastRotation = defaults.object(forKey: "lastRotationTimestamp") as? Int64 ?? 0
    let intervalMs = defaults.double(forKey: "rotationIntervalMs")
    let now = Int64(Date().timeIntervalSince1970 * 1000)

    if Double(now - lastRotation) >= intervalMs {
      DispatchQueue.global(qos: .background).async { [weak self] in
        do {
          _ = try self?.rotateKeys(request: RotateKeysRequest(reason: "Automatic time-based rotation", metadata: nil))
        } catch {
          print("Automatic rotation failed: \(error.localizedDescription)")
        }
      }
    }
  }

  private func reEncryptAllItemsImpl(service: String, newKeyVersion: String) throws -> ReEncryptAllItemsResponse {
    let items = try getAllItemsRaw(service: service)

    var reEncryptedCount = 0
    var errors: [ReEncryptError] = []

    for item in items {
      do {
        let metadata = try dependencies.metadataHandler.decodeMetadata(from: item.metadata) ?? StorageMetadata(
          securityLevel: .software,
          backend: .keychain,
          accessControl: .none,
          timestamp: Date().timeIntervalSince1970,
          alias: ""
        )

        if metadata.alias != newKeyVersion {
          let oldKeyData = try dependencies.cryptoService.retrieveEncryptionKey(alias: metadata.alias)
          let decryptedData = try dependencies.cryptoService.decryptData(item.encryptedValue, withKey: oldKeyData)

          let resolvedAccessControl = try dependencies.accessControlResolver.resolve(preferred: metadata.accessControl)

          let newKeyData = try dependencies.cryptoService.createOrRetrieveEncryptionKey(
            alias: newKeyVersion,
            accessControl: resolvedAccessControl.accessControlRef
          )
          let newEncryptedData = try dependencies.cryptoService.encryptData(decryptedData, withKey: newKeyData)

          let newMetadata = StorageMetadata(
            securityLevel: resolvedAccessControl.securityLevel,
            backend: metadata.backend,
            accessControl: resolvedAccessControl.accessControl,
            timestamp: Date().timeIntervalSince1970,
            alias: newKeyVersion
          )

          try updateItem(
            key: item.key,
            service: service,
            encryptedValue: newEncryptedData,
            metadata: newMetadata
          )

          reEncryptedCount += 1
        }
      } catch {
        errors.append(ReEncryptError(key: item.key, error: error.localizedDescription))
      }
    }

    return ReEncryptAllItemsResponse(
      itemsReEncrypted: Double(reEncryptedCount),
      errors: errors
    )
  }

  private struct RawItem {
    let key: String
    let encryptedValue: Data
    let metadata: Data
  }

  private func getAllItemsRaw(service: String) throws -> [RawItem] {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecMatchLimit as String: kSecMatchLimitAll,
      kSecReturnAttributes as String: kCFBooleanTrue,
      kSecReturnData as String: kCFBooleanTrue,
    ]

    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)

    guard status == errSecSuccess, let array = result as? [[String: Any]] else {
      return []
    }

    return array.compactMap { dict in
      guard
        let key = dict[kSecAttrAccount as String] as? String,
        let encryptedValue = dict[kSecValueData as String] as? Data,
        let metadata = dict[kSecAttrGeneric as String] as? Data
      else {
        return nil
      }
      return RawItem(key: key, encryptedValue: encryptedValue, metadata: metadata)
    }
  }

  private func updateItem(key: String, service: String, encryptedValue: Data, metadata: StorageMetadata) throws {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: key,
      kSecAttrService as String: service,
    ]

    let updateAttributes: [String: Any] = [
      kSecValueData as String: encryptedValue,
      kSecAttrGeneric as String: try dependencies.metadataHandler.encodeMetadata(metadata),
    ]

    let status = SecItemUpdate(query as CFDictionary, updateAttributes as CFDictionary)
    guard status == errSecSuccess else {
      throw RuntimeError.error(withMessage: "Failed to update item")
    }
  }
}
