import Foundation
import LocalAuthentication
import Security

/// Container for all HybridSensitiveInfo dependencies.
///
/// This follows the dependency injection pattern used in Android implementation,
/// providing lazy initialization and thread-safe access to all service collaborators.
///
/// Dependencies include:
/// - Keychain operations (query builder, metadata handling)
/// - Cryptography services (encryption/decryption)
/// - Access control resolution
/// - Security availability detection
/// - Input validation
/// - Key rotation management
/// - Specialized managers (metadata, authentication, access control)
///
/// @since 6.0.0
struct Dependencies {
  let context: NSObject // App context if needed
  let queryBuilder: KeychainQueryBuilder
  let metadataHandler: StorageMetadataHandler
  let metadataManager: MetadataManager
  let authenticationManager: AuthenticationManager
  let accessControlManager: AccessControlManager
  let cryptoService: CryptoService
  let accessControlResolver: AccessControlResolver
  let securityAvailabilityResolver: SecurityAvailabilityResolver
  let validator: KeychainValidator
  let keyRotationManager: iOSKeyRotationManager
  let workQueue: DispatchQueue

  // MARK: - Factory Method

  /// Initialize all dependencies with default implementations.
  ///
  /// - Parameters:
  ///   - workQueue: Dispatch queue for background operations
  static func create(workQueue: DispatchQueue? = nil) -> Dependencies {
    let queue = workQueue ?? DispatchQueue(
      label: "com.mcodex.sensitiveinfo.keychain",
      qos: .userInitiated
    )

    let defaultService = Bundle.main.bundleIdentifier ?? "default"
    let validator = KeychainValidator()
    let cryptoService = CryptoService(validator: validator, workQueue: queue)
    let securityAvailabilityResolver = SecurityAvailabilityResolver()
    let accessControlResolver = AccessControlResolver { securityAvailabilityResolver.resolve() }

    // Specialized managers
    let metadataHandler = StorageMetadataHandler()
    let metadataManager: MetadataManager = StorageMetadataManager(handler: metadataHandler)
    let authenticationManager: AuthenticationManager = iOSAuthenticationManager()
    let accessControlManager: AccessControlManager = iOSAccessControlManager(
      availabilityResolver: securityAvailabilityResolver
    )

    return Dependencies(
      context: NSObject(),
      queryBuilder: KeychainQueryBuilder(defaultService: defaultService),
      metadataHandler: metadataHandler,
      metadataManager: metadataManager,
      authenticationManager: authenticationManager,
      accessControlManager: accessControlManager,
      cryptoService: cryptoService,
      accessControlResolver: accessControlResolver,
      securityAvailabilityResolver: securityAvailabilityResolver,
      validator: validator,
      keyRotationManager: iOSKeyRotationManager(keychainService: defaultService),
      workQueue: queue
    )
  }
}
