import Foundation

import NitroModules

/// Codable wrapper that lets us round-trip `StorageMetadata` through the Keychain's generic field.
struct PersistedMetadata: Codable {
  let securityLevel: String
  let backend: String
  let accessControl: String
  let timestamp: Double
  let keyVersion: Int?
  let integrityTag: String?

  init(metadata: StorageMetadata, integrityTag: String? = nil) {
    securityLevel = metadata.securityLevel.stringValue
    backend = metadata.backend.stringValue
    accessControl = metadata.accessControl.stringValue
    timestamp = metadata.timestamp
    keyVersion = metadata.keyVersion.map { Int($0) }
    self.integrityTag = integrityTag ?? metadata.integrityTag
  }

  func toStorageMetadata() -> StorageMetadata? {
    guard
      let level = SecurityLevel(fromString: securityLevel),
      let backendValue = StorageBackend(fromString: backend),
      let control = AccessControl(fromString: accessControl)
    else {
      return nil
    }
    return StorageMetadata(
      securityLevel: level,
      backend: backendValue,
      accessControl: control,
      timestamp: timestamp,
      keyVersion: keyVersion.map { Double($0) },
      integrityTag: integrityTag
    )
  }
}
