package com.sensitiveinfo.internal.metadata

import com.margelo.nitro.sensitiveinfo.StorageMetadata
import com.sensitiveinfo.internal.storage.PersistedMetadata

/**
 * Interface for managing metadata operations on Android.
 *
 * Encapsulates all metadata encoding, decoding, and manipulation logic.
 * Follows Single Responsibility Principle by focusing only on metadata.
 *
 * @since 6.0.0
 */
interface MetadataManager {
  /**
   * Decode metadata from persisted format.
   *
   * @param metadata The StorageMetadata from storage
   * @return Decoded StorageMetadata or null if invalid
   * @throws Exception if decoding fails
   */
  suspend fun decodeMetadata(metadata: StorageMetadata?): StorageMetadata?

  /**
   * Encode metadata to persisted format.
   *
   * @param metadata The StorageMetadata to encode
   * @return Encoded StorageMetadata for storage
   * @throws Exception if encoding fails
   */
  suspend fun encodeMetadata(metadata: StorageMetadata): StorageMetadata

  /**
   * Create default metadata with common values.
   *
   * @param securityLevel Security level for this item
   * @param accessControl Access control policy
   * @param alias Encryption key alias
   * @return StorageMetadata with timestamp set
   */
  fun createMetadata(
    securityLevel: String,
    accessControl: String,
    alias: String
  ): StorageMetadata
}
