package com.sensitiveinfo.internal.util

/**
 * Custom exception types raised by the Android bridge so JavaScript can map them to friendly errors.
 */
sealed class SensitiveInfoException(
  val code: String,
  message: String
) : IllegalStateException(message) {

  class NotFound(key: String, service: String) : SensitiveInfoException(
    code = "E_NOT_FOUND",
    message = "[E_NOT_FOUND] No secret found for key \"$key\" in service \"$service\"."
  )
}

