import Foundation
import LocalAuthentication
import NitroModules
import Security
import CommonCrypto

/// Apple platforms implementation of the SensitiveInfo Nitro module.
///
/// Provides secure storage for sensitive data using Keychain with support for biometric,
/// device credential, and Secure Enclave authentication on iOS, macOS, visionOS, and watchOS.
///
/// The implementation follows:
/// - Dependency Injection pattern for better testability
/// - Single Responsibility Principle with delegated managers
/// - Proper Promise async handling per Nitro documentation
/// - SOLID principles for maintainability
///
/// Managers:
/// - ItemManager: CRUD operations (get/set/delete/has/enumerate/clear)
/// - RotationManager: Key rotation operations and event handling
///
/// @since 6.0.0
final class HybridSensitiveInfo: HybridSensitiveInfoSpec {
  private var dependencies: Dependencies?
  private let initializationLock = NSLock()
  private var itemManager: ItemManager?
  private var rotationManager: RotationManager?

  // MARK: - Lazy Initialization

  private func ensureInitialized() -> Dependencies {
    if let existing = dependencies {
      return existing
    }

    return initializationLock.withLock {
      if let existing = dependencies {
        return existing
      }

      let deps = Dependencies.create()
      dependencies = deps

      itemManager = KeychainItemManager(dependencies: deps)
      rotationManager = KeyRotationManagerImpl(
        dependencies: deps,
        itemManager: KeychainItemManager(dependencies: deps)
      )

      return deps
    }
  }

  // MARK: - Item Operations

  func setItem(request: SensitiveInfoSetRequest) throws -> Promise<MutationResult> {
    let deps = ensureInitialized()
    let manager = itemManager ?? KeychainItemManager(dependencies: deps)
    return manager.setItem(request: request)
  }

  func getItem(request: SensitiveInfoGetRequest) throws -> Promise<SensitiveInfoItem?> {
    let deps = ensureInitialized()
    let manager = itemManager ?? KeychainItemManager(dependencies: deps)
    return manager.getItem(request: request)
  }

  func deleteItem(request: SensitiveInfoDeleteRequest) throws -> Promise<Bool> {
    let deps = ensureInitialized()
    let manager = itemManager ?? KeychainItemManager(dependencies: deps)
    return manager.deleteItem(request: request)
  }

  func hasItem(request: SensitiveInfoHasRequest) throws -> Promise<Bool> {
    let deps = ensureInitialized()
    let manager = itemManager ?? KeychainItemManager(dependencies: deps)
    return manager.hasItem(request: request)
  }

  func getAllItems(request: SensitiveInfoEnumerateRequest?) throws -> Promise<[SensitiveInfoItem]> {
    let deps = ensureInitialized()
    let manager = itemManager ?? KeychainItemManager(dependencies: deps)
    return manager.getAllItems(request: request)
  }

  func clearService(request: SensitiveInfoOptions?) throws -> Promise<Void> {
    let deps = ensureInitialized()
    let manager = itemManager ?? KeychainItemManager(dependencies: deps)
    return manager.clearService(request: request)
  }

  // MARK: - Security Level

  func getSupportedSecurityLevels() throws -> Promise<SecurityAvailability> {
    let deps = ensureInitialized()
    return Promise.resolved(withResult: SecurityAvailability(
      secureEnclave: deps.securityAvailabilityResolver.resolve().secureEnclave,
      strongBox: deps.securityAvailabilityResolver.resolve().strongBox,
      biometry: deps.securityAvailabilityResolver.resolve().biometry,
      deviceCredential: deps.securityAvailabilityResolver.resolve().deviceCredential
    ))
  }

  // MARK: - Key Rotation

  func initializeKeyRotation(request: InitializeKeyRotationRequest) throws -> Promise<Void> {
    let deps = ensureInitialized()
    let manager = rotationManager ?? KeyRotationManagerImpl(
      dependencies: deps,
      itemManager: KeychainItemManager(dependencies: deps)
    )
    return manager.initializeKeyRotation(request: request)
  }

  func rotateKeys(request: RotateKeysRequest) throws -> Promise<RotationResult> {
    let deps = ensureInitialized()
    let manager = rotationManager ?? KeyRotationManagerImpl(
      dependencies: deps,
      itemManager: KeychainItemManager(dependencies: deps)
    )
    return manager.rotateKeys(request: request)
  }

  func getRotationStatus() throws -> Promise<RotationStatus> {
    let deps = ensureInitialized()
    let manager = rotationManager ?? KeyRotationManagerImpl(
      dependencies: deps,
      itemManager: KeychainItemManager(dependencies: deps)
    )
    return manager.getRotationStatus()
  }

  func onRotationEvent(callback: @escaping (RotationEvent) -> Void) throws -> () -> Void {
    let deps = ensureInitialized()
    let manager = rotationManager ?? KeyRotationManagerImpl(
      dependencies: deps,
      itemManager: KeychainItemManager(dependencies: deps)
    )
    return manager.onRotationEvent(callback: callback)
  }

  func reEncryptAllItems(request: ReEncryptAllItemsRequest) throws -> Promise<ReEncryptAllItemsResponse> {
    let deps = ensureInitialized()
    let manager = rotationManager ?? KeyRotationManagerImpl(
      dependencies: deps,
      itemManager: KeychainItemManager(dependencies: deps)
    )
    return manager.reEncryptAllItems(request: request)
  }
}

// MARK: - NSLock Extension

extension NSLock {
  func withLock<T>(_ body: () throws -> T) rethrows -> T {
    lock()
    defer { unlock() }
    return try body()
  }
}
