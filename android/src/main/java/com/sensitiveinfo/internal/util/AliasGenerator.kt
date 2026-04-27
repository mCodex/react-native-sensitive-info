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

  fun aliasFor(service: String, key: String, version: Int): String {
    val combined = "${service}:${key}"
    val digest = MessageDigest.getInstance("SHA-256").digest(combined.toByteArray())
    val hash = digest.take(16).joinToString(separator = "") { byte ->
      String.format(Locale.US, "%02x", byte.toInt() and 0xFF)
    }
    return "${PREFIX}_${hash}_v${version}"
  }
}
