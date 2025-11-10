import Foundation

/**
 * Handles metadata encoding/decoding with consistent behavior.
 *
 * Responsibilities:
 * - Encode metadata to compact JSON
 * - Decode metadata from storage
 * - Provide default metadata values
 * - Handle schema versioning (for future evolution)
 *
 * By centralizing metadata handling, we ensure:
 * - Consistent encoding across all write operations
 * - Reliable decoding without duplication
 * - Easy schema evolution in future versions
 * - Clear error messages on decode failures
 *
 * @since 6.0.0
 */
struct StorageMetadataHandler {
  private let encoder: JSONEncoder
  private let decoder: JSONDecoder

  /**
   * Initializes the metadata handler with encoder/decoder configuration.
   *
   * The encoder is configured for compact output (no pretty-printing)
   * to minimize storage overhead while remaining debuggable.
   */
  init() {
    let encoder = JSONEncoder()
    encoder.outputFormatting = []  // Compact encoding, no whitespace
    self.encoder = encoder
    self.decoder = JSONDecoder()
  }

  /**
   * Encodes metadata for storage as a Keychain generic attribute.
   *
   * Metadata is stored in the generic attribute as compact JSON,
   * allowing us to track security properties alongside the value.
   *
   * @param metadata The metadata to encode
   * @return Encoded metadata as Data
   * @throws If encoding fails
   *
   * @example
   * ```swift
   * let handler = StorageMetadataHandler()
   * let metadata = StorageMetadata(
   *   securityLevel: .secureEnclave,
   *   backend: .keychain,
   *   accessControl: .secureEnclaveBiometry,
   *   timestamp: Date().timeIntervalSince1970
   * )
   * let encoded = try handler.encodeMetadata(metadata)
   * ```
   */
  func encodeMetadata(_ metadata: StorageMetadata) throws -> Data {
    try encoder.encode(PersistedMetadata(metadata: metadata))
  }

  /**
   * Decodes metadata from a Keychain generic attribute.
   *
   * Returns default metadata if the attribute is nil or empty
   * (handles items stored before metadata was added).
   *
   * @param data The data to decode (nil if not present)
   * @return Decoded metadata, or default if empty
   * @throws If decoding fails or data is corrupted
   *
   * @example
   * ```swift
   * let handler = StorageMetadataHandler()
   * let metadata = try handler.decodeMetadata(from: attrs)
   * ```
   */
  func decodeMetadata(from data: Data?) throws -> StorageMetadata {
    guard let data = data, !data.isEmpty else {
      return makeDefaultMetadata()
    }

    do {
      let persisted = try decoder.decode(PersistedMetadata.self, from: data)
      return persisted.toStorageMetadata() ?? makeDefaultMetadata()
    } catch {
      // Log the error but return default rather than failing
      // This handles legacy items that might have different metadata format
      print("[StorageMetadataHandler] Failed to decode metadata: \(error)")
      return makeDefaultMetadata()
    }
  }

  /**
   * Creates metadata for a new storage operation.
   *
   * Initializes metadata with the current timestamp and provided
   * security parameters.
   *
   * @param securityLevel The resolved security level for this item
   * @param accessControl The access control applied
   * @return New metadata with current timestamp
   *
   * @example
   * ```swift
   * let metadata = handler.makeMetadata(
   *   securityLevel: .secureEnclave,
   *   accessControl: .secureEnclaveBiometry
   * )
   * ```
   */
  func makeMetadata(
    securityLevel: SecurityLevel,
    accessControl: AccessControl
  ) -> StorageMetadata {
    StorageMetadata(
      securityLevel: securityLevel,
      backend: .keychain,
      accessControl: accessControl,
      timestamp: Date().timeIntervalSince1970
    )
  }

  /**
   * Creates default metadata for legacy items.
   *
   * Used when stored items have no metadata (pre-6.0.0 items).
   * Conservative defaults: software security level, no special access control.
   *
   * @return Default metadata
   */
  private func makeDefaultMetadata() -> StorageMetadata {
    StorageMetadata(
      securityLevel: .software,
      backend: .keychain,
      accessControl: .none,
      timestamp: Date().timeIntervalSince1970
    )
  }
}
