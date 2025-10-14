package com.sensitiveinfo.internal.storage

import com.margelo.nitro.sensitiveinfo.AccessControl
import com.margelo.nitro.sensitiveinfo.SecurityLevel
import com.margelo.nitro.sensitiveinfo.StorageBackend
import com.margelo.nitro.sensitiveinfo.StorageMetadata
import com.sensitiveinfo.internal.util.accessControlFromPersisted
import com.sensitiveinfo.internal.util.persistedName
import com.sensitiveinfo.internal.util.securityLevelFromPersisted
import com.sensitiveinfo.internal.util.storageBackendFromPersisted

internal data class PersistedMetadata(
  val securityLevel: String,
  val backend: String,
  val accessControl: String,
  val timestamp: Double
) {
  fun toStorageMetadata(): StorageMetadata? {
    val level = securityLevelFromPersisted(securityLevel) ?: return null
    val backendValue = storageBackendFromPersisted(backend) ?: return null
    val control = accessControlFromPersisted(accessControl) ?: return null
    return StorageMetadata(
      securityLevel = level,
      backend = backendValue,
      accessControl = control,
      timestamp = timestamp
    )
  }

  companion object {
    fun from(metadata: StorageMetadata): PersistedMetadata {
      return PersistedMetadata(
        securityLevel = metadata.securityLevel.persistedName(),
        backend = metadata.backend.persistedName(),
        accessControl = metadata.accessControl.persistedName(),
        timestamp = metadata.timestamp
      )
    }

    fun fallback(
      securityLevel: SecurityLevel = SecurityLevel.SOFTWARE,
      backend: StorageBackend = StorageBackend.ANDROIDKEYSTORE,
      accessControl: AccessControl = AccessControl.NONE
    ): PersistedMetadata {
      val metadata = StorageMetadata(
        securityLevel = securityLevel,
        backend = backend,
        accessControl = accessControl,
        timestamp = System.currentTimeMillis() / 1000.0
      )
      return from(metadata)
    }
  }
}
