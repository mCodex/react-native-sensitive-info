import { useCallback } from 'react';
import type {
  SensitiveInfoItem,
} from '../sensitive-info.nitro';
import { deleteItem, setItem } from '../core/storage';
import {
  createHookFailureResult,
  createHookSuccessResult,
  type HookMutationResult,
  type AsyncState,
} from './types';
import { useSecretItem, type UseSecretItemOptions } from './useSecretItem';
import {
  createMutationError,
  extractCoreStorageOptions,
} from './error-factory';

/**
 * Configuration object for {@link useSecret}.
 * Combines the read options from {@link useSecretItem} with mutation convenience flags.
 */
export type UseSecretOptions = UseSecretItemOptions;

/**
 * Result bag returned by {@link useSecret}.
 */
export interface UseSecretResult extends AsyncState<SensitiveInfoItem> {
  /** Persist a new value for the tracked secret and refresh the cache. */
  readonly saveSecret: (value: string) => Promise<HookMutationResult>;
  /** Delete the tracked secret from secure storage. */
  readonly deleteSecret: () => Promise<HookMutationResult>;
  /** Re-run the underlying fetch even if `skip` is enabled. */
  readonly refetch: () => Promise<void>;
}

/**
 * Maintains a secure item while exposing imperative helpers to mutate or refresh it.
 *
 * Combines the read state of {@link useSecretItem} with mutation operations
 * (save/delete) in a single hook, eliminating the need to pair hooks.
 *
 * @param key - The storage key to track
 * @param options - Configuration for reading the item (service, access control, etc.)
 *
 * @returns Complete state and mutation helpers for the secret
 *
 * @example
 * ```tsx
 * // Simple secret management
 * const secret = useSecret('refreshToken', { service: 'com.example.session' })
 *
 * if (secret.error) {
 *   return <ErrorDialog error={secret.error} />
 * }
 *
 * if (secret.isLoading) {
 *   return <Spinner />
 * }
 *
 * return (
 *   <button
 *     onClick={() => secret.saveSecret('new-token-value')}
 *     disabled={secret.isPending}
 *   >
 *     Update Secret
 *   </button>
 * )
 * ```
 *
 * @see {@link useSecretItem} for read-only access
 * @see {@link useSecureStorage} for managing multiple items
 *
 * @since 6.0.0
 */
export function useSecret(
  key: string,
  options?: UseSecretOptions
): UseSecretResult {
  const { data, error, isLoading, isPending, refetch } = useSecretItem(
    key,
    options
  );

  const saveSecret = useCallback(
    async (value: string) => {
      try {
        const coreOptions = extractCoreStorageOptions(options ?? {}, [
          'skip',
          'includeValue',
        ]);
        await setItem(key, value, coreOptions);
        await refetch();
        return createHookSuccessResult();
      } catch (errorLike) {
        const hookError = createMutationError('useSecret.save', errorLike);
        return createHookFailureResult(hookError);
      }
    },
    [key, options, refetch]
  );

  const deleteSecret = useCallback(async () => {
    try {
      const coreOptions = extractCoreStorageOptions(options ?? {}, [
        'skip',
        'includeValue',
      ]);
      await deleteItem(key, coreOptions);
      await refetch();
      return createHookSuccessResult();
    } catch (errorLike) {
      const hookError = createMutationError('useSecret.delete', errorLike);
      return createHookFailureResult(hookError);
    }
  }, [key, options, refetch]);

  return {
    data,
    error,
    isLoading,
    isPending,
    saveSecret,
    deleteSecret,
    refetch,
  };
}
