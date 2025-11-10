package com.sensitiveinfo.core

/**
 * Helpful extensions for common Result operations.
 *
 * These are internal utilities used by the SensitiveInfo module.
 */

/**
 * Map a collection of Results.
 */
inline fun <T, R> Iterable<T>.mapResults(
  transform: (T) -> Result<R>
): List<Result<R>> = map(transform)

/**
 * Find first success in collection of Results.
 */
fun <T> Iterable<Result<T>>.findSuccess(): Result<T>? = find { it is Result.Success }

/**
 * Get all errors from Results.
 */
fun <T> Iterable<Result<T>>.failures(): List<Exception> =
  mapNotNull { (it as? Result.Failure)?.error }

/**
 * Combine multiple Results into one.
 */
fun <T> Iterable<Result<T>>.combine(): Result<List<T>> {
  val values = mutableListOf<T>()
  for (result in this) {
    when (result) {
      is Result.Success -> values.add(result.value)
      is Result.Failure -> return Result.failure(result.error)
    }
  }
  return Result.success(values)
}

/**
 * Execute and wrap in Result.
 */
inline fun <T> runCatching(block: () -> T): Result<T> = Result.try_(block)

/**
 * Validate that key is not empty.
 */
fun isValidStorageKey(key: String?): Boolean = !key.isNullOrEmpty() && key.length <= 255

/**
 * Validate that value is not empty.
 */
fun isValidStorageValue(value: String?): Boolean = !value.isNullOrEmpty()

/**
 * Validate that service name is valid.
 */
fun isValidService(service: String?): Boolean = !service.isNullOrEmpty()

/**
 * Generate a keystore alias from service and key.
 */
fun generateAlias(service: String, key: String): String =
  "alias_${service.replace(Regex("[^a-zA-Z0-9_]"), "_")}_${key.replace(Regex("[^a-zA-Z0-9_]"), "_")}"
