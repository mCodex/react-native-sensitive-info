package com.sensitiveinfo.internal.util

import java.security.MessageDigest
import java.util.Locale

/**
 * Produces deterministic Android Keystore alias names.
 *
 * Aliases follow the pattern `SensitiveInfo_v1_<serviceHash>_<policySignature>` so rotating
 * security policies for a service results in new keys while keeping the old ones around for
 * existing entries. The service hash keeps names short and filesystem safe.
 */
internal object AliasGenerator {
  private const val PREFIX = "SensitiveInfo_v1"

  fun create(service: String, accessSignature: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(service.toByteArray())
    val hash = digest.take(8).joinToString(separator = "") { byte ->
      String.format(Locale.US, "%02x", byte)
    }
    return "${PREFIX}_${hash}_${accessSignature.lowercase(Locale.US)}"
  }
}
