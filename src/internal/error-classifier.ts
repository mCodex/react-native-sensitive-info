/**
 * Type-safe error classification and handling for the SensitiveInfo API.
 * This module provides structured error codes and utilities for proper error
 * handling across all platforms (iOS, Android, Web).
 *
 * @module internal/error-classifier
 * @internal
 *
 * @example
 * ```ts
 * import { SensitiveInfoError, ErrorCode } from './internal/error-classifier'
 *
 * try {
 *   await setItem('key', 'value')
 * } catch (error) {
 *   if (error instanceof SensitiveInfoError) {
 *     if (error.code === ErrorCode.ItemNotFound) {
 *       console.log('Item was not found')
 *     } else if (error.code === ErrorCode.AuthenticationCanceled) {
 *       console.log('User cancelled authentication')
 *     }
 *   }
 * }
 * ```
 */

/**
 * Enumeration of all error codes that can occur in SensitiveInfo operations.
 * Each code represents a distinct error condition that applications should
 * handle differently.
 *
 * @enum {string}
 */
export enum ErrorCode {
  /** Item with the specified key was not found in storage */
  ItemNotFound = 'ITEM_NOT_FOUND',

  /** User cancelled authentication prompt (biometric, device credential, etc.) */
  AuthenticationCanceled = 'AUTHENTICATION_CANCELED',

  /** Biometric feature is not available on this device */
  BiometryNotAvailable = 'BIOMETRY_NOT_AVAILABLE',

  /** Biometric data has changed since item was encrypted (e.g., fingerprint added/removed) */
  BiometryInvalidated = 'BIOMETRY_INVALIDATED',

  /** User cancelled or failed biometric authentication */
  BiometryFailed = 'BIOMETRY_FAILED',

  /** Device passcode/PIN/pattern is not set up */
  DevicePasscodeNotSet = 'DEVICE_PASSCODE_NOT_SET',

  /** Storage key exceeds maximum length (255 characters) */
  KeyTooLong = 'KEY_TOO_LONG',

  /** Storage key is empty or invalid */
  InvalidKey = 'INVALID_KEY',

  /** Service name is empty or invalid */
  InvalidService = 'INVALID_SERVICE',

  /** Encryption/decryption operation failed */
  EncryptionFailed = 'ENCRYPTION_FAILED',

  /** Decryption operation failed */
  DecryptionFailed = 'DECRYPTION_FAILED',

  /** Insufficient device storage space */
  InsufficientStorage = 'INSUFFICIENT_STORAGE',

  /** File system permissions are insufficient */
  PermissionDenied = 'PERMISSION_DENIED',

  /** Keychain or Android Keystore is corrupted or inaccessible */
  StorageCorrupted = 'STORAGE_CORRUPTED',

  /** Key rotation operation failed */
  KeyRotationFailed = 'KEY_ROTATION_FAILED',

  /** Hardware security backend (Secure Enclave, StrongBox) is unavailable */
  HardwareSecurityUnavailable = 'HARDWARE_SECURITY_UNAVAILABLE',

  /** Access control setting is not supported on this platform/device */
  AccessControlNotSupported = 'ACCESS_CONTROL_NOT_SUPPORTED',

  /** Invalid or unsupported options were provided */
  InvalidOptions = 'INVALID_OPTIONS',

  /** Unknown error that doesn't fit other categories */
  Unknown = 'UNKNOWN',
}

/**
 * Structured error class for all SensitiveInfo API errors.
 * Provides type-safe error handling with error codes, messages, and optional details.
 *
 * @class SensitiveInfoError
 * @extends Error
 *
 * @example
 * ```ts
 * try {
 *   await getItem('token')
 * } catch (error) {
 *   if (error instanceof SensitiveInfoError) {
 *     console.error(`Error [${error.code}]: ${error.message}`)
 *     if (error.originalError) {
 *       console.error('Original error:', error.originalError)
 *     }
 *   }
 * }
 * ```
 */
export class SensitiveInfoError extends Error {
  /**
   * The error code categorizing this error.
   * @readonly
   */
  readonly code: ErrorCode;

  /**
   * Original error that caused this SensitiveInfoError, if applicable.
   * Useful for debugging and understanding root causes.
   * @readonly
   */
  readonly originalError?: Error;

