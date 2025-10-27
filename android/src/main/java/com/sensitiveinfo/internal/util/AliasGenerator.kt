package com.sensitiveinfo.internal.util

import java.security.MessageDigest
import java.util.Locale

/**
 * Produces deterministic Android Keystore alias names.
 *
 * Aliases follow the pattern `SensitiveInfo_v1_<serviceHash>_<keyHash>` so rotating
 * security policies for a service results in new keys while keeping the old ones around for
 * existing entries. The service hash keeps names short and filesystem safe.
 */
internal object AliasGenerator {
  private const val PREFIX = "SensitiveInfo_v1"

  fun aliasFor(service: String, key: String): String {
    val combined = "${service}:${key}"
    val digest = MessageDigest.getInstance("SHA-256").digest(combined.toByteArray())
    val hash = digest.take(16).joinToString(separator = "") { byte ->
      String.format(Locale.US, "%02x", byte.toInt() and 0xFF)
    }
    return "${PREFIX}_${hash}"
  }
}
