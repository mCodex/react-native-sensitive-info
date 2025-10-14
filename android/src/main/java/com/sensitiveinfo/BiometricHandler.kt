package com.sensitiveinfo

import android.app.Activity
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import androidx.annotation.MainThread
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.security.KeyStore
import java.util.concurrent.Executors
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec

internal class BiometricHandler(
  private val reactContext: ReactApplicationContext,
  private val keyStoreManager: KeyStoreManager,
  private val cryptoManager: CryptoManager
) {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var activePrompt: BiometricPrompt? = null

  fun isBiometricAvailable(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return false
    }
    val manager = BiometricManager.from(reactContext)
    val result = manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
    return result == BiometricManager.BIOMETRIC_SUCCESS
  }

  fun hasEnrolledBiometrics(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return false
    }
    val manager = BiometricManager.from(reactContext)
    val result = manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
    return result != BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED && result != BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE
  }

  fun cancelOngoing() {
    activePrompt?.cancelAuthentication()
    activePrompt = null
  }

  fun encryptWithBiometrics(
    plainText: String,
    prompt: PromptOptions,
    promise: Promise,
    emitEvents: Boolean,
    onSuccess: (String) -> Unit
  ) {
    if (!prepare(prompt, promise)) {
      return
    }

    try {
      keyStoreManager.ensureBiometricKey()
  val cipher = createBiometricCipher(Cipher.ENCRYPT_MODE)
      authenticate(cipher, prompt, promise, emitEvents) { resultCipher ->
        val payload = cryptoManager.encryptBiometricPayload(plainText, resultCipher)
        onSuccess(payload)
      }
    } catch (error: Exception) {
      promise.reject(error)
    }
  }

  fun decryptWithBiometrics(
    payload: String,
    prompt: PromptOptions,
    promise: Promise,
    emitEvents: Boolean,
    onSuccess: (String) -> Unit
  ) {
    if (!prepare(prompt, promise)) {
      return
    }

    val parts = payload.split(DELIMITER)
    if (parts.size != 2) {
      promise.reject("DecryptionFailed", "Stored value format is invalid")
      return
    }

    try {
      keyStoreManager.ensureBiometricKey()
      val secretKey = keyStoreManager.keyStore.getSecretKey(BIOMETRIC_ALIAS)
      val iv = Base64.decode(parts[0], Base64.DEFAULT)
      val cipherBytes = Base64.decode(parts[1], Base64.DEFAULT)
      val cipher = Cipher.getInstance(AES_CBC_PKCS7)
      cipher.init(Cipher.DECRYPT_MODE, secretKey, IvParameterSpec(iv))

      authenticate(cipher, prompt, promise, emitEvents) { resultCipher ->
        val decrypted = resultCipher.doFinal(cipherBytes)
        onSuccess(String(decrypted, Charsets.UTF_8))
      }
    } catch (error: Exception) {
      promise.reject(error)
    }
  }

  private fun prepare(prompt: PromptOptions, promise: Promise): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      promise.reject("E_BIOMETRIC_NOT_SUPPORTED", "Biometrics not supported")
      return false
    }

    val activity = currentFragmentActivity()
    if (activity == null) {
      promise.reject("E_ACTIVITY_DOES_NOT_EXIST", "Current activity is null")
      return false
    }

    if (!isBiometricAvailable()) {
      promise.reject("E_BIOMETRIC_NOT_SUPPORTED", "Biometrics not supported")
      return false
    }

    return true
  }

  private fun authenticate(
    cipher: Cipher,
    prompt: PromptOptions,
    promise: Promise,
    emitEvents: Boolean,
    onSuccess: (Cipher) -> Unit
  ) {
    val activity = currentFragmentActivity() ?: run {
      promise.reject("E_ACTIVITY_DOES_NOT_EXIST", "Current activity is null")
      return
    }

    mainHandler.post {
      val executor = Executors.newSingleThreadExecutor()
      val callback = object : BiometricPrompt.AuthenticationCallback() {
        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
          activePrompt = null
          val resultCipher = result.cryptoObject?.cipher
          if (resultCipher == null) {
            promise.reject("E_NO_CIPHER", "Cipher missing from authentication result")
            return
          }
          onSuccess(resultCipher)
        }

        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
          activePrompt = null
          promise.reject(errorCode.toString(), errString.toString())
        }

        override fun onAuthenticationFailed() {
          if (emitEvents) {
            emitEvent(AppConstants.E_AUTHENTICATION_NOT_RECOGNIZED, "Authentication not recognized.")
          }
        }
      }

      val promptInfo = BiometricPrompt.PromptInfo.Builder()
        .setTitle(prompt.header ?: DEFAULT_TITLE)
        .setDescription(prompt.description)
        .setSubtitle(prompt.hint)
        .apply {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
          } else {
            @Suppress("DEPRECATION")
            setNegativeButtonText(prompt.cancel ?: DEFAULT_CANCEL)
          }
        }
        .build()

      val biometricPrompt = BiometricPrompt(activity, executor, callback)
      activePrompt = biometricPrompt

      try {
        biometricPrompt.authenticate(promptInfo, BiometricPrompt.CryptoObject(cipher))
      } catch (error: IllegalArgumentException) {
        promise.reject("E_BIOMETRIC_START", error.message)
        activePrompt = null
      }
    }
  }

  private fun createBiometricCipher(mode: Int): Cipher {
    val secretKey = keyStoreManager.keyStore.getSecretKey(BIOMETRIC_ALIAS)
    return Cipher.getInstance(AES_CBC_PKCS7).apply {
      init(mode, secretKey)
    }
  }

  private fun currentFragmentActivity(): FragmentActivity? {
    val activity: Activity = reactContext.currentActivity ?: return null
    return activity as? FragmentActivity
  }

  private fun emitEvent(name: String, payload: String) {
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(name, payload)
  }

  data class PromptOptions(
    val header: String?,
    val description: String?,
    val hint: String?,
    val cancel: String?,
    val emitFingerprintEvents: Boolean
  )

  companion object {
    private const val AES_CBC_PKCS7 = "AES/CBC/PKCS7Padding"
    private const val BIOMETRIC_ALIAS = "MyAesKeyAlias"
    private const val DELIMITER = "]"
    private const val DEFAULT_TITLE = "Unlock with biometrics"
    private const val DEFAULT_CANCEL = "Cancel"
  }
}

private fun KeyStore.getSecretKey(alias: String) = (getEntry(alias, null) as KeyStore.SecretKeyEntry).secretKey
