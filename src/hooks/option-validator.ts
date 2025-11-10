/**
 * Type-safe option validation and normalization utilities.
 *
 * Provides centralized handling of options validation across the hooks layer,
 * ensuring consistency and reducing DRY violations. All options pass through
 * this layer before being delegated to the core storage module.
 *
 * @module hooks/option-validator
 */

import type { SensitiveInfoOptions } from '../sensitive-info.nitro';

const DEFAULT_SERVICE = 'default';
const DEFAULT_ACCESS_CONTROL = 'secureEnclaveBiometry' as const;

/**
 * Validation result containing either normalized options or validation errors.
 *
 * @template T The type of options being validated
 */
export interface ValidationResult<T> {
  /** Whether validation succeeded */
  readonly valid: boolean;
  /** Normalized options if valid */
  readonly data?: T;
  /** Validation error messages if invalid */
  readonly errors?: readonly string[];
}

/**
 * Validates that option keys are within acceptable length limits.
 *
 * @param key - The storage key to validate
 * @returns Array of error messages (empty if valid)
 *
 * @internal
 */
function validateKey(key: string): string[] {
  const errors: string[] = [];
  if (!key || key.length === 0) {
    errors.push('Key must not be empty');
  }
  if (key.length > 255) {
    errors.push('Key must not exceed 255 characters');
  }
  return errors;
}

/**
 * Validates that service names follow platform conventions.
 *
 * @param service - The service identifier to validate
 * @returns Array of error messages (empty if valid)
 *
 * @internal
 */
function validateService(service?: string): string[] {
  const errors: string[] = [];
  if (service && service.length > 512) {
    errors.push('Service identifier must not exceed 512 characters');
  }
  return errors;
}

/**
 * Validates that accessControl values are from the known set.
 *
 * @param accessControl - The access control level to validate
 * @returns Array of error messages (empty if valid)
 *
 * @internal
 */
function validateAccessControl(accessControl?: string): string[] {
  const valid = [
    'none',
    'secureEnclaveBiometry',
    'biometryCurrentSet',
    'biometryAny',
    'devicePasscode',
  ] as const;

  const errors: string[] = [];
  if (accessControl && !valid.includes(accessControl as any)) {
    errors.push(
      `AccessControl must be one of: ${valid.join(', ')}, got: ${accessControl}`
    );
  }
  return errors;
}

/**
 * Normalizes storage options by applying defaults and removing undefined values.
 *
 * Ensures that all downstream code receives consistent, non-null option objects,
 * reducing the burden on functions that accept optional configurations.
 *
 * @param options - User-supplied options (may be partial or undefined)
 * @returns Normalized options with all required fields populated
 *
 * @example
 * ```ts
 * // Without options, receives defaults:
 * const normalized = normalizeStorageOptions()
 * // { service: 'default', accessControl: 'secureEnclaveBiometry' }
 *
 * // With partial options, merges with defaults:
 * const normalized = normalizeStorageOptions({ service: 'com.example' })
 * // { service: 'com.example', accessControl: 'secureEnclaveBiometry' }
 * ```
 */
export function normalizeStorageOptions(
  options?: SensitiveInfoOptions
): SensitiveInfoOptions {
  if (!options) {
    return {
      service: DEFAULT_SERVICE,
      accessControl: DEFAULT_ACCESS_CONTROL,
    };
  }

  const {
    service = DEFAULT_SERVICE,
    accessControl = DEFAULT_ACCESS_CONTROL,
    iosSynchronizable,
    keychainGroup,
    authenticationPrompt,
  } = options;

  // Build result object, excluding undefined values
  const result: Record<string, any> = {
    service,
    accessControl,
  };

  if (iosSynchronizable !== undefined) {
    result.iosSynchronizable = iosSynchronizable;
  }
  if (keychainGroup !== undefined) {
    result.keychainGroup = keychainGroup;
  }
  if (authenticationPrompt !== undefined) {
    result.authenticationPrompt = authenticationPrompt;
  }

  return result as SensitiveInfoOptions;
}

/**
 * Validates and normalizes storage options in one pass.
 *
 * Combines validation with normalization, returning either validated options
 * or a detailed error report. Useful for API boundaries that need to reject
 * invalid configurations early.
 *
 * @param options - User-supplied options to validate
 * @returns Validation result with normalized data or error messages
 *
 * @example
 * ```ts
 * const result = validateAndNormalizeOptions(userOptions)
 * if (result.valid && result.data) {
 *   const normalizedOptions = result.data
 * } else {
 *   console.error('Invalid options:', result.errors?.join(', '))
 * }
 * ```
 */
export function validateAndNormalizeStorageOptions(
  options?: SensitiveInfoOptions
): ValidationResult<SensitiveInfoOptions> {
  const errors: string[] = [];

  // Validate service
  if (options?.service) {
    errors.push(...validateService(options.service));
  }

  // Validate accessControl
  if (options?.accessControl) {
    errors.push(...validateAccessControl(options.accessControl));
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: normalizeStorageOptions(options),
  };
}

/**
 * Validates storage keys without normalization.
 *
 * Separated from options validation since keys are often validated
 * immediately when passed by users, before options processing.
 *
 * @param key - The storage key to validate
 * @returns Validation result
 *
 * @throws {Error} Throws if key validation fails
 *
 * @example
 * ```ts
 * const key = userInput.trim()
 * const validation = validateStorageKey(key)
 * if (!validation.valid) {
 *   throw new Error(validation.errors?.join('; '))
 * }
 * // Key is safe to use
 * ```
 */
export function validateStorageKey(key: string): ValidationResult<string> {
  const errors = validateKey(key);
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, data: key };
}

/**
 * Extracts core storage options from hook-specific options.
 *
 * Hook options may contain additional fields like `skip` or `includeValue` that are
 * not part of the core storage API. This function removes those hook-specific fields
 * before passing options to the storage module.
 *
 * @template T The hook-specific options type
 * @param options - Hook options potentially containing extra fields
 * @param hookSpecificFields - Names of fields to exclude
 * @returns Core storage options only
 *
 * @internal
 *
 * @example
 * ```ts
 * const hookOptions = {
 *   service: 'com.example',
 *   skip: true,        // Hook-specific
 *   includeValue: true  // Hook-specific
 * }
 * const coreOptions = extractCoreStorageOptions(hookOptions, ['skip', 'includeValue'])
 * // { service: 'com.example' }
 * ```
 */
export function extractCoreStorageOptions<T extends Record<string, any>>(
  options: T,
  hookSpecificFields: readonly string[]
): SensitiveInfoOptions {
  const { ...core } = options;

  // Remove hook-specific fields
  hookSpecificFields.forEach((field) => {
    delete core[field];
  });

  return core as SensitiveInfoOptions;
}

/**
 * Determines if two normalized option objects are equivalent.
 *
 * Useful for determining if hooks should re-run their effects based on
 * option changes. This is more robust than direct object comparison
 * since it accounts for serialization differences.
 *
 * @param optionsA - First options object
 * @param optionsB - Second options object
 * @returns Whether the options are functionally equivalent
 *
 * @internal
 */
export function areStorageOptionsEqual(
  optionsA?: SensitiveInfoOptions,
  optionsB?: SensitiveInfoOptions
): boolean {
  if (optionsA === optionsB) {
    return true;
  }

  const normalized = {
    a: normalizeStorageOptions(optionsA),
    b: normalizeStorageOptions(optionsB),
  };

  return JSON.stringify(normalized.a) === JSON.stringify(normalized.b);
}
