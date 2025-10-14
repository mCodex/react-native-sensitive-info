package com.sensitiveinfo.internal.crypto

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import androidx.biometric.BiometricManager.Authenticators
import com.margelo.nitro.sensitiveinfo.AuthenticationPrompt
import com.margelo.nitro.sensitiveinfo.AccessControl
import com.margelo.nitro.sensitiveinfo.SecurityLevel
import com.sensitiveinfo.internal.auth.BiometricAuthenticator
import java.security.KeyStore
import java.security.UnrecoverableKeyException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

private const val ANDROID_KEY_STORE = "AndroidKeyStore"
private const val TRANSFORMATION = "AES/GCM/NoPadding"

internal class CryptoManager(
  private val authenticator: BiometricAuthenticator
) {
  private val keyStore: KeyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }

  suspend fun encrypt(
    alias: String,
    plaintext: ByteArray,
    resolution: AccessResolution,
    prompt: AuthenticationPrompt?
  ): EncryptionResult {
    val key = getOrCreateKey(alias, resolution)
    val cipher = Cipher.getInstance(TRANSFORMATION)

    try {
      cipher.init(Cipher.ENCRYPT_MODE, key)
    } catch (invalidated: KeyPermanentlyInvalidatedException) {
      deleteKey(alias)
      throw IllegalStateException("Encryption key invalidated. Item must be recreated.", invalidated)
    }

    val readyCipher = if (resolution.requiresAuthentication) {
      authenticator.authenticate(prompt, resolution.allowedAuthenticators, cipher)
    } else {
      cipher
    }

    val ciphertext = readyCipher.doFinal(plaintext)
    return EncryptionResult(ciphertext = ciphertext, iv = readyCipher.iv)
  }

  suspend fun decrypt(
    alias: String,
    ciphertext: ByteArray,
    iv: ByteArray,
    resolution: AccessResolution,
    prompt: AuthenticationPrompt?
  ): ByteArray {
    val key = getOrCreateKey(alias, resolution)
    val cipher = Cipher.getInstance(TRANSFORMATION)

    try {
      val spec = GCMParameterSpec(128, iv)
      cipher.init(Cipher.DECRYPT_MODE, key, spec)
    } catch (invalidated: KeyPermanentlyInvalidatedException) {
      deleteKey(alias)
      throw IllegalStateException("Decryption key invalidated. Item must be recreated.", invalidated)
    } catch (unrecoverable: UnrecoverableKeyException) {
      deleteKey(alias)
      throw IllegalStateException("Decryption key unavailable. Item must be recreated.", unrecoverable)
    }

    val readyCipher = if (resolution.requiresAuthentication) {
      authenticator.authenticate(prompt, resolution.allowedAuthenticators, cipher)
    } else {
      cipher
    }

    return readyCipher.doFinal(ciphertext)
  }

  fun deleteKey(alias: String) {
    try {
      keyStore.deleteEntry(alias)
    } catch (_: Throwable) {
      // Best effort cleanup.
    }
  }

  fun buildResolutionForPersisted(
    accessControl: AccessControl,
    securityLevel: SecurityLevel,
    authenticators: Int,
    requiresAuth: Boolean,
    invalidateOnEnrollment: Boolean,
    useStrongBox: Boolean
  ): AccessResolution {
    return AccessResolution(
      accessControl = accessControl,
      securityLevel = securityLevel,
      requiresAuthentication = requiresAuth,
      allowedAuthenticators = authenticators,
      useStrongBox = useStrongBox,
      invalidateOnEnrollment = invalidateOnEnrollment
    )
  }

  private fun getOrCreateKey(alias: String, resolution: AccessResolution): SecretKey {
    synchronized(keyStore) {
      val existing = keyStore.getEntry(alias, null) as? KeyStore.SecretKeyEntry
      if (existing != null) {
        return existing.secretKey
      }
      return generateKey(alias, resolution)
    }
  }

  private fun generateKey(alias: String, resolution: AccessResolution): SecretKey {
    val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE)
    val purposes = KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
    val builder = KeyGenParameterSpec.Builder(alias, purposes)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setRandomizedEncryptionRequired(true)
      .setKeySize(256)

    applyAuthentication(builder, resolution)

    if (resolution.useStrongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      try {
        builder.setIsStrongBoxBacked(true)
      } catch (_: Throwable) {
        // Devices may report support but disallow allocation at runtime. We silently continue.
      }
    }

    val spec = builder.build()
    keyGenerator.init(spec)
    return try {
      keyGenerator.generateKey()
    } catch (strongBoxUnavailable: StrongBoxUnavailableException) {
      throw IllegalStateException("StrongBox is unavailable for SensitiveInfo keys.", strongBoxUnavailable)
    }
  }

  private fun applyAuthentication(builder: KeyGenParameterSpec.Builder, resolution: AccessResolution) {
    if (!resolution.requiresAuthentication) {
      return
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val sanitized = sanitizeAuthenticators(resolution.allowedAuthenticators)
      builder.setUserAuthenticationParameters(0, sanitized)
    } else {
      builder.setUserAuthenticationRequired(true)
      builder.setUserAuthenticationValidityDurationSeconds(1)
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      builder.setInvalidatedByBiometricEnrollment(resolution.invalidateOnEnrollment)
    }

    if (resolution.accessControl == AccessControl.DEVICEPASSCODE) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        builder.setUnlockedDeviceRequired(true)
      }
    }
  }

  private fun sanitizeAuthenticators(value: Int): Int {
    var sanitized = value
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      sanitized = sanitized and (Authenticators.BIOMETRIC_STRONG or Authenticators.DEVICE_CREDENTIAL)
    }
    if (sanitized == 0) {
      sanitized = Authenticators.BIOMETRIC_STRONG
    }
    return sanitized
  }
}
