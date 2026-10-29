package com.sensitiveinfo.internal.storage

import android.content.Context
import android.content.SharedPreferences
import com.sensitiveinfo.internal.util.ServiceNameResolver

/**
 * Thin SharedPreferences wrapper. The real secret is stored in the Keystore; this component keeps
 * the encrypted payload, IV, and metadata JSON on disk so we can enumerate entries cheaply.
 */
internal class SecureStorage(context: Context) {
  private val resolver = ServiceNameResolver(context)
  private val applicationContext = context.applicationContext

  fun save(service: String, key: String, entry: PersistedEntry) {
    val preferences = preferencesFor(service)
    val saved = preferences.edit().putString(key, entry.toJson().toString()).commit()

    check(saved) { "Could not persist SensitiveInfo entry." }
  }

  fun read(service: String, key: String): PersistedEntry? {
    val preferences = preferencesFor(service)
    val raw = preferences.getString(key, null) ?: return null
    return PersistedEntry.fromJson(raw)
  }

  fun readAlias(service: String, key: String): String? {
    val raw = preferencesFor(service).getString(key, null) ?: return null
    return PersistedEntry.aliasFromJson(raw)
  }

  fun delete(service: String, key: String): Boolean {
    val preferences = preferencesFor(service)
    if (!preferences.contains(key)) {
      return false
    }
    check(preferences.edit().remove(key).commit()) {
      "Could not delete SensitiveInfo entry."
    }

    return true
  }

  fun contains(service: String, key: String): Boolean {
    val preferences = preferencesFor(service)
    return preferences.contains(key)
  }

  fun readAll(service: String): List<Pair<String, PersistedEntry>> {
    val preferences = preferencesFor(service)
    val entries = mutableListOf<Pair<String, PersistedEntry>>()
    for ((rawKey, value) in preferences.all) {
      if (value is String) {
        val entry = PersistedEntry.fromJson(value)
        if (entry != null) {
          entries.add(rawKey to entry)
        }
      }
    }
    return entries
  }

  fun clear(service: String) {
    val preferences = preferencesFor(service)
    check(preferences.edit().clear().commit()) {
      "Could not clear SensitiveInfo service."
    }
  }

  private fun preferencesFor(service: String): SharedPreferences {
    val fileName = resolver.preferencesFileFor(service)
    return applicationContext.getSharedPreferences(fileName, Context.MODE_PRIVATE)
  }
}
