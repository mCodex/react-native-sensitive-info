package com.margelo.nitro.sensitiveinfo

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise
import com.margelo.nitro.NitroModules
import java.security.KeyStore
import javax.crypto.KeyGenerator

/**
 * Secure storage implementation with multiple security levels.
 * Uses AndroidX EncryptedSharedPreferences with StrongBox when available.
 * Note: Biometric authentication must be handled at the JavaScript layer.
 */
@DoNotStrip
class SensitiveInfo : HybridSensitiveInfoSpec() {
  // Access ReactApplicationContext provided by NitroModules
  private val context: Context
    get() = NitroModules.applicationContext
      ?: throw IllegalStateException("ReactApplicationContext is null")

  companion object {
    private const val STRONGBOX_KEYSTORE_ALIAS = "SensitiveInfoStrongBoxKey"
  }

  // Standard EncryptedSharedPreferences
  private val standardPrefs by lazy {
    val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)

    EncryptedSharedPreferences.create(
      "react_native_sensitive_info_standard",
      masterKeyAlias,
      context,
      EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
      EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
  }

  // StrongBox EncryptedSharedPreferences (API 28+)
  private val strongBoxPrefs by lazy {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && isStrongBoxAvailableInternal()) {
      try {
        val masterKeyAlias = MasterKeys.getOrCreate(
          KeyGenParameterSpec.Builder(
            STRONGBOX_KEYSTORE_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
          )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setIsStrongBoxBacked(true)
            .build()
        )

        EncryptedSharedPreferences.create(
          "react_native_sensitive_info_strongbox",
          masterKeyAlias,
          context,
          EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
          EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
      } catch (e: Exception) {
        // Fallback to standard if StrongBox fails
        standardPrefs
      }
    } else {
      standardPrefs
    }
  }

  // Biometric storage uses standard encryption but requires JS-level authentication
  private val biometricPrefs by lazy {
    val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)

    EncryptedSharedPreferences.create(
      "react_native_sensitive_info_biometric",
      masterKeyAlias,
      context,
      EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
      EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
  }

  private fun getPreferencesForSecurityLevel(securityLevel: SecurityLevel?): android.content.SharedPreferences {
    return when (securityLevel) {
      SecurityLevel.BIOMETRIC -> {
        // Check if biometric authentication is available
        if (isBiometricAvailableInternal()) {
          biometricPrefs
        } else {
          // Fallback to StrongBox if available, otherwise standard
          val fallbackLevel = if (isStrongBoxAvailableInternal()) "strongbox" else "standard"
          println("⚠️ SensitiveInfo: Biometric authentication not available, falling back to $fallbackLevel")
          if (isStrongBoxAvailableInternal()) strongBoxPrefs else standardPrefs
        }
      }
      SecurityLevel.STRONGBOX -> {
        // Check if StrongBox is available
        if (isStrongBoxAvailableInternal()) {
          strongBoxPrefs
        } else {
          // Fallback to biometric if available, otherwise standard
          val fallbackLevel = if (isBiometricAvailableInternal()) "biometric" else "standard"
          println("⚠️ SensitiveInfo: StrongBox not available, falling back to $fallbackLevel")
          if (isBiometricAvailableInternal()) biometricPrefs else standardPrefs
        }
      }
      else -> standardPrefs
    }
  }

  @DoNotStrip
  override fun getItem(key: String, options: StorageOptions?): Promise<String?> = Promise.async {
    val securityLevel = options?.securityLevel
    val prefs = getPreferencesForSecurityLevel(securityLevel)
    prefs.getString(key, null)
  }

  @DoNotStrip
  override fun setItem(key: String, value: String, options: StorageOptions?): Promise<Unit> = Promise.async {
    val securityLevel = options?.securityLevel
    val prefs = getPreferencesForSecurityLevel(securityLevel)
    prefs.edit().putString(key, value).apply()
  }

  @DoNotStrip
  override fun removeItem(key: String, options: StorageOptions?): Promise<Unit> = Promise.async {
    val securityLevel = options?.securityLevel
    val prefs = getPreferencesForSecurityLevel(securityLevel)
    prefs.edit().remove(key).apply()
  }

  @DoNotStrip
  override fun getAllItems(options: StorageOptions?): Promise<Map<String, String>> = Promise.async {
    val securityLevel = options?.securityLevel
    val prefs = getPreferencesForSecurityLevel(securityLevel)
    prefs.all.mapValues { it.value as? String ?: "" }
  }

  @DoNotStrip
  override fun clear(options: StorageOptions?): Promise<Unit> = Promise.async {
    val securityLevel = options?.securityLevel
    val prefs = getPreferencesForSecurityLevel(securityLevel)
    prefs.edit().clear().apply()
  }

  @DoNotStrip
  override fun isBiometricAvailable(): Promise<Boolean> = Promise.async {
    isBiometricAvailableInternal()
  }

  @DoNotStrip
  override fun isStrongBoxAvailable(): Promise<Boolean> = Promise.async {
    isStrongBoxAvailableInternal()
  }

  private fun isBiometricAvailableInternal(): Boolean {
    val biometricManager = BiometricManager.from(context)
    return when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
      BiometricManager.BIOMETRIC_SUCCESS -> true
      else -> false
    }
  }

  private fun isStrongBoxAvailableInternal(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      try {
        val keyStore = KeyStore.getInstance("AndroidKeyStore")
        keyStore.load(null)

        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        val keyGenParameterSpec = KeyGenParameterSpec.Builder(
          "test_strongbox_key",
          KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
          .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
          .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
          .setIsStrongBoxBacked(true)
          .build()

        keyGenerator.init(keyGenParameterSpec)
        keyGenerator.generateKey()
        
        // Clean up test key
        keyStore.deleteEntry("test_strongbox_key")
        true
      } catch (e: Exception) {
        false
      }
    } else {
      false
    }
  }
}
