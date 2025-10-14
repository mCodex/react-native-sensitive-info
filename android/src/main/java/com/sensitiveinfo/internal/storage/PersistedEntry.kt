package com.sensitiveinfo.internal.storage

import org.json.JSONObject
import android.util.Base64

/**
 * Serialized representation of an entry in SharedPreferences.
 *
 * `ciphertext` and `iv` remain optional so callers can cache metadata-only items (for example
 * when a secret is hardware-gated and the user has not authenticated yet).
 */
internal data class PersistedEntry(
  val alias: String,
  val ciphertext: ByteArray?,
  val iv: ByteArray?,
  val metadata: PersistedMetadata,
  val authenticators: Int,
  val requiresAuthentication: Boolean,
  val invalidateOnEnrollment: Boolean,
  val useStrongBox: Boolean
) {
  fun toJson(): JSONObject {
    val json = JSONObject()
    json.put(KEY_ALIAS, alias)
    json.put(KEY_AUTHENTICATORS, authenticators)
    json.put(KEY_REQUIRES_AUTH, requiresAuthentication)
    json.put(KEY_INVALIDATE_ON_ENROLLMENT, invalidateOnEnrollment)
    json.put(KEY_USE_STRONGBOX, useStrongBox)
    ciphertext?.let { data ->
      json.put(KEY_CIPHERTEXT, Base64.encodeToString(data, Base64.NO_WRAP))
    }
    iv?.let { data ->
      json.put(KEY_IV, Base64.encodeToString(data, Base64.NO_WRAP))
    }
    val metadataJson = JSONObject()
    metadataJson.put(KEY_SECURITY_LEVEL, metadata.securityLevel)
    metadataJson.put(KEY_BACKEND, metadata.backend)
    metadataJson.put(KEY_ACCESS_CONTROL, metadata.accessControl)
    metadataJson.put(KEY_TIMESTAMP, metadata.timestamp)
    json.put(KEY_METADATA, metadataJson)
    return json
  }

  companion object {
    private const val KEY_ALIAS = "alias"
    private const val KEY_CIPHERTEXT = "ciphertext"
    private const val KEY_IV = "iv"
    private const val KEY_METADATA = "metadata"
    private const val KEY_AUTHENTICATORS = "authenticators"
    private const val KEY_REQUIRES_AUTH = "requiresAuth"
    private const val KEY_INVALIDATE_ON_ENROLLMENT = "invalidateOnEnrollment"
    private const val KEY_USE_STRONGBOX = "useStrongBox"

    private const val KEY_SECURITY_LEVEL = "securityLevel"
    private const val KEY_BACKEND = "backend"
    private const val KEY_ACCESS_CONTROL = "accessControl"
    private const val KEY_TIMESTAMP = "timestamp"

    fun fromJson(raw: String): PersistedEntry? {
      val json = try {
        JSONObject(raw)
      } catch (_: Throwable) {
        return null
      }

      val metadataJson = json.optJSONObject(KEY_METADATA) ?: return null
      val metadata = PersistedMetadata(
        securityLevel = metadataJson.optString(KEY_SECURITY_LEVEL),
        backend = metadataJson.optString(KEY_BACKEND),
        accessControl = metadataJson.optString(KEY_ACCESS_CONTROL),
        timestamp = metadataJson.optDouble(KEY_TIMESTAMP)
      )

      val alias = json.optString(KEY_ALIAS)
      if (alias.isEmpty()) {
        return null
      }

      val ciphertext = json.optString(KEY_CIPHERTEXT, null)?.let { Base64.decode(it, Base64.NO_WRAP) }
      val iv = json.optString(KEY_IV, null)?.let { Base64.decode(it, Base64.NO_WRAP) }
      val authenticators = json.optInt(KEY_AUTHENTICATORS, 0)
      val requiresAuth = json.optBoolean(KEY_REQUIRES_AUTH, false)
      val invalidateOnEnrollment = json.optBoolean(KEY_INVALIDATE_ON_ENROLLMENT, false)
      val useStrongBox = json.optBoolean(KEY_USE_STRONGBOX, false)

      return PersistedEntry(
        alias = alias,
        ciphertext = ciphertext,
        iv = iv,
        metadata = metadata,
        authenticators = authenticators,
        requiresAuthentication = requiresAuth,
        invalidateOnEnrollment = invalidateOnEnrollment,
        useStrongBox = useStrongBox
      )
    }
  }
}
