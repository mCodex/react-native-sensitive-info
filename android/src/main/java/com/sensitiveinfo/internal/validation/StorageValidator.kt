package com.sensitiveinfo.internal.validation

import com.margelo.nitro.sensitiveinfo.SensitiveInfoOptions

/**
 * Validates storage requests and provides actionable error messages.
 *
 * Responsibilities:
 * - Validate key format and length
 * - Validate value size constraints
 * - Validate service identifiers
 * - Validate options consistency
 *
 * This interface allows for different validation strategies across
 * Android versions and device capabilities.
 *
 * @since 6.0.0
 */
interface StorageValidator {
  /**
   * Validates a storage key.
   *
   * @param key The key to validate
   * @throws IllegalArgumentException if validation fails with descriptive message
   */
  fun validateKey(key: String)

  /**
   * Validates a storage value.
   *
   * @param value The value to validate
   * @throws IllegalArgumentException if validation fails with descriptive message
   */
  fun validateValue(value: String)

  /**
   * Validates storage options.
   *
   * @param options The options to validate
   * @throws IllegalArgumentException if validation fails with descriptive message
   */
  fun validateOptions(options: SensitiveInfoOptions?)
}

/**
 * Standard implementation of StorageValidator with Android-specific constraints.
 *
 * Enforces:
 * - Non-empty, max-255-character keys (Keystore alias limitation)
 * - Values up to 100MB (reasonable limit for mobile)
 * - Valid service identifiers
 *
 * @since 6.0.0
 */
class AndroidStorageValidator : StorageValidator {
  companion object {
    private const val MAX_KEY_LENGTH = 255
    private const val MAX_VALUE_SIZE = 100 * 1024 * 1024  // 100 MB
    private const val MAX_SERVICE_LENGTH = 512
  }

  override fun validateKey(key: String) {
    when {
      key.isEmpty() -> throw IllegalArgumentException(
        "[E_INVALID_KEY] Key must not be empty"
      )
      key.length > MAX_KEY_LENGTH -> throw IllegalArgumentException(
        "[E_INVALID_KEY] Key must not exceed $MAX_KEY_LENGTH characters, got ${key.length}"
      )
    }
  }

  override fun validateValue(value: String) {
    val sizeBytes = value.toByteArray(Charsets.UTF_8).size
    when {
      sizeBytes > MAX_VALUE_SIZE -> throw IllegalArgumentException(
        "[E_VALUE_TOO_LARGE] Value must not exceed ${MAX_VALUE_SIZE / 1024 / 1024}MB, got ${sizeBytes / 1024 / 1024}MB"
      )
    }
  }

  override fun validateOptions(options: SensitiveInfoOptions?) {
    options?.service?.let { service ->
      when {
        service.isEmpty() -> throw IllegalArgumentException(
          "[E_INVALID_SERVICE] Service must not be empty"
        )
        service.length > MAX_SERVICE_LENGTH -> throw IllegalArgumentException(
          "[E_INVALID_SERVICE] Service must not exceed $MAX_SERVICE_LENGTH characters, got ${service.length}"
        )
      }
    }
  }
}
