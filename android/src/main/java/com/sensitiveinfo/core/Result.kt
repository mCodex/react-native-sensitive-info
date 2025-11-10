package com.sensitiveinfo.core

/**
 * Type-safe Result type for operations that can fail.
 *
 * Similar to Kotlin's Result but optimized for SensitiveInfo operations.
 *
 * Usage:
 * ```kotlin
 * when (val result = storage.setItem("key", "value")) {
 *   is Result.Success -> println("Stored: ${result.value}")
 *   is Result.Failure -> println("Error: ${result.error.message}")
 * }
 * ```
 */
sealed class Result<T> {
  /**
   * Successful operation result.
   */
  data class Success<T>(val value: T) : Result<T>()

  /**
   * Failed operation result.
   */
  data class Failure<T>(val error: Exception) : Result<T>()

  /**
   * Get the value or null if failed.
   */
  fun getOrNull(): T? = when (this) {
    is Success -> value
    is Failure -> null
  }

  /**
   * Get the error or null if successful.
   */
  fun exceptionOrNull(): Exception? = when (this) {
    is Success -> null
    is Failure -> error
  }

  /**
   * Transform the success value.
   */
  inline fun <R> map(transform: (T) -> R): Result<R> = when (this) {
    is Success -> Success(transform(value))
    is Failure -> Failure(error)
  }

  /**
   * Flat map for composing operations.
   */
  inline fun <R> flatMap(transform: (T) -> Result<R>): Result<R> = when (this) {
    is Success -> transform(value)
    is Failure -> Failure(error)
  }

  /**
   * Handle success case.
   */
  inline fun onSuccess(action: (T) -> Unit): Result<T> {
    if (this is Success) {
      action(value)
    }
    return this
  }

  /**
   * Handle failure case.
   */
  inline fun onFailure(action: (Exception) -> Unit): Result<T> {
    if (this is Failure) {
      action(error)
    }
    return this
  }

  /**
   * Get success value or default.
   */
  fun getOrDefault(defaultValue: T): T = when (this) {
    is Success -> value
    is Failure -> defaultValue
  }

  /**
   * Get success value or compute from error.
   */
  inline fun getOrElse(compute: (Exception) -> T): T = when (this) {
    is Success -> value
    is Failure -> compute(error)
  }

  companion object {
    /**
     * Create a success result.
     */
    fun <T> success(value: T): Result<T> = Success(value)

    /**
     * Create a failure result.
     */
    fun <T> failure(error: Exception): Result<T> = Failure(error)

    /**
     * Execute block and wrap result.
     */
    inline fun <T> try_(block: () -> T): Result<T> = try {
      Success(block())
    } catch (e: Exception) {
      Failure(e)
    }
  }
}

/**
 * Extension: convert to success result.
 */
fun <T> T.toSuccess(): Result<T> = Result.Success(this)

/**
 * Extension: convert to failure result.
 */
fun <T> Exception.toFailure(): Result<T> = Result.Failure(this)