  /**
   * Additional context data about this error.
   * Can contain platform-specific details, parameter values, etc.
   * @readonly
   */
  readonly context?: Record<string, unknown>;

  /**
   * Creates a new SensitiveInfoError.
   *
   * @param code - The error code from ErrorCode enum
   * @param message - Human-readable error message
   * @param originalError - Optional original error that caused this
   * @param context - Optional additional context data
   *
   * @example
   * ```ts
   * throw new SensitiveInfoError(
   *   ErrorCode.ItemNotFound,
   *   'The specified key does not exist in storage',
   *   undefined,
   *   { key: 'notExistingKey', service: 'auth' }
   * )
   * ```
   */
  constructor(
    code: ErrorCode,
    message: string,
    originalError?: Error,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SensitiveInfoError';
    this.code = code;
    this.originalError = originalError;
    this.context = context;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, SensitiveInfoError.prototype);
  }

  /**
   * Returns a detailed string representation of this error.
   * @internal
   */
  toString(): string {
    const parts = [`[${this.code}]`, this.message];
    if (this.originalError) {
      parts.push(`caused by: ${this.originalError.message}`);
    }
    if (this.context && Object.keys(this.context).length > 0) {
      parts.push(`context: ${JSON.stringify(this.context)}`);
    }
    return parts.join(' ');
  }
}

/**
 * Type guard to check if an error is a SensitiveInfoError.
 *
 * @param error - The error to check
 * @returns true if error is a SensitiveInfoError
 *
 * @example
 * ```ts
 * catch (error) {
 *   if (isSensitiveInfoError(error)) {
 *     // Type-safe access to error.code
 *     handleSensitiveInfoError(error.code)
 *   } else {
 *     handleGenericError(error)
 *   }
 * }
 * ```
 */
export function isSensitiveInfoError(
  error: unknown
): error is SensitiveInfoError {
  return error instanceof SensitiveInfoError;
}

/**
 * Checks if an error represents an item not found condition.
 *
 * @param error - The error to check
 * @returns true if this is a "not found" error
 *
 * @example
 * ```ts
 * if (isNotFoundError(error)) {
 *   return null // Normalize to null for not-found case
 * }
 * ```
 */
export function isNotFoundError(error: unknown): boolean {
  if (error instanceof SensitiveInfoError) {
    return error.code === ErrorCode.ItemNotFound;
  }

  // Fallback for legacy string-based errors
  if (error instanceof Error) {
    return error.message.includes('[E_NOT_FOUND]');
  }
  if (typeof error === 'string') {
    return error.includes('[E_NOT_FOUND]');
  }

  return false;
}

/**
 * Checks if an error represents a cancelled authentication.
 *
 * @param error - The error to check
 * @returns true if this is an authentication cancelled error
 *
 * @example
 * ```ts
 * if (isAuthenticationCanceledError(error)) {
 *   console.log('User declined authentication')
 *   return
 * }
 * ```
 */
export function isAuthenticationCanceledError(error: unknown): boolean {
  if (error instanceof SensitiveInfoError) {
    return error.code === ErrorCode.AuthenticationCanceled;
  }

  // Fallback for legacy string-based errors
  if (error instanceof Error) {
    return error.message.includes('[E_AUTH_CANCELED]');
  }
  if (typeof error === 'string') {
    return error.includes('[E_AUTH_CANCELED]');
  }

  return false;
}

/**
 * Checks if an error is related to biometry (Face ID, Touch ID, fingerprint).
 *
 * @param error - The error to check
 * @returns true if this is a biometry-related error
 *
 * @example
 * ```ts
 * if (isBiometryError(error)) {
 *   showBiometrySettings()
 * }
 * ```
 */
export function isBiometryError(error: unknown): boolean {
  if (error instanceof SensitiveInfoError) {
    return [
      ErrorCode.BiometryNotAvailable,
      ErrorCode.BiometryInvalidated,
      ErrorCode.BiometryFailed,
    ].includes(error.code);
  }
  return false;
}

/**
 * Checks if an error is a security-related error (permissions, hardware, etc.).
 *
 * @param error - The error to check
 * @returns true if this is a security error
 *
 * @example
 * ```ts
 * if (isSecurityError(error)) {
 *   notifyUser('Security issue detected')
 * }
 * ```
 */
