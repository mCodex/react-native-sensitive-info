package com.sensitiveinfo.internal.util

import java.security.MessageDigest
import java.util.Locale

/**
 * Produces deterministic Android Keystore alias names.
 *
 * Alias format: `SensitiveInfo_<serviceKeyHash>_v<version>`. The hash input length-prefixes the
 * service and key so pairs such as `("a:b", "c")` and `("a", "b:c")` stay distinct. The alias
 * remains stored with each entry, so readers can continue using keys written with the old format.
 */
internal object AliasGenerator {
  private const val PREFIX = "SensitiveInfo"
  private const val HMAC_PREFIX = "SensitiveInfo_hmac"

  fun aliasFor(service: String, key: String, version: Int): String {
    val combined = "v2:${service.length}:${service}:${key.length}:${key}"
    val hash = sha256Hex(combined.toByteArray()).take(32)
    return "${PREFIX}_${hash}_v${version}"
  }

  /** Identifies old aliases that may also be referenced by another delimiter-colliding entry. */
  fun isLegacyAliasFor(service: String, key: String, version: Int, alias: String): Boolean {
    val legacyHash = sha256Hex("${service}:${key}".toByteArray()).take(32)
    return alias == "${PREFIX}_${legacyHash}_v${version}"
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
