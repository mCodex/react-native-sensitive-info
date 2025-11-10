package com.sensitiveinfo.internal.metadata

import com.margelo.nitro.sensitiveinfo.AccessControl
import com.margelo.nitro.sensitiveinfo.SecurityLevel
import com.margelo.nitro.sensitiveinfo.StorageBackend
import com.margelo.nitro.sensitiveinfo.StorageMetadata
import com.sensitiveinfo.internal.storage.PersistedMetadata
import com.sensitiveinfo.internal.util.securityLevelFromPersisted
import com.sensitiveinfo.internal.util.accessControlFromPersisted
import com.sensitiveinfo.internal.util.persistedName

/**
 * Concrete implementation of MetadataManager for Android.
 *
 * Handles metadata encoding/decoding operations:
 * - Converting between StorageMetadata and PersistedMetadata
 * - Creating metadata with sensible defaults
 * - Handling invalid or missing metadata gracefully
 *
 * @since 6.0.0
 */
internal class AndroidMetadataManager : MetadataManager {
  
  override suspend fun decodeMetadata(metadata: StorageMetadata?): StorageMetadata? {
    return metadata
  }

  override suspend fun encodeMetadata(metadata: StorageMetadata): StorageMetadata {
    return metadata
  }

  override fun createMetadata(
    securityLevel: String,
    accessControl: String,
    alias: String
  ): StorageMetadata {
    return StorageMetadata(
      securityLevel = securityLevelFromPersisted(securityLevel) ?: SecurityLevel.SOFTWARE,
      backend = StorageBackend.ANDROIDKEYSTORE,
      accessControl = accessControlFromPersisted(accessControl) ?: AccessControl.NONE,
      timestamp = System.currentTimeMillis() / 1000.0,
      alias = alias
    )
  }
}
