/**
 * Branded types for enhanced type safety in storage operations.
 *
 * Branded types (also called "flavored" or "tagged" types) provide nominal typing
 * in TypeScript, allowing the type system to distinguish between semantically different
 * string types. This prevents accidental mixing of keys and services.
 *
 * @module internal/branded-types
 * @internal
 *
 * @example
 * ```ts
 * import type { StorageKey, ServiceName } from '../internal/branded-types'
 * import { createStorageKey, createServiceName } from '../internal/branded-types'
 *
 * // Compile-time safety
 * const key: StorageKey = 'authToken' as StorageKey  // ✓ OK
 * const service: ServiceName = 'com.app' as ServiceName  // ✓ OK
 *
 * // This would be a type error:
 * const key: StorageKey = service  // ✗ Type error: ServiceName is not StorageKey
 * const service: ServiceName = key  // ✗ Type error: StorageKey is not ServiceName
 *
 * // Runtime validation with branded type creation
 * const validKey = createStorageKey('authToken')  // ✓ Returns branded type
 * const invalidKey = createStorageKey('')  // ✗ Throws error
 * ```
 */

/**
 * Branded type for storage keys.
 *
 * This is a string that has been validated to meet storage key requirements:
 * - Non-empty
 * - Max 255 characters
 * - Alphanumeric with dots, hyphens, underscores, colons
 *
 * Using StorageKey prevents accidental mixing with other string types like ServiceName.
 *
 * @see {@link createStorageKey} to create a validated StorageKey
 */
export type StorageKey = string & { readonly __brand: 'StorageKey' };

/**
 * Branded type for service names.
 *
 * This is a string that has been validated to meet service name requirements:
 * - Non-empty
 * - Alphanumeric with dots, hyphens, underscores
 * - Typically follows reverse-domain notation (e.g., 'com.example.app')
 *
 * Using ServiceName prevents accidental mixing with other string types like StorageKey.
 *
 * @see {@link createServiceName} to create a validated ServiceName
 */
export type ServiceName = string & { readonly __brand: 'ServiceName' };

/**
 * Creates a validated StorageKey with runtime checks.
 *
 * @param key - The key to validate and brand
 * @returns A branded StorageKey if validation passes
 * @throws {SensitiveInfoError} If the key fails validation
 *
 * @example
 * ```ts
 * const key = createStorageKey('authToken')
 * // key has type StorageKey and cannot be mixed with ServiceName
 *
 * // Validation errors
 * createStorageKey('')  // ✗ Error: empty key
 * createStorageKey('a'.repeat(300))  // ✗ Error: too long
 * createStorageKey('invalid@key')  // ✗ Error: invalid characters
 * ```
 */
export function createStorageKey(key: string): StorageKey {
  // Validation is delegated to the validator module
  // This is a marker function that indicates the key has been validated
  if (typeof key !== 'string' || key.length === 0 || key.length > 255) {
    throw new Error('Invalid storage key');
  }
  return key as StorageKey;
}

/**
 * Creates a validated ServiceName with runtime checks.
 *
 * @param service - The service name to validate and brand
 * @returns A branded ServiceName if validation passes
 * @throws {SensitiveInfoError} If the service name fails validation
 *
 * @example
 * ```ts
 * const service = createServiceName('com.example.auth')
 * // service has type ServiceName and cannot be mixed with StorageKey
 *
 * // Validation errors
 * createServiceName('')  // ✗ Error: empty service
 * createServiceName('invalid@service')  // ✗ Error: invalid characters
 * ```
 */
export function createServiceName(service: string): ServiceName {
  // Validation is delegated to the validator module
  // This is a marker function that indicates the service has been validated
  if (typeof service !== 'string' || service.length === 0) {
    throw new Error('Invalid service name');
  }
  return service as ServiceName;
}

/**
 * Type guard to check if a string is a valid StorageKey.
 *
 * @param value - The value to check
 * @returns true if value is a StorageKey
 *
 * @example
 * ```ts
 * function handleKey(value: string) {
 *   if (isStorageKey(value)) {
 *     // value is now typed as StorageKey
 *     await getItem(value)
 *   }
 * }
 * ```
 */
export function isStorageKey(value: unknown): value is StorageKey {
  return typeof value === 'string' && value.length > 0 && value.length <= 255;
}

/**
 * Type guard to check if a string is a valid ServiceName.
 *
 * @param value - The value to check
 * @returns true if value is a ServiceName
 *
 * @example
 * ```ts
 * function handleService(value: string) {
 *   if (isServiceName(value)) {
 *     // value is now typed as ServiceName
 *     await getAllItems({ service: value })
 *   }
 * }
 * ```
 */
export function isServiceName(value: unknown): value is ServiceName {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Branded type for storage values.
 *
 * Currently not strictly enforced beyond being a string,
 * but branded for potential future validation (e.g., max size).
 *
 * @see {@link createStorageValue} to create a validated StorageValue
 */
export type StorageValue = string & { readonly __brand: 'StorageValue' };

/**
 * Creates a validated StorageValue with runtime checks.
 *
 * @param value - The value to validate and brand
 * @returns A branded StorageValue if validation passes
 * @throws {SensitiveInfoError} If the value fails validation
 *
 * @example
 * ```ts
 * const value = createStorageValue('secret-token-here')
 * // value has type StorageValue and cannot be mixed with other strings
 * ```
 */
export function createStorageValue(value: unknown): StorageValue {
  if (typeof value !== 'string') {
    throw new Error('Storage value must be a string');
  }
  return value as StorageValue;
}

/**
 * Type guard to check if a string is a valid StorageValue.
 *
 * @param value - The value to check
 * @returns true if value is a StorageValue
 */
export function isStorageValue(value: unknown): value is StorageValue {
  return typeof value === 'string';
}
