import Foundation

/// Protocol for managing metadata operations.
///
/// Encapsulates all metadata encoding, decoding, and manipulation logic.
/// Follows Single Responsibility Principle by focusing only on metadata.
///
/// @since 6.0.0
protocol MetadataManager {
  /// Decode metadata from raw bytes.
  ///
  /// - Parameters:
  ///   - data: Raw metadata bytes from Keychain
  /// - Returns: Decoded StorageMetadata or nil if invalid
  /// - Throws: RuntimeError if decoding fails
  func decodeMetadata(from data: Data?) throws -> StorageMetadata?

  /// Encode metadata to raw bytes.
  ///
  /// - Parameters:
  ///   - metadata: StorageMetadata to encode
  /// - Returns: Encoded metadata bytes for Keychain storage
  /// - Throws: RuntimeError if encoding fails
  func encodeMetadata(_ metadata: StorageMetadata) throws -> Data

  /// Create default metadata with common values.
  ///
  /// - Parameters:
  ///   - securityLevel: Security level for this item
  ///   - accessControl: Access control policy
  ///   - alias: Encryption key alias
  /// - Returns: StorageMetadata with timestamp set
  func createMetadata(
    securityLevel: SecurityLevel,
    accessControl: AccessControl,
    alias: String
  ) -> StorageMetadata
}
