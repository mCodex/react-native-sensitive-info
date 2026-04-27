package com.sensitiveinfo.internal.util

import java.security.MessageDigest
import java.util.Locale

/**
 * Produces deterministic Android Keystore alias names.
 *
 * Alias format: `SensitiveInfo_<serviceKeyHash>_v<version>`. Embedding the master-key version in
 * the alias means rotating the key for a service produces a brand-new Keystore entry while
 * leaving legacy aliases intact until their entries are re-encrypted and deleted.
 */
internal object AliasGenerator {
  private const val PREFIX = "SensitiveInfo"
  private const val HMAC_PREFIX = "SensitiveInfo_hmac"

  fun aliasFor(service: String, key: String, version: Int): String {
    val combined = "${service}:${key}"
    val hash = sha256Hex(combined.toByteArray()).take(32)
    return "${PREFIX}_${hash}_v${version}"
  }

  /** Per-service HMAC key alias, shared across master-key versions. */
  fun hmacAliasFor(service: String): String {
    val hash = sha256Hex(service.toByteArray()).take(32)
    return "${HMAC_PREFIX}_${hash}"
  }

  private fun sha256Hex(bytes: ByteArray): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
    return digest.joinToString(separator = "") { byte ->
      String.format(Locale.US, "%02x", byte.toInt() and 0xFF)
    }
  }
}
