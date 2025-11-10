package com.sensitiveinfo.internal.auth

import com.margelo.nitro.sensitiveinfo.AuthenticationPrompt

/**
 * Interface for managing authentication and biometric operations on Android.
 *
 * Encapsulates all biometric authentication, device credential handling,
 * and authentication prompt management. Follows Single Responsibility Principle.
 *
 * @since 6.0.0
 */
interface AuthenticationManager {
  /**
   * Check if biometric authentication is available.
   *
   * @return True if device supports biometric authentication
   */
  suspend fun isBiometricAvailable(): Boolean

  /**
   * Check if device credential (PIN/Pattern/Password) is available.
   *
   * @return True if device has set device credentials
   */
  suspend fun isDeviceCredentialAvailable(): Boolean

  /**
   * Evaluate biometric authentication with prompt.
   *
   * @param prompt Optional authentication prompt with customization
   * @return True if authentication succeeded
   * @throws Exception if authentication fails or is canceled
   */
  suspend fun evaluateBiometric(prompt: AuthenticationPrompt?): Boolean

  /**
   * Evaluate device credential authentication with prompt.
   *
   * @param prompt Optional authentication prompt with customization
   * @return True if authentication succeeded
   * @throws Exception if authentication fails or is canceled
   */
  suspend fun evaluateDeviceCredential(prompt: AuthenticationPrompt?): Boolean

  /**
   * Check if error indicates authentication was canceled by user.
   *
   * @param exception The exception from authentication
   * @return True if user canceled
   */
  fun isAuthenticationCanceled(exception: Exception): Boolean

  /**
   * Create error message for authentication-related errors.
   *
   * @param exception The authentication exception
   * @return Formatted error message
   */
  fun makeAuthenticationError(exception: Exception): String
}
