package com.sensitiveinfo.internal.crypto

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.sensitiveinfo.internal.util.AliasGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import javax.crypto.KeyGenerator
import javax.crypto.Mac
import javax.crypto.SecretKey

private const val ANDROID_KEY_STORE = "AndroidKeyStore"

/**
 * Computes and verifies an HMAC-SHA256 tag over each entry's `(service, key, keyVersion, iv,
 * ciphertext, accessControl, securityLevel, timestamp)` tuple using a per-service Keystore-bound
 * HMAC key. The tag closes the gap left by AES-GCM, which only authenticates ciphertext + IV but
 * not the surrounding metadata living in SharedPreferences.
 *
 * The HMAC key itself is hardware-backed but does not require user authentication so that
 * tamper detection can run *before* a biometric prompt is shown for the actual decrypt.
 */
internal class MetadataIntegrity {
  private val keyStore: KeyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }

  /**
   * Process-local cache of resolved Keystore HMAC handles. The handles themselves are opaque
   * references that route to the secure hardware on each operation, so caching them avoids a
   * synchronous JNI round-trip per sign/verify without leaking key material into app memory.
   */
  private val keyCache = ConcurrentHashMap<String, SecretKey>()

  fun sign(input: IntegrityInput): String {
    val mac = macFor(input.service)
    val tag = mac.doFinal(canonicalBytes(input))
    return android.util.Base64.encodeToString(tag, android.util.Base64.NO_WRAP)
  }

  fun verify(input: IntegrityInput, expectedTag: String?): Boolean {
    if (expectedTag == null) return true // legacy entries written before integrity tags shipped
    val expected = try {
      android.util.Base64.decode(expectedTag, android.util.Base64.NO_WRAP)
    } catch (_: Throwable) {
      return false
    }
    val actual = macFor(input.service).doFinal(canonicalBytes(input))
    return MessageDigest.isEqual(actual, expected)
  }

  private fun macFor(service: String): Mac {
    val mac = Mac.getInstance(HMAC_ALGORITHM)
    mac.init(getOrCreateKey(service))
    return mac
  }

  private fun getOrCreateKey(service: String): SecretKey {
    keyCache[service]?.let { return it }
    val alias = AliasGenerator.hmacAliasFor(service)
    synchronized(keyStore) {
      keyCache[service]?.let { return it }
      val existing = keyStore.getEntry(alias, null) as? KeyStore.SecretKeyEntry
      val key = existing?.secretKey ?: run {
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_HMAC_SHA256, ANDROID_KEY_STORE)
        val spec = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
          .setDigests(KeyProperties.DIGEST_SHA256)
          .build()
        generator.init(spec)
        generator.generateKey()
      }
      keyCache[service] = key
      return key
    }
  }

  private fun canonicalBytes(input: IntegrityInput): ByteArray {
    val parts = listOf(
      input.service,
      input.key,
      input.keyVersion.toString(),
      input.accessControl,
      input.securityLevel,
      input.timestamp.toRawBits().toString()
    )
    val header = parts.joinToString(separator = "|").toByteArray(Charsets.UTF_8)
    return header + DELIMITER + input.iv + DELIMITER + input.ciphertext
  }

  companion object {
    private const val HMAC_ALGORITHM = "HmacSHA256"
    private val DELIMITER = byteArrayOf(0x1f) // ASCII unit separator — not a valid UTF-8 char
  }
}

/** All inputs required to compute or verify an entry's metadata integrity tag. */
internal data class IntegrityInput(
  val service: String,
  val key: String,
  val keyVersion: Int,
  val accessControl: String,
  val securityLevel: String,
  val timestamp: Double,
  val iv: ByteArray,
  val ciphertext: ByteArray
)
