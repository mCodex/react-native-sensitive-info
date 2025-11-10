/**
 * Type-safe error factory for hook operations.
 *
 * Provides centralized error creation with operation type safety,
 * preventing string-based operation labels from becoming inconsistent.
 *
 * @module hooks/error-factory
 */

import {
  getErrorMessage,
  isAuthenticationCanceledError as checkAuthCanceled,
} from '../internal/error-classifier';
import { HookError } from './types';
import { extractCoreStorageOptions } from './option-validator';

// Re-export for convenience
export { extractCoreStorageOptions };

/**
 * Typed operation identifiers for all hook operations that can fail.
 *
 * Using a union type ensures that operation names are known at compile time
 * and prevents typos or inconsistencies across the codebase.
 *
 * @see {@link createOperationError} to create errors with these operations
 */
export type HookOperation =
  | 'useSecretItem.fetch'
  | 'useSecret.save'
  | 'useSecret.delete'
  | 'useSecretItem.refetch'
  | 'useSecureStorage.fetch'
  | 'useSecureStorage.save'
  | 'useSecureStorage.remove'
  | 'useSecureStorage.clearAll'
  | 'useSecureStorage.refresh'
  | 'useHasSecret.check'
  | 'useSecureOperation.execute'
  | 'useSecurityAvailability.check';

/**
 * Operation-specific error hints that help users understand what went wrong.
 *
 * Maps each operation to a contextual hint message that provides actionable
 * guidance for debugging common issues.
 *
 * @internal
 */
const OPERATION_HINTS: Record<HookOperation, string> = {
  'useSecretItem.fetch':
    'Verify that the key/service pair exists and that includeValue is allowed for the caller.',
  'useSecret.save':
    'Check the access control requirements for this key and ensure biometric prompts completed.',
  'useSecret.delete':
    'Ensure the user completed biometric prompts or that the key is spelled correctly.',
  'useSecretItem.refetch':
    'The key may have been deleted or access permissions changed.',
  'useSecureStorage.fetch':
    'Ensure the service name matches the one used when storing items.',
  'useSecureStorage.save':
    'Check for duplicate keys or permission prompts that might have been dismissed.',
  'useSecureStorage.remove':
    'Confirm the item still exists or that the user completed biometric prompts.',
  'useSecureStorage.clearAll':
    'Inspect whether another process holds a lock on the secure storage.',
  'useSecureStorage.refresh':
    'Try again - this may be a temporary connectivity or permission issue.',
  'useHasSecret.check':
    'Ensure the key exists in the storage and that access control allows checks.',
  'useSecureOperation.execute':
    'Check that the operation parameters are valid and security requirements are met.',
  'useSecurityAvailability.check':
    'The device may not support the requested security level.',
};

/**
 * Creates a {@link HookError} for a specific hook operation.
 *
 * This is the primary error factory for all hook failures. It automatically
 * includes contextual hints and handles authentication cancellation specially.
 *
 * @param operation - The hook operation that failed (type-checked)
 * @param cause - The underlying error that caused the failure
 * @param customHint - Optional override for the default operation hint
 * @returns A fully-initialized HookError with proper context
 *
 * @example
 * ```ts
 * try {
 *   await saveSecret(key, value)
 * } catch (error) {
 *   const hookError = createOperationError('useSecret.save', error)
 *   console.error(hookError.message)      // Full error message
 *   console.error(hookError.hint)         // Actionable guidance
 *   console.error(hookError.operation)    // 'useSecret.save'
 *   console.error(hookError.cause)        // Original error
 * }
 * ```
 *
 * @see {@link createFetchError} for query operations
 * @see {@link createMutationError} for write operations
 */
export function createOperationError(
  operation: HookOperation,
  cause: unknown,
  customHint?: string
): HookError {
  const isAuthCanceled = checkAuthCanceled(cause);
  const message = isAuthCanceled
    ? `${operation}: Authentication prompt canceled by the user.`
    : `${operation}: ${getErrorMessage(cause)}`;

  const hint = customHint ?? OPERATION_HINTS[operation];

  return new HookError(message, {
    cause,
    operation,
    hint,
  });
}

/**
 * Creates a {@link HookError} specifically for data fetching operations.
 *
 * Uses predefined hints tailored to data fetch failures, with special handling
 * for authentication cancellations (which are not errors, just user actions).
 *
 * @param operation - The fetch operation that failed (must be a fetch-type operation)
 * @param cause - The underlying error
 * @param customHint - Optional custom hint message
 * @returns A HookError configured for fetch operations
 *
 * @example
 * ```ts
 * try {
 *   const item = await getItem(key, options)
 * } catch (error) {
 *   const hookError = createFetchError('useSecretItem.fetch', error)
 *   setError(hookError)
 * }
 * ```
 *
 * @see {@link createOperationError} for general operation errors
 * @see {@link createMutationError} for write operation errors
 */
export function createFetchError(
  operation: Extract<
    HookOperation,
    'useSecretItem.fetch' | 'useSecureStorage.fetch' | 'useHasSecret.check'
  >,
  cause: unknown,
  customHint?: string
): HookError {
  return createOperationError(operation, cause, customHint);
}

/**
 * Creates a {@link HookError} specifically for mutation operations (write/delete).
 *
 * Uses predefined hints tailored to mutation failures and includes recovery
 * guidance when appropriate.
 *
 * @param operation - The mutation operation that failed (must be a mutation-type operation)
 * @param cause - The underlying error
 * @param customHint - Optional custom hint message
 * @returns A HookError configured for mutation operations
 *
 * @example
 * ```ts
 * try {
 *   await setItem(key, value, options)
 * } catch (error) {
 *   const hookError = createMutationError('useSecret.save', error)
 *   return createHookFailureResult(hookError)
 * }
 * ```
 *
 * @see {@link createOperationError} for general operation errors
 * @see {@link createFetchError} for fetch operation errors
 */
export function createMutationError(
  operation: Extract<
    HookOperation,
    | 'useSecret.save'
    | 'useSecret.delete'
    | 'useSecureStorage.save'
    | 'useSecureStorage.remove'
    | 'useSecureStorage.clearAll'
  >,
  cause: unknown,
  customHint?: string
): HookError {
  return createOperationError(operation, cause, customHint);
}

/**
 * Determines whether an error represents a canceled authentication prompt.
 *
 * Re-exported from internal errors for convenience, allowing callers
 * to check error types without additional imports.
 *
 * @param error - The error to check
 * @returns Whether the error is an authentication cancellation
 *
 * @example
 * ```ts
 * try {
 *   await saveSecret(key, value)
 * } catch (error) {
 *   if (isAuthenticationCanceled(error)) {
 *     // User cancelled biometric prompt - not an error
 *     setError(null)
 *   } else {
 *     const hookError = createMutationError('useSecret.save', error)
 *     setError(hookError)
 *   }
 * }
 * ```
 */
export const isAuthenticationCanceled = checkAuthCanceled;

/**
 * Checks whether an error should trigger a state update.
 *
 * Authentication cancellations are user actions, not errors,
 * so they should not update error state.
 *
 * @param error - The error to evaluate
 * @returns Whether the error should be stored in error state
 *
 * @internal
 *
 * @example
 * ```ts
 * if (shouldUpdateErrorState(error)) {
 *   setError(createOperationError('useSecret.save', error))
 * } else {
 *   setError(null)
 * }
 * ```
 */
export function shouldUpdateErrorState(error: unknown): boolean {
  return !isAuthenticationCanceled(error);
}
