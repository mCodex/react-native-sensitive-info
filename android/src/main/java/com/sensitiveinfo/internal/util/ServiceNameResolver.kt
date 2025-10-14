package com.sensitiveinfo.internal.util

import android.content.Context
import java.security.MessageDigest
import java.util.Locale

/**
 * Normalizes the requested service string so storage namespaces stay consistent and filesystem-safe.
 */
internal class ServiceNameResolver(private val context: Context) {
  private val defaultService: String = context.packageName.ifBlank { "sensitiveInfo" }

  fun resolve(requested: String?): String {
    val trimmed = requested?.trim()
    return if (trimmed.isNullOrEmpty()) defaultService else trimmed
  }

  fun preferencesFileFor(service: String): String {
    val normalized = resolve(service)
    val digest = MessageDigest.getInstance("SHA-256").digest(normalized.toByteArray())
    val suffix = digest.take(8).joinToString(separator = "") { byte ->
      String.format(Locale.US, "%02x", byte)
    }
    return "sensitive_info_${suffix}"
  }
}
