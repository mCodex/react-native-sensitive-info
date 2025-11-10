/**
 * Validators for SensitiveInfo storage operations.
 * Provides reusable, type-safe validation utilities for keys, values,
 * services, and options across all API functions.
 *
 * @module internal/validator
 * @internal
 *
 * @example
 * ```ts
 * import { validateStorageKey, validateService } from './internal/validator'
 *
 * function setItem(key: string, value: string, options?: SensitiveInfoOptions) {
 *   validateStorageKey(key)
 *   validateService(options?.service)
 *   // ... rest of operation
 * }
 * ```
 */

import { SensitiveInfoError, ErrorCode } from './error-classifier';
import type {
  SensitiveInfoOptions,
  AccessControl,
} from '../sensitive-info.nitro';

/**
 * Maximum allowed length for storage keys (in characters).
 * This limit is set to accommodate both iOS Keychain and Android Keystore
 * maximum identifier lengths.
 *
 * @internal
 */
export const MAX_KEY_LENGTH = 255;

/**
 * Maximum recommended length for values (in bytes).
 * Larger values may impact performance and device storage.
 * This is a soft limit and can be exceeded on most devices.
 *
 * @internal
 */
export const MAX_VALUE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Regular expression for validating service names.
 * Allows alphanumeric characters, dots, hyphens, and underscores.
 *
 * @internal
 */
const VALID_SERVICE_PATTERN = /^[a-zA-Z0-9._-]+$/;

/**
 * Regular expression for validating storage keys.
 * Allows alphanumeric characters, dots, hyphens, underscores, and colons.
 *
 * @internal
 */
const VALID_KEY_PATTERN = /^[a-zA-Z0-9._\-:]+$/;

/**
 * Valid access control modes supported by the API.
 *
 * @internal
 */
const VALID_ACCESS_CONTROLS: AccessControl[] = [
  'secureEnclaveBiometry',
  'biometryCurrentSet',
  'biometryAny',
  'devicePasscode',
  'none',
];

/**
 * Validates a storage key.
 * Throws SensitiveInfoError if the key is invalid.
 *
 * @param key - The key to validate
 * @throws {SensitiveInfoError} If key is empty, too long, or contains invalid characters
 *
 * @example
 * ```ts
 * validateStorageKey('authToken') // ✓ Valid
 * validateStorageKey('') // ✗ Throws error
 * validateStorageKey('a'.repeat(300)) // ✗ Throws error (too long)
 * validateStorageKey('auth@token') // ✗ Throws error (invalid chars)
 * ```
 *
 * @internal
 */
export function validateStorageKey(key: unknown): asserts key is string {
  if (typeof key !== 'string') {
    throw new SensitiveInfoError(
      ErrorCode.InvalidKey,
      'Storage key must be a string',
      undefined,
      { providedType: typeof key }
    );
  }

  if (key.length === 0) {
    throw new SensitiveInfoError(
      ErrorCode.InvalidKey,
      'Storage key cannot be empty',
      undefined,
      { keyLength: 0 }
    );
  }

  if (key.length > MAX_KEY_LENGTH) {
    throw new SensitiveInfoError(
      ErrorCode.KeyTooLong,
      `Storage key exceeds maximum length of ${MAX_KEY_LENGTH} characters`,
      undefined,
      { keyLength: key.length, maxLength: MAX_KEY_LENGTH }
    );
  }

  if (!VALID_KEY_PATTERN.test(key)) {
    throw new SensitiveInfoError(
      ErrorCode.InvalidKey,
      'Storage key contains invalid characters. Only alphanumeric, dots, hyphens, underscores, and colons are allowed',
      undefined,
      { key, pattern: VALID_KEY_PATTERN.source }
    );
  }
}

/**
 * Validates a storage value.
 * Throws SensitiveInfoError if the value is invalid.
 *
 * @param value - The value to validate
 * @throws {SensitiveInfoError} If value is not a string or exceeds recommended size
 *
 * @example
 * ```ts
 * validateStorageValue('secret-token') // ✓ Valid
 * validateStorageValue('') // ✓ Valid (empty strings allowed)
 * validateStorageValue(null) // ✗ Throws error
 * validateStorageValue(123) // ✗ Throws error
 * ```
 *
 * @internal
 */
