package com.sensitiveinfo.internal.crypto

data class EncryptionResult(
  val ciphertext: ByteArray,
  val iv: ByteArray
)
