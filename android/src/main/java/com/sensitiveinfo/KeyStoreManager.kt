package com.sensitiveinfo

import android.content.Context
import android.os.Build
import android.security.KeyPairGeneratorSpec
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Log
import java.math.BigInteger
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.util.Calendar
import javax.crypto.KeyGenerator

@Suppress("DEPRECATION")
internal class KeyStoreManager(private val context: Context) {
  private val applicationContext get() = context.applicationContext

  val keyStore: KeyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply {
    load(null)
  }

  @Volatile
  var invalidateOnEnrollment: Boolean = true
    set(value) {
      field = value
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        runCatching { ensureBiometricKey(forceRecreate = true) }
          .onFailure { Log.w(TAG, "Failed to re-create biometric key", it) }
      }
    }

  fun ensureGeneralKey() {
    if (keyStore.containsAlias(GENERAL_ALIAS)) {
      return
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE)
      val spec = KeyGenParameterSpec.Builder(
        GENERAL_ALIAS,
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
      )
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build()
      keyGenerator.init(spec)
      keyGenerator.generateKey()
    } else {
      @Suppress("DEPRECATION")
      val notBefore = Calendar.getInstance()
      val notAfter = Calendar.getInstance().apply { add(Calendar.YEAR, 25) }
      val spec = KeyPairGeneratorSpec.Builder(applicationContext)
        .setAlias(GENERAL_ALIAS)
        .setSerialNumber(BigInteger.valueOf(1337))
        .setSubject(javax.security.auth.x500.X500Principal("CN=$GENERAL_ALIAS"))
        .setStartDate(notBefore.time)
        .setEndDate(notAfter.time)
        .build()
      val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, ANDROID_KEY_STORE)
      generator.initialize(spec)
      generator.generateKeyPair()
    }
  }

  fun ensureBiometricKey(forceRecreate: Boolean = false) {
    if (!forceRecreate && keyStore.containsAlias(BIOMETRIC_ALIAS)) {
      return
    }

    if (keyStore.containsAlias(BIOMETRIC_ALIAS)) {
      keyStore.deleteEntry(BIOMETRIC_ALIAS)
    }

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return
    }

    val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE)
    val builder = KeyGenParameterSpec.Builder(
      BIOMETRIC_ALIAS,
      KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
    )
      .setBlockModes(KeyProperties.BLOCK_MODE_CBC)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_PKCS7)
      .setKeySize(256)
      .setUserAuthenticationRequired(true)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      runCatching {
        builder.setInvalidatedByBiometricEnrollment(invalidateOnEnrollment)
      }.onFailure { Log.w(TAG, "Unable to set invalidateOnEnrollment flag", it) }
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
    }

    keyGenerator.init(builder.build())
    keyGenerator.generateKey()
  }

  fun deleteBiometricKey() {
    if (keyStore.containsAlias(BIOMETRIC_ALIAS)) {
      keyStore.deleteEntry(BIOMETRIC_ALIAS)
    }
  }

  companion object {
    private const val ANDROID_KEY_STORE = "AndroidKeyStore"
    private const val GENERAL_ALIAS = "MySharedPreferenceKeyAlias"
    private const val BIOMETRIC_ALIAS = "MyAesKeyAlias"
    private const val TAG = "SensitiveInfo.Keys"
  }
}
