package com.sensitiveinfo

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.module.annotations.ReactModule

// React Native TurboModule exposing encrypted SharedPreferences storage backed by Android Keystore.
// The module keeps the historic JS API intact while silently re-encrypting legacy values when they are read.
@ReactModule(name = SensitiveInfoModule.NAME)
class SensitiveInfoModule internal constructor(reactContext: ReactApplicationContext) :
  NativeSensitiveInfoSpec(reactContext) {

  private val keyStoreManager = KeyStoreManager(reactContext)
  private val cryptoManager = CryptoManager(keyStoreManager.keyStore)
  private val biometricHandler = BiometricHandler(reactContext, keyStoreManager, cryptoManager)

  init {
    runCatching { keyStoreManager.ensureGeneralKey() }
      .onFailure { Log.e(NAME, "Failed to initialize keystore", it) }
  }

  override fun getName(): String = NAME

  @ReactMethod
  override fun setItem(key: String, value: String, options: ReadableMap, promise: Promise) {
    val parsed = AndroidOptions.from(options)
    val prefs = prefs(parsed.sharedPreferencesName)

    if (parsed.touchId) {
      biometricHandler.encryptWithBiometrics(
        plainText = value,
        prompt = parsed.promptOptions(),
        promise = promise,
        emitEvents = !parsed.showModal,
      ) { payload ->
        if (prefs.edit().putString(key, payload).commit()) {
          promise.resolve(null)
        } else {
          promise.rejectSafely("E_WRITE_FAILURE", "Failed to persist value for key $key")
        }
      }
      return
    }

    try {
      val encrypted = cryptoManager.encrypt(value)
      if (!prefs.edit().putString(key, encrypted).commit()) {
        promise.rejectSafely("E_WRITE_FAILURE", "Failed to persist value for key $key")
        return
      }
      // Stored value is now in the v2 format, so future reads can skip the migration branch.
      promise.resolve(null)
    } catch (error: Exception) {
      promise.rejectSafely(
        code = "E_CRYPTO_FAILURE",
        message = "Failed to encrypt value for key $key",
        throwable = error
      )
    }
  }

  @ReactMethod
  override fun getItem(key: String, options: ReadableMap, promise: Promise) {
    val parsed = AndroidOptions.from(options)
    val prefs = prefs(parsed.sharedPreferencesName)
    val stored = prefs.getString(key, null)

    if (stored == null) {
      promise.resolve(null)
      return
    }

    if (parsed.touchId) {
      biometricHandler.decryptWithBiometrics(
        payload = stored,
        prompt = parsed.promptOptions(),
        promise = promise,
        emitEvents = !parsed.showModal,
      ) { decrypted ->
        promise.resolve(decrypted)
      }
      return
    }

    try {
      val result = cryptoManager.decrypt(stored)
      promise.resolve(result.value)
      if (result.usedLegacyFormat) {
        migrateValue(key, result.value, prefs)
      }
    } catch (error: Exception) {
      promise.rejectSafely(
        code = "E_CRYPTO_FAILURE",
        message = "Failed to decrypt value for key $key",
        throwable = error
      )
    }
  }

  @ReactMethod
  override fun hasItem(key: String, options: ReadableMap, promise: Promise) {
    val parsed = AndroidOptions.from(options)
    val prefs = prefs(parsed.sharedPreferencesName)
    promise.resolve(prefs.contains(key))
  }

  @ReactMethod
  override fun getAllItems(options: ReadableMap, promise: Promise) {
    val parsed = AndroidOptions.from(options)
    val prefs = prefs(parsed.sharedPreferencesName)
    val map = prefs.all
    val entries = mutableListOf<SensitiveInfoEntry>()
    map.forEach { (entryKey, rawValue) ->
      val stored = rawValue as? String ?: return@forEach
      val decrypted = runCatching { cryptoManager.decrypt(stored) }
        .onSuccess { if (it.usedLegacyFormat) migrateValue(entryKey, it.value, prefs) }
        .map { it.value }
        .getOrElse {
          Log.w(NAME, "Failed to decrypt value for key $entryKey", it)
          stored
        }
      entries += SensitiveInfoEntry(entryKey, decrypted, parsed.sharedPreferencesName)
    }

    promise.resolve(SensitiveInfoEntry.toWritableArray(entries))
  }

  @ReactMethod
  override fun deleteItem(key: String, options: ReadableMap, promise: Promise) {
    val parsed = AndroidOptions.from(options)
    val prefs = prefs(parsed.sharedPreferencesName)
    if (!prefs.edit().remove(key).commit()) {
      promise.rejectSafely("E_REMOVE_FAILURE", "Failed to remove key $key")
      return
    }
    promise.resolve(null)
  }

  @ReactMethod
  override fun isSensorAvailable(promise: Promise) {
    promise.resolve(biometricHandler.isBiometricAvailable())
  }

  @ReactMethod
  override fun hasEnrolledFingerprints(promise: Promise) {
    promise.resolve(biometricHandler.hasEnrolledBiometrics())
  }

  @ReactMethod
  override fun cancelFingerprintAuth() {
    biometricHandler.cancelOngoing()
  }

  @ReactMethod
  override fun setInvalidatedByBiometricEnrollment(value: Boolean) {
    keyStoreManager.invalidateOnEnrollment = value
  }

  private fun migrateValue(key: String, plainText: String, prefs: SharedPreferences) {
    // Migration strategy: decrypt into memory, re-encrypt using the new random IV payload, and save it back.
    // This keeps the operation invisible to consumers while eliminating the fixed-IV legacy format.
    runCatching {
      val reEncrypted = cryptoManager.encrypt(plainText)
      prefs.edit().putString(key, reEncrypted).apply()
    }.onFailure {
      Log.w(NAME, "Failed to rewrite migrated value for key $key", it)
    }
  }

  /** Lazily resolves the SharedPreferences instance backing the secure store. */
  private fun prefs(name: String): SharedPreferences =
    reactApplicationContext.getSharedPreferences(name, Context.MODE_PRIVATE)

  /** Represents a secure entry emitted by `getAllItems`. */
  private data class SensitiveInfoEntry(val key: String, val value: String, val service: String) {
    companion object {
      fun toWritableArray(arguments: List<SensitiveInfoEntry>): com.facebook.react.bridge.WritableArray {
        val array = WritableNativeArray()
        arguments.forEach { entry ->
          val map = WritableNativeMap()
          map.putString("key", entry.key)
          map.putString("value", entry.value)
          map.putString("service", entry.service)
          array.pushMap(map)
        }
        return array
      }
    }
  }

  internal data class AndroidOptions(
    val sharedPreferencesName: String,
    val touchId: Boolean,
    val showModal: Boolean,
    val strings: Map<String, String>
  ) {
    /** Builds the localized prompts used by Android's BiometricPrompt API. */
    fun promptOptions(): BiometricHandler.PromptOptions = BiometricHandler.PromptOptions(
      header = strings["header"],
      description = strings["description"],
      hint = strings["hint"],
      cancel = strings["cancel"]
    )

    companion object {
      fun from(options: ReadableMap): AndroidOptions {
        val name = options.getStringOrNull("sharedPreferencesName") ?: "shared_preferences"
        val touchId = options.getBooleanOrDefault("touchID", false)
        val showModal = options.getBooleanOrDefault("showModal", true)
        val strings = options.getMapOrNull("strings")?.toHashMap()?.mapNotNull {
          val value = it.value as? String ?: return@mapNotNull null
          it.key to value
        }?.toMap() ?: emptyMap()
        return AndroidOptions(name, touchId, showModal, strings)
      }
    }
  }

  companion object {
    const val NAME = "SensitiveInfo"
  }
}

private fun ReadableMap.getStringOrNull(key: String): String? = if (hasKey(key) && !isNull(key)) getString(key) else null
private fun ReadableMap.getBooleanOrDefault(key: String, defaultValue: Boolean): Boolean = if (hasKey(key) && !isNull(key)) getBoolean(key) else defaultValue
private fun ReadableMap.getMapOrNull(key: String): ReadableMap? = if (hasKey(key) && !isNull(key)) getMap(key) else null

/** Logs the failure and forwards it to the JS promise interface. */
private fun Promise.rejectSafely(code: String, message: String, throwable: Throwable? = null) {
  if (throwable != null) {
    Log.e(SensitiveInfoModule.NAME, "$message ($code)", throwable)
  } else {
    Log.e(SensitiveInfoModule.NAME, "$message ($code)")
  }
  reject(code, message, throwable)
}
