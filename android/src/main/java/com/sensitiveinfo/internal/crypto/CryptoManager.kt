package com.sensitiveinfo.internal.crypto

import android.app.KeyguardManager
import android.content.Context
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
import kotlin.coroutines.cancellation.CancellationException

private const val ANDROID_KEY_STORE = "AndroidKeyStore"
private const val TRANSFORMATION = "AES/GCM/NoPadding"

/**
 * Handles Android Keystore interactions (AES/GCM keys, biometric gating, alias cleanup).
 *
 * Callers supply an alias and the resolved `AccessResolution` (which captures whether StrongBox,
 * biometrics, or device credentials are required). The manager takes care of provisioning keys,
 * invoking the biometric prompt, and transparently rebuilding the resolution for entries fetched
 * from disk.
 */
internal class CryptoManager(
  private val authenticator: BiometricAuthenticator,
  private val context: Context
) {
  private val keyStore: KeyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }

  private fun hasSecureLockScreen(): Boolean {
    val keyguard = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
    return keyguard?.isDeviceLocked == true
  }

  /** Encrypts data and returns the ciphertext plus generated IV. */
  suspend fun encrypt(
    alias: String,
    plaintext: ByteArray,
    resolution: AccessResolution,
    prompt: AuthenticationPrompt?,
    aad: ByteArray? = null
  ): EncryptionResult {
    val key = getOrCreateKey(alias, resolution)
    val cipher = Cipher.getInstance(TRANSFORMATION)
    val requiresAuth = resolution.requiresAuthentication
    val supportsKeystoreAuth = requiresAuth && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q

    val readyCipher = try {
      if (!requiresAuth) {
        initCipher(cipher, Cipher.ENCRYPT_MODE, key, null, alias)
      } else if (supportsKeystoreAuth) {
        initCipher(cipher, Cipher.ENCRYPT_MODE, key, null, alias)
        val authenticated = authenticator.authenticate(prompt, resolution.allowedAuthenticators, cipher)
        (authenticated ?: cipher)
      } else {
        authenticator.authenticate(prompt, resolution.allowedAuthenticators, null)
        initCipher(cipher, Cipher.ENCRYPT_MODE, key, null, alias)
      }
    } catch (error: CancellationException) {
      throw error
    }

    if (aad != null) {
      readyCipher.updateAAD(aad)
    }
    return try {
      val ciphertext = readyCipher.doFinal(plaintext)
      EncryptionResult(ciphertext = ciphertext, iv = readyCipher.iv)
    } finally {
      plaintext.fill(0)
    }
  }

  /** Decrypts an item using the preconfigured alias, IV, and policy. */
  suspend fun decrypt(
    alias: String,
    ciphertext: ByteArray,
    iv: ByteArray,
    resolution: AccessResolution,
    prompt: AuthenticationPrompt?,
    aad: ByteArray? = null
  ): ByteArray {
    val key = getOrCreateKey(alias, resolution)
    val cipher = Cipher.getInstance(TRANSFORMATION)
    val spec = GCMParameterSpec(128, iv)
    val requiresAuth = resolution.requiresAuthentication
    val supportsKeystoreAuth = requiresAuth && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q

    val readyCipher = try {
      if (!requiresAuth) {
        initCipher(cipher, Cipher.DECRYPT_MODE, key, spec, alias)
      } else if (supportsKeystoreAuth) {
        initCipher(cipher, Cipher.DECRYPT_MODE, key, spec, alias)
        val authenticated = authenticator.authenticate(prompt, resolution.allowedAuthenticators, cipher)
        (authenticated ?: cipher)
      } else {
        authenticator.authenticate(prompt, resolution.allowedAuthenticators, null)
        initCipher(cipher, Cipher.DECRYPT_MODE, key, spec, alias)
      }
    } catch (error: CancellationException) {
      throw error
    }

    if (aad != null) {
      readyCipher.updateAAD(aad)
    }
    return readyCipher.doFinal(ciphertext)
  }

  /** Best-effort removal of a keystore entry. */
  fun deleteKey(alias: String) {
    try {
      keyStore.deleteEntry(alias)
    } catch (_: Throwable) {
      // Best effort cleanup.
    }
  }

  private fun initCipher(
    cipher: Cipher,
    mode: Int,
    key: SecretKey,
    spec: GCMParameterSpec?,
    alias: String
  ): Cipher {
    try {
      if (spec != null) cipher.init(mode, key, spec) else cipher.init(mode, key)
    } catch (invalidated: KeyPermanentlyInvalidatedException) {
      deleteKey(alias)
      val action = if (mode == Cipher.ENCRYPT_MODE) "Encryption" else "Decryption"
      throw IllegalStateException("$action key invalidated. Item must be recreated.", invalidated)
    } catch (unrecoverable: UnrecoverableKeyException) {
      deleteKey(alias)
      val action = if (mode == Cipher.ENCRYPT_MODE) "Encryption" else "Decryption"
      throw IllegalStateException("$action key unavailable. Item must be recreated.", unrecoverable)
    }
    return cipher
  }

  /**
   * Reconstructs the resolution for data loaded from SharedPreferences,
   * using the persisted metadata as the source of truth.
   */
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

    // Defense in depth: require the device to be unlocked at the moment of use, mirroring iOS's
    // `kSecAttrAccessibleWhenUnlocked` default. Available on API 28+.
    // Skip when no secure screen lock exists — setUnlockedDeviceRequired crashes on Android 12-14
    // without one (https://issuetracker.google.com/issues/191391068, fixed in Android 15).
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && hasSecureLockScreen()) {
      try {
        builder.setUnlockedDeviceRequired(true)
      } catch (_: Throwable) {
        // Older OEM forks may reject this on devices without a screen lock. Best-effort.
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
      @Suppress("DEPRECATION")
      builder.setUserAuthenticationValidityDurationSeconds(1)
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      builder.setInvalidatedByBiometricEnrollment(resolution.invalidateOnEnrollment)
    }

    if (resolution.accessControl == AccessControl.DEVICEPASSCODE) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && hasSecureLockScreen()) {
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
