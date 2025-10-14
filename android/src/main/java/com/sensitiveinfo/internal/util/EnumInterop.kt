package com.sensitiveinfo.internal.util

import com.margelo.nitro.sensitiveinfo.AccessControl
import com.margelo.nitro.sensitiveinfo.SecurityLevel
import com.margelo.nitro.sensitiveinfo.StorageBackend

/** Ensures enums round-trip between Kotlin and the generated TypeScript string literal unions. */
internal fun AccessControl.persistedName(): String = when (this) {
  AccessControl.SECUREENCLAVEBIOMETRY -> "secureEnclaveBiometry"
  AccessControl.BIOMETRYCURRENTSET -> "biometryCurrentSet"
  AccessControl.BIOMETRYANY -> "biometryAny"
  AccessControl.DEVICEPASSCODE -> "devicePasscode"
  AccessControl.NONE -> "none"
}

internal fun SecurityLevel.persistedName(): String = when (this) {
  SecurityLevel.SECUREENCLAVE -> "secureEnclave"
  SecurityLevel.STRONGBOX -> "strongBox"
  SecurityLevel.BIOMETRY -> "biometry"
  SecurityLevel.DEVICECREDENTIAL -> "deviceCredential"
  SecurityLevel.SOFTWARE -> "software"
}

internal fun StorageBackend.persistedName(): String = when (this) {
  StorageBackend.KEYCHAIN -> "keychain"
  StorageBackend.ANDROIDKEYSTORE -> "androidKeystore"
  StorageBackend.ENCRYPTEDSHAREDPREFERENCES -> "encryptedSharedPreferences"
}

internal fun securityLevelFromPersisted(value: String): SecurityLevel? = when (value) {
  "secureEnclave" -> SecurityLevel.SECUREENCLAVE
  "strongBox" -> SecurityLevel.STRONGBOX
  "biometry" -> SecurityLevel.BIOMETRY
  "deviceCredential" -> SecurityLevel.DEVICECREDENTIAL
  "software" -> SecurityLevel.SOFTWARE
  else -> null
}

internal fun accessControlFromPersisted(value: String): AccessControl? = when (value) {
  "secureEnclaveBiometry" -> AccessControl.SECUREENCLAVEBIOMETRY
  "biometryCurrentSet" -> AccessControl.BIOMETRYCURRENTSET
  "biometryAny" -> AccessControl.BIOMETRYANY
  "devicePasscode" -> AccessControl.DEVICEPASSCODE
  "none" -> AccessControl.NONE
  else -> null
}

internal fun storageBackendFromPersisted(value: String): StorageBackend? = when (value) {
  "keychain" -> StorageBackend.KEYCHAIN
  "androidKeystore" -> StorageBackend.ANDROIDKEYSTORE
  "encryptedSharedPreferences" -> StorageBackend.ENCRYPTEDSHAREDPREFERENCES
  else -> null
}
