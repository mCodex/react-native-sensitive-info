package com.margelo.nitro.sensitiveinfo

import android.content.Context
import android.app.Activity
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.nitro.core.Promise
import com.margelo.nitro.NitroModules
import java.security.KeyStore
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import javax.crypto.KeyGenerator

/**
 * Secure storage implementation with multiple security levels.
 *
 * - Standard: AES-256-GCM via EncryptedSharedPreferences
 * - Biometric: Same storage, but guarded by a JS-level biometric check
 * - StrongBox: Hardware-backed keys on supported devices (API 28+)
 *
 * Note: Biometric authentication is handled at the JS layer to allow
 * unified prompts and fallback behavior across platforms.
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

  // --- Standard EncryptedSharedPreferences ---
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

  // --- StrongBox EncryptedSharedPreferences (API 28+) ---
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

  // --- Biometric ---
  // Uses standard encryption but requires JS-level biometric authentication
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

  /**
   * Map a requested security level to the appropriate SharedPreferences.
   * Applies graceful fallbacks (biometric -> strongbox -> standard).
   */
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

  /**
   * Get an item by key at the requested security level.
   */
  @DoNotStrip
  override fun getItem(key: String, options: StorageOptions?): Promise<String?> = Promise.async {
  authenticateIfNeeded(options)
    val securityLevel = options?.securityLevel
    val prefs = getPreferencesForSecurityLevel(securityLevel)
    prefs.getString(key, null)
  }

  /**
   * Store a key/value pair at the requested security level.
   */
  @DoNotStrip
  override fun setItem(key: String, value: String, options: StorageOptions?): Promise<Unit> = Promise.async {
  authenticateIfNeeded(options)
    val securityLevel = options?.securityLevel
    val prefs = getPreferencesForSecurityLevel(securityLevel)
    prefs.edit().putString(key, value).apply()
  }

  /**
   * Remove a single item.
   */
  @DoNotStrip
  override fun removeItem(key: String, options: StorageOptions?): Promise<Unit> = Promise.async {
  authenticateIfNeeded(options)
    val securityLevel = options?.securityLevel
    val prefs = getPreferencesForSecurityLevel(securityLevel)
    prefs.edit().remove(key).apply()
  }

  /**
   * Return all items for the selected backing store.
   */
  @DoNotStrip
  override fun getAllItems(options: StorageOptions?): Promise<Map<String, String>> = Promise.async {
  authenticateIfNeeded(options)
    val securityLevel = options?.securityLevel
    val prefs = getPreferencesForSecurityLevel(securityLevel)
    prefs.all.mapValues { it.value as? String ?: "" }
  }

  /**
   * Clear all items for the selected backing store.
   */
  @DoNotStrip
  override fun clear(options: StorageOptions?): Promise<Unit> = Promise.async {
  authenticateIfNeeded(options)
    val securityLevel = options?.securityLevel
    val prefs = getPreferencesForSecurityLevel(securityLevel)
    prefs.edit().clear().apply()
  }

  /** Check if biometric authentication is available on this device. */
  @DoNotStrip
  override fun isBiometricAvailable(): Promise<Boolean> = Promise.async {
    isBiometricAvailableInternal()
  }

  /** Check if StrongBox hardware security is available. */
  @DoNotStrip
  override fun isStrongBoxAvailable(): Promise<Boolean> = Promise.async {
    isStrongBoxAvailableInternal()
  }

  /** Internal: Detect biometric availability via BiometricManager. */
  private fun isBiometricAvailableInternal(): Boolean {
    val biometricManager = BiometricManager.from(context)
    return when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
      BiometricManager.BIOMETRIC_SUCCESS -> true
      else -> false
    }
  }

  /** Internal: Probe StrongBox by generating a temporary key. */
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

// --- Biometric helper ---
private fun SensitiveInfo.authenticateIfNeeded(options: StorageOptions?) {
  if (options?.securityLevel != SecurityLevel.BIOMETRIC) return

  val reactContext = NitroModules.applicationContext as? ReactApplicationContext
    ?: throw IllegalStateException("ReactApplicationContext is null")
  val activity = reactContext.currentActivity as? FragmentActivity
    ?: throw IllegalStateException("Current Activity is null for biometric prompt")

  val manager = BiometricManager.from(activity)
  val allowCredential = options.biometricOptions?.allowDeviceCredential == true
  val authenticators = if (allowCredential)
    BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
  else
    BiometricManager.Authenticators.BIOMETRIC_STRONG

  val can = manager.canAuthenticate(authenticators)
  if (can != BiometricManager.BIOMETRIC_SUCCESS) {
    // Skip prompting so the storage layer can apply its own fallback choice
    return
  }

  // Set up synchronization and state
  val latch = CountDownLatch(1)
  var success = false
  var error: Exception? = null

  val executor = ContextCompat.getMainExecutor(activity)
  activity.runOnUiThread {
    val callback = object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
        error = Exception(errString.toString())
        latch.countDown()
      }
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        success = true
        latch.countDown()
      }
      override fun onAuthenticationFailed() {
        // Ignored; prompt stays open until user cancels or succeeds
      }
    }

    val prompt = BiometricPrompt(activity, executor, callback)
    val builder = BiometricPrompt.PromptInfo.Builder()
      .setTitle(options.biometricOptions?.promptTitle ?: "Authenticate")
      .setSubtitle(options.biometricOptions?.promptSubtitle)
      .setDescription(options.biometricOptions?.promptDescription)

    if (allowCredential) {
      builder.setAllowedAuthenticators(authenticators)
    } else {
      builder.setNegativeButtonText(options.biometricOptions?.cancelButtonText ?: "Cancel")
    }

    prompt.authenticate(builder.build())
  }

  // Wait for result (with a generous timeout to avoid deadlocks)
  latch.await(2, TimeUnit.MINUTES)
  if (!success) {
    throw (error ?: Exception("Authentication failed"))
  }
}
