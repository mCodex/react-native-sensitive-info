import Foundation
import NitroModules

/// Concrete implementation of MetadataManager using StorageMetadataHandler.
///
/// Provides metadata operations:
/// - Encoding/decoding metadata to/from Keychain storage
/// - Creating metadata with sensible defaults
/// - Handling invalid or missing metadata gracefully
///
/// @since 6.0.0
final class StorageMetadataManager: MetadataManager {
  private let handler: StorageMetadataHandler

  init(handler: StorageMetadataHandler = StorageMetadataHandler()) {
    self.handler = handler
  }

  // MARK: - MetadataManager Implementation

  func decodeMetadata(from data: Data?) throws -> StorageMetadata? {
    guard let data = data else { return nil }
    return try handler.decodeMetadata(from: data)
  }

  func encodeMetadata(_ metadata: StorageMetadata) throws -> Data {
    try handler.encodeMetadata(metadata)
  }

  func createMetadata(
    securityLevel: SecurityLevel,
    accessControl: AccessControl,
    alias: String
  ) -> StorageMetadata {
    StorageMetadata(
      securityLevel: securityLevel,
      backend: .keychain,
      accessControl: accessControl,
      timestamp: Date().timeIntervalSince1970,
      alias: alias
    )
  }
}
