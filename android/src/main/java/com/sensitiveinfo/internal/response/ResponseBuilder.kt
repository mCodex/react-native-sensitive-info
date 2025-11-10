package com.sensitiveinfo.internal.response

import com.margelo.nitro.sensitiveinfo.MutationResult
import com.margelo.nitro.sensitiveinfo.SensitiveInfoItem
import com.margelo.nitro.sensitiveinfo.StorageMetadata

/**
 * Builds typed responses from native operations.
 *
 * Responsibilities:
 * - Convert encryption results to type-safe objects
 * - Create consistent metadata structures
 * - Handle platform-specific conversions
 * - Ensure response format consistency
 *
 * This interface allows different response building strategies
 * while maintaining a consistent public contract.
 *
 * @since 6.0.0
 */
interface ResponseBuilder {
  /**
   * Builds a MutationResult from operation metadata.
   *
   * @param metadata The storage metadata for the operation
   * @return MutationResult ready for JavaScript layer
   */
  fun buildMutationResult(metadata: StorageMetadata): MutationResult

  /**
   * Builds a SensitiveInfoItem from basic information.
   *
   * @param key The storage key
   * @param value The decrypted value (null if metadata only)
   * @param metadata The storage metadata
   * @param service The service name
   * @return SensitiveInfoItem with consistent structure
   */
  fun buildItem(key: String, value: String?, metadata: StorageMetadata, service: String): SensitiveInfoItem
}

/**
 * Standard implementation of ResponseBuilder for Android Keystore.
 *
 * Provides consistent response formatting across all storage operations.
 *
 * @since 6.0.0
 */
class StandardResponseBuilder : ResponseBuilder {
  override fun buildMutationResult(metadata: StorageMetadata): MutationResult {
    return MutationResult(metadata = metadata)
  }

  override fun buildItem(
    key: String,
    value: String?,
    metadata: StorageMetadata,
    service: String
  ): SensitiveInfoItem {
    return SensitiveInfoItem(
      key = key,
      service = service,
      value = value,
      metadata = metadata
    )
  }
}
