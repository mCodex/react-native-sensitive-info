package com.sensitiveinfo.internal.util

import java.security.MessageDigest
import java.util.Locale

internal object AliasGenerator {
  private const val PREFIX = "SensitiveInfo_v1"

  fun create(service: String, accessSignature: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(service.toByteArray())
    val hash = digest.take(8).joinToString(separator = "") { byte ->
      String.format(Locale.US, "%02x", byte)
    }
    return "$PREFIX_$hash_${accessSignature.lowercase(Locale.US)}"
  }
}