export function isSecurityError(error: unknown): boolean {
  if (error instanceof SensitiveInfoError) {
    return [
      ErrorCode.PermissionDenied,
      ErrorCode.StorageCorrupted,
      ErrorCode.HardwareSecurityUnavailable,
      ErrorCode.AccessControlNotSupported,
    ].includes(error.code);
  }
  return false;
}

/**
 * Extracts a human-readable error message from any error type.
 * Falls back to generic message for unknown error types.
 *
 * @param error - The error to extract message from
 * @returns Human-readable error message
 *
 * @example
 * ```ts
 * try {
 *   await setItem('key', value)
 * } catch (error) {
 *   console.error(getErrorMessage(error))
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof SensitiveInfoError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

/**
 * Creates a SensitiveInfoError from an unknown error source.
 * Automatically classifies the error based on its message or type.
 *
 * @param error - The error to classify and wrap
 * @param context - Optional context information about the operation
 * @returns A SensitiveInfoError with appropriate code
 *
 * @example
 * ```ts
 * try {
 *   await nativeModule.setItem(payload)
 * } catch (error) {
 *   throw classifyError(error, { operation: 'setItem', key })
 * }
 * ```
 *
 * @internal
 */
export function classifyError(
  error: unknown,
  context?: Record<string, unknown>
): SensitiveInfoError {
  if (error instanceof SensitiveInfoError) {
    return error;
  }

  const message = getErrorMessage(error);
  const originalError = error instanceof Error ? error : undefined;

  // Classify based on error message patterns
  if (message.includes('[E_NOT_FOUND]') || message.includes('not found')) {
    return new SensitiveInfoError(
      ErrorCode.ItemNotFound,
      'Item not found in storage',
      originalError,
      context
    );
  }

  if (
    message.includes('[E_AUTH_CANCELED]') ||
    message.includes('canceled') ||
    message.includes('cancelled')
  ) {
    return new SensitiveInfoError(
      ErrorCode.AuthenticationCanceled,
      'User cancelled authentication',
      originalError,
      context
    );
  }

  if (message.includes('biometry') || message.includes('biometric')) {
    if (message.includes('not available')) {
      return new SensitiveInfoError(
        ErrorCode.BiometryNotAvailable,
        'Biometry is not available on this device',
        originalError,
        context
      );
    }
    if (message.includes('invalidated')) {
      return new SensitiveInfoError(
        ErrorCode.BiometryInvalidated,
        'Biometric data has been invalidated',
        originalError,
        context
      );
    }
    return new SensitiveInfoError(
      ErrorCode.BiometryFailed,
      'Biometric authentication failed',
      originalError,
      context
    );
  }

  if (message.includes('passcode') || message.includes('device credential')) {
    if (message.includes('not set')) {
      return new SensitiveInfoError(
        ErrorCode.DevicePasscodeNotSet,
        'Device passcode is not set up',
        originalError,
        context
      );
    }
  }

  if (message.includes('encryption')) {
    return new SensitiveInfoError(
      ErrorCode.EncryptionFailed,
      'Encryption operation failed',
      originalError,
      context
    );
  }

  if (message.includes('decryption')) {
    return new SensitiveInfoError(
      ErrorCode.DecryptionFailed,
      'Decryption operation failed',
      originalError,
      context
    );
  }

  if (message.includes('key') && message.includes('long')) {
    return new SensitiveInfoError(
      ErrorCode.KeyTooLong,
      'Storage key exceeds maximum length',
      originalError,
      context
    );
  }

  if (message.includes('permission')) {
    return new SensitiveInfoError(
      ErrorCode.PermissionDenied,
      'Insufficient permissions to perform operation',
      originalError,
      context
    );
  }

  if (message.includes('storage') && message.includes('corrupted')) {
    return new SensitiveInfoError(
      ErrorCode.StorageCorrupted,
      'Storage is corrupted or inaccessible',
      originalError,
      context
    );
  }

  if (message.includes('rotation')) {
    return new SensitiveInfoError(
      ErrorCode.KeyRotationFailed,
      'Key rotation operation failed',
      originalError,
      context
    );
  }

  if (message.includes('storage') && message.includes('space')) {
    return new SensitiveInfoError(
      ErrorCode.InsufficientStorage,
      'Insufficient storage space available',
      originalError,
      context
    );
  }

  // Default to unknown error
  return new SensitiveInfoError(
    ErrorCode.Unknown,
    message,
    originalError,
    context
  );
}
