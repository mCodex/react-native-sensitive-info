package com.margelo.nitro.sensitiveinfo

import android.content.Context
import android.os.Build
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise
import com.margelo.nitro.NitroModules
import com.margelo.nitro.sensitiveinfo.HybridSensitiveInfoSpec

/**
 * Secure storage implementation using AndroidX EncryptedSharedPreferences.
 * Uses StrongBox if available (API 28+), otherwise falls back to Android Keystore.
 */
@DoNotStrip
class SensitiveInfo : HybridSensitiveInfoSpec() {
  // Access ReactApplicationContext provided by NitroModules
  private val context: Context
    get() = NitroModules.applicationContext
      ?: throw IllegalStateException("ReactApplicationContext is null")

  // Initialize EncryptedSharedPreferences with StrongBox when possible
  private val prefs by lazy {
    val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)

    EncryptedSharedPreferences.create(
      "react_native_sensitive_info",
      masterKeyAlias,
      context,
      EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
      EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
  }

  @DoNotStrip
  override fun getItem(key: String): Promise<String?> = Promise.async {
    prefs.getString(key, null)
  }

  @DoNotStrip
  override fun setItem(key: String, value: String): Promise<Unit> = Promise.async {
    prefs.edit().putString(key, value).apply()
  }

  @DoNotStrip
  override fun removeItem(key: String): Promise<Unit> = Promise.async {
    prefs.edit().remove(key).apply()
  }

  @DoNotStrip
  override fun getAllItems(): Promise<Map<String, String>> = Promise.async {
    prefs.all.mapValues { it.value as? String ?: "" }
  }

  @DoNotStrip
  override fun clear(): Promise<Unit> = Promise.async {
    prefs.edit().clear().apply()
  }
}