export function validateStorageValue(value: unknown): asserts value is string {
  if (typeof value !== 'string') {
    throw new SensitiveInfoError(
      ErrorCode.InvalidOptions,
      'Storage value must be a string',
      undefined,
      { providedType: typeof value }
    );
  }

  // Note: We only warn about large values, not throw, as this is implementation-dependent
  if (new Blob([value]).size > MAX_VALUE_SIZE_BYTES) {
    console.warn(
      `[SensitiveInfo] Value size (${new Blob([value]).size} bytes) exceeds recommended maximum (${MAX_VALUE_SIZE_BYTES} bytes). Performance may be affected.`
    );
  }
}

/**
 * Validates a service name.
 * Throws SensitiveInfoError if the service is invalid.
 *
 * @param service - The service name to validate
 * @throws {SensitiveInfoError} If service is empty or contains invalid characters
 *
 * @example
 * ```ts
 * validateService('com.example.app') // ✓ Valid
 * validateService('my_service') // ✓ Valid
 * validateService('my-service') // ✓ Valid
 * validateService('') // ✗ Throws error
 * validateService('my@service') // ✗ Throws error
 * ```
 *
 * @internal
 */
export function validateService(service: unknown): asserts service is string {
  if (typeof service !== 'string') {
    throw new SensitiveInfoError(
      ErrorCode.InvalidService,
      'Service name must be a string',
      undefined,
      { providedType: typeof service }
    );
  }

  if (service.length === 0) {
    throw new SensitiveInfoError(
      ErrorCode.InvalidService,
      'Service name cannot be empty',
      undefined,
      { serviceLength: 0 }
    );
  }

  if (!VALID_SERVICE_PATTERN.test(service)) {
    throw new SensitiveInfoError(
      ErrorCode.InvalidService,
      'Service name contains invalid characters. Only alphanumeric characters, dots, hyphens, and underscores are allowed',
      undefined,
      { service, pattern: VALID_SERVICE_PATTERN.source }
    );
  }
}

/**
 * Validates an access control mode.
 * Throws SensitiveInfoError if the access control is not supported.
 *
 * @param accessControl - The access control mode to validate
 * @throws {SensitiveInfoError} If access control is not a valid mode
 *
 * @example
 * ```ts
 * validateAccessControl('biometry') // ✓ Valid
 * validateAccessControl('secureEnclaveBiometry') // ✓ Valid
 * validateAccessControl('invalid') // ✗ Throws error
 * ```
 *
 * @internal
 */
export function validateAccessControl(
  accessControl: unknown
): asserts accessControl is AccessControl {
  if (typeof accessControl !== 'string') {
    throw new SensitiveInfoError(
      ErrorCode.InvalidOptions,
      'Access control must be a string',
      undefined,
      { providedType: typeof accessControl }
    );
  }

  if (!VALID_ACCESS_CONTROLS.includes(accessControl as AccessControl)) {
    throw new SensitiveInfoError(
      ErrorCode.AccessControlNotSupported,
      `Invalid access control mode: "${accessControl}". Supported modes: ${VALID_ACCESS_CONTROLS.join(', ')}`,
      undefined,
      { providedValue: accessControl, validValues: VALID_ACCESS_CONTROLS }
    );
  }
}

/**
 * Validates storage options.
 * Throws SensitiveInfoError if any option is invalid.
 *
 * @param options - The options object to validate
 * @throws {SensitiveInfoError} If any option is invalid
 *
 * @example
 * ```ts
 * validateOptions({ service: 'auth', accessControl: 'biometry' }) // ✓ Valid
 * validateOptions({ service: '', accessControl: 'biometry' }) // ✗ Throws error
 * validateOptions({ service: 'auth', accessControl: 'invalid' }) // ✗ Throws error
 * ```
 *
 * @internal
 */
