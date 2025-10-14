package com.sensitiveinfo

import android.os.Build
import android.util.Base64
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.nio.ByteBuffer
import java.security.Key
import java.security.KeyStore
import java.security.PrivateKey
import java.security.PublicKey
import javax.crypto.Cipher
import javax.crypto.CipherInputStream
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.IvParameterSpec

internal class CryptoManager(private val keyStore: KeyStore) {
  data class DecryptionResult(val value: String, val usedLegacyFormat: Boolean)

  fun encrypt(value: String): String {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val secretKey = keyStore.getSecretKey(KEY_ALIAS_GENERAL)
      val cipher = Cipher.getInstance(AES_GCM)
      cipher.init(Cipher.ENCRYPT_MODE, secretKey)

      val cipherBytes = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
      val iv = cipher.iv

      val payload = ByteBuffer.allocate(1 + iv.size + cipherBytes.size)
      payload.put(iv.size.toByte())
      payload.put(iv)
      payload.put(cipherBytes)

      NEW_VALUE_PREFIX + Base64.encodeToString(payload.array(), Base64.NO_WRAP)
    } else {
      @Suppress("DEPRECATION")
      val publicKey = keyStore.getPublicKey(KEY_ALIAS_GENERAL)
      encryptWithStreamingCipher(value, Cipher.getInstance(RSA_ECB).apply {
        init(Cipher.ENCRYPT_MODE, publicKey)
      })
    }
  }

  fun decrypt(data: String): DecryptionResult {
    return if (data.startsWith(NEW_VALUE_PREFIX)) {
      DecryptionResult(decryptV2(data), false)
    } else {
      DecryptionResult(decryptLegacy(data), true)
    }
  }

  fun encryptBiometricPayload(value: String, cipher: Cipher): String {
    val ciphertext = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
    val base64Iv = Base64.encodeToString(cipher.iv, Base64.DEFAULT)
    val base64Cipher = Base64.encodeToString(ciphertext, Base64.DEFAULT)
    return base64Iv + DELIMITER + base64Cipher
  }

  private fun decryptLegacy(data: String): String {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val secretKey = keyStore.getSecretKey(KEY_ALIAS_GENERAL)
      val cipher = Cipher.getInstance(AES_GCM)
      cipher.init(Cipher.DECRYPT_MODE, secretKey, GCMParameterSpec(128, FIXED_IV))
      val decoded = Base64.decode(data, Base64.NO_WRAP)
      val decrypted = cipher.doFinal(decoded)
      String(decrypted, Charsets.UTF_8)
    } else {
      @Suppress("DEPRECATION")
      val privateKey = keyStore.getPrivateKey(KEY_ALIAS_GENERAL)
      decryptWithStreamingCipher(data, Cipher.getInstance(RSA_ECB).apply {
        init(Cipher.DECRYPT_MODE, privateKey)
      })
    }
  }

  private fun decryptV2(data: String): String {
    val payload = Base64.decode(data.removePrefix(NEW_VALUE_PREFIX), Base64.NO_WRAP)
    if (payload.isEmpty()) {
      throw IllegalArgumentException("Empty payload")
    }

    val buffer = ByteBuffer.wrap(payload)
    val ivLength = buffer.get().toInt() and 0xFF
    require(ivLength in 12..16) { "Unexpected IV length: $ivLength" }
    require(buffer.remaining() >= ivLength) { "Corrupted payload" }

    val ivBytes = ByteArray(ivLength)
    buffer.get(ivBytes)

    val cipherBytes = ByteArray(buffer.remaining())
    buffer.get(cipherBytes)

    val secretKey = keyStore.getSecretKey(KEY_ALIAS_GENERAL)
    val cipher = Cipher.getInstance(AES_GCM)
    cipher.init(Cipher.DECRYPT_MODE, secretKey, GCMParameterSpec(128, ivBytes))

    val decrypted = cipher.doFinal(cipherBytes)
    return String(decrypted, Charsets.UTF_8)
  }

  private fun encryptWithStreamingCipher(input: String, cipher: Cipher): String {
    val inputBytes = input.toByteArray(Charsets.UTF_8)
    val inputStream = ByteArrayInputStream(inputBytes)
    val byteStream = ByteArrayOutputStream()
    val dataStream = DataOutputStream(byteStream)

    val buffer = ByteArray(STREAM_CHUNK_SIZE)
    while (inputStream.available() > STREAM_CHUNK_SIZE) {
      val read = inputStream.read(buffer)
      val chunk = cipher.update(buffer, 0, read)
      dataStream.write(chunk)
    }
    val read = inputStream.read(buffer)
    val finalChunk = cipher.doFinal(buffer, 0, read)
    dataStream.write(finalChunk)

    return Base64.encodeToString(byteStream.toByteArray(), Base64.NO_WRAP)
  }

  private fun decryptWithStreamingCipher(data: String, cipher: Cipher): String {
    val bytes = Base64.decode(data, Base64.NO_WRAP)
    val byteStream = ByteArrayInputStream(bytes)
    val dataStream = DataInputStream(byteStream)

    val cipherStream = CipherInputStream(dataStream, cipher)
    val outputStream = ByteArrayOutputStream()

    val buffer = ByteArray(STREAM_CHUNK_SIZE)
    var len = cipherStream.read(buffer)
    while (len != -1) {
      outputStream.write(buffer, 0, len)
      len = cipherStream.read(buffer)
    }

    return outputStream.toByteArray().toString(Charsets.UTF_8)
  }

  companion object {
    private const val KEY_ALIAS_GENERAL = "MySharedPreferenceKeyAlias"
    private const val KEY_ALIAS_BIOMETRIC = "MyAesKeyAlias"
    private const val AES_GCM = "AES/GCM/NoPadding"
    private const val AES_CBC_PKCS7 = "AES/CBC/PKCS7Padding"
    private const val RSA_ECB = "RSA/ECB/PKCS1Padding"
    private const val NEW_VALUE_PREFIX = "v2:"
    private const val DELIMITER = "]"
    private val FIXED_IV = byteArrayOf(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1)
    private const val STREAM_CHUNK_SIZE = 4 * 1024
  }
}

private fun KeyStore.getSecretKey(alias: String): SecretKey {
  val entry = getEntry(alias, null) as? KeyStore.SecretKeyEntry
    ?: error("SecretKey not found for alias $alias")
  return entry.secretKey
}

@Suppress("DEPRECATION")
private fun KeyStore.getPublicKey(alias: String): PublicKey {
  val entry = getEntry(alias, null) as? KeyStore.PrivateKeyEntry
    ?: error("KeyPair entry not found for alias $alias")
  return entry.certificate.publicKey
}

@Suppress("DEPRECATION")
private fun KeyStore.getPrivateKey(alias: String): PrivateKey {
  val entry = getEntry(alias, null) as? KeyStore.PrivateKeyEntry
    ?: error("KeyPair entry not found for alias $alias")
  return entry.privateKey
}
