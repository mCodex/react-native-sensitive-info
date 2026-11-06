package com.sensitiveinfo.internal.storage

import android.content.Context
import android.content.SharedPreferences

/**
 * Tracks the active master-key version for each service.
 *
 * Version numbers start at `INITIAL_VERSION` for services that have never been rotated and are
 * bumped monotonically by [bump]. The registry is backed by a dedicated, non-secret
 * [SharedPreferences] file so rotation state survives process restarts without touching the
 * Keystore.
 */
internal class KeyVersionRegistry(context: Context) {
  private val preferences: SharedPreferences = context.applicationContext
    .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  /** Returns the active version for [service], or [INITIAL_VERSION] if no rotation has occurred. */
  fun get(service: String): Int = synchronized(lock) {
    preferences.getInt(service, INITIAL_VERSION)
  }

  /** Increments and persists the version for [service], returning the new value. */
  fun bump(service: String): Int {
    return synchronized(lock) {
      val next = preferences.getInt(service, INITIAL_VERSION) + 1
      check(preferences.edit().putInt(service, next).commit()) {
        "Could not persist SensitiveInfo key version."
      }

      next
    }
  }

  companion object {
    const val INITIAL_VERSION: Int = 1
    private const val PREFS_NAME = "rnsi.key_versions"
    private val lock = Any()
  }
}