export function validateOptions(
  options: unknown
): asserts options is SensitiveInfoOptions {
  if (options == null) {
    // null/undefined options are valid (defaults will be applied)
    return;
  }

  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new SensitiveInfoError(
      ErrorCode.InvalidOptions,
      'Options must be an object',
      undefined,
      { providedType: typeof options }
    );
  }

  const opts = options as Record<string, unknown>;

  // Validate service if provided
  if ('service' in opts && opts.service != null) {
    try {
      validateService(opts.service);
    } catch (error) {
      if (error instanceof SensitiveInfoError) {
        throw error;
      }
      throw new SensitiveInfoError(
        ErrorCode.InvalidOptions,
        'Invalid service in options',
        error instanceof Error ? error : undefined,
        { field: 'service', value: opts.service }
      );
    }
  }

  // Validate accessControl if provided
  if ('accessControl' in opts && opts.accessControl != null) {
    try {
      validateAccessControl(opts.accessControl);
    } catch (error) {
      if (error instanceof SensitiveInfoError) {
        throw error;
      }
      throw new SensitiveInfoError(
        ErrorCode.InvalidOptions,
        'Invalid accessControl in options',
        error instanceof Error ? error : undefined,
        { field: 'accessControl', value: opts.accessControl }
      );
    }
  }

  // Validate iosSynchronizable if provided
  if ('iosSynchronizable' in opts && opts.iosSynchronizable != null) {
    if (typeof opts.iosSynchronizable !== 'boolean') {
      throw new SensitiveInfoError(
        ErrorCode.InvalidOptions,
        'iosSynchronizable must be a boolean',
        undefined,
        {
          field: 'iosSynchronizable',
          providedType: typeof opts.iosSynchronizable,
        }
      );
    }
  }

  // Validate keychainGroup if provided
  if ('keychainGroup' in opts && opts.keychainGroup != null) {
    if (typeof opts.keychainGroup !== 'string') {
      throw new SensitiveInfoError(
        ErrorCode.InvalidOptions,
        'keychainGroup must be a string',
        undefined,
        { field: 'keychainGroup', providedType: typeof opts.keychainGroup }
      );
    }

    if (opts.keychainGroup.length === 0) {
      throw new SensitiveInfoError(
        ErrorCode.InvalidOptions,
        'keychainGroup cannot be empty',
        undefined,
        { field: 'keychainGroup' }
      );
    }
  }

  // Validate authenticationPrompt if provided
  if ('authenticationPrompt' in opts && opts.authenticationPrompt != null) {
    if (
      typeof opts.authenticationPrompt !== 'object' ||
      Array.isArray(opts.authenticationPrompt)
    ) {
      throw new SensitiveInfoError(
        ErrorCode.InvalidOptions,
        'authenticationPrompt must be an object',
        undefined,
        {
          field: 'authenticationPrompt',
          providedType: typeof opts.authenticationPrompt,
        }
      );
    }
  }
}

/**
 * Comprehensive storage validator class providing reusable validation methods.
 * Recommended for use in storage-related functions.
 *
 * @class StorageValidator
 *
 * @example
 * ```ts
 * const validator = new StorageValidator()
 *
 * export async function setItem(key: string, value: string, options?: SensitiveInfoOptions) {
 *   validator.validateAll(key, value, options)
 *   // ... rest of operation
 * }
 * ```
 */
export class StorageValidator {
  /**
   * Validates all parameters for a set operation.
   *
   * @param key - The storage key
   * @param value - The storage value
   * @param options - Optional storage options
   * @throws {SensitiveInfoError} If any parameter is invalid
   */
  validateSetOperation(key: unknown, value: unknown, options?: unknown): void {
    validateStorageKey(key);
    validateStorageValue(value);
    validateOptions(options);
  }

  /**
   * Validates all parameters for a get operation.
   *
   * @param key - The storage key
   * @param options - Optional storage options
   * @throws {SensitiveInfoError} If any parameter is invalid
   */
  validateGetOperation(key: unknown, options?: unknown): void {
    validateStorageKey(key);
    validateOptions(options);
  }

  /**
   * Validates all parameters for a delete operation.
   *
   * @param key - The storage key
   * @param options - Optional storage options
   * @throws {SensitiveInfoError} If any parameter is invalid
   */
  validateDeleteOperation(key: unknown, options?: unknown): void {
    validateStorageKey(key);
    validateOptions(options);
  }

  /**
   * Validates all parameters for a has operation.
   *
   * @param key - The storage key
   * @param options - Optional storage options
   * @throws {SensitiveInfoError} If any parameter is invalid
   */
  validateHasOperation(key: unknown, options?: unknown): void {
    validateStorageKey(key);
    validateOptions(options);
  }

  /**
   * Validates all parameters for an enumerate operation.
   *
   * @param options - Optional storage options
   * @throws {SensitiveInfoError} If any parameter is invalid
   */
  validateEnumerateOperation(options?: unknown): void {
    validateOptions(options);
  }

  /**
   * Validates all parameters for a clear operation.
   *
   * @param options - Optional storage options
   * @throws {SensitiveInfoError} If any parameter is invalid
   */
  validateClearOperation(options?: unknown): void {
    validateOptions(options);
  }
}

/**
 * Singleton instance of StorageValidator for convenience.
 * @internal
 */
export const storageValidator = new StorageValidator();
