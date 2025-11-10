import { useCallback, useEffect, useState } from 'react';
import type {
  SensitiveInfoItem,
  SensitiveInfoOptions,
} from '../sensitive-info.nitro';
import {
  clearService,
  deleteItem,
  getAllItems,
  setItem,
} from '../core/storage';
import {
  HookError,
  createHookFailureResult,
  createHookSuccessResult,
  type HookMutationResult,
} from './types';
import useAsyncLifecycle from './useAsyncLifecycle';
import useStableOptions from './useStableOptions';
import {
  createFetchError,
  createMutationError,
  isAuthenticationCanceled,
  extractCoreStorageOptions,
} from './error-factory';

/**
 * Options accepted by {@link useSecureStorage}.
 */
export interface UseSecureStorageOptions extends SensitiveInfoOptions {
  /** Include decrypted values when listing items. Defaults to `false` for better performance. */
  readonly includeValues?: boolean;
  /** Bypass the initial fetch while leaving the imperative helpers available. */
  readonly skip?: boolean;
}

const DEFAULTS: Required<
  Pick<UseSecureStorageOptions, 'includeValues' | 'skip'>
> = {
  includeValues: false,
  skip: false,
};

/**
 * Structure returned by {@link useSecureStorage}.
 */
export interface UseSecureStorageResult {
  /** Latest snapshot of secrets returned by the underlying secure storage. */
  readonly items: SensitiveInfoItem[];
  /** Indicates whether initial or subsequent fetches are running. */
  readonly isLoading: boolean;
  /** Hook-level error describing the last failure, if any. */
  readonly error: HookError | null;
  /** Persist or replace a secret and refresh the cached list. */
  readonly saveSecret: (
    key: string,
    value: string
  ) => Promise<HookMutationResult>;
  /** Delete a secret from secure storage and update the local cache. */
  readonly removeSecret: (key: string) => Promise<HookMutationResult>;
  /** Remove every secret associated with the configured service. */
  readonly clearAll: () => Promise<HookMutationResult>;
  /** Manually refresh the secure storage contents without mutating data. */
  readonly refreshItems: () => Promise<void>;
}

/**
 * Manages a collection of secure items, exposing read/write helpers and render-ready state.
 *
 * This hook maintains a collection of all secrets in a service and provides
 * helpers for common operations (save, delete, clear). The collection is
 * automatically updated after mutations.
 *
 * @param options - Configuration including service and value inclusion preference
 *
 * @returns Collection state and mutation helpers
 *
 * @example
 * ```tsx
 * // List all items in a service
 * const {
 *   items,
 *   isLoading,
 *   error,
 *   saveSecret,
 *   removeSecret,
 *   clearAll
 * } = useSecureStorage({
 *   service: 'com.example.session',
 *   includeValues: true
 * })
 *
 * if (error) return <ErrorBanner error={error} />
 * if (isLoading) return <Spinner />
 *
 * return (
 *   <>
 *     {items.map(item => (
 *       <Item
 *         key={item.key}
 *         item={item}
 *         onDelete={() => removeSecret(item.key)}
 *       />
 *     ))}
 *     <button onClick={clearAll}>Clear All</button>
 *   </>
 * )
 * ```
 *
 * @example
 * ```tsx
 * // Lazy loading: populate on demand
 * const { items, refreshItems } = useSecureStorage({
 *   service: 'com.example',
 *   skip: true
 * })
 *
 * return (
 *   <button onClick={refreshItems}>
 *     Load Items
 *   </button>
 * )
 * ```
 *
 * @see {@link useSecretItem} for a single item
 * @see {@link useSecret} for single item with mutations
 *
 * @since 6.0.0
 */
export function useSecureStorage(
  options?: UseSecureStorageOptions
): UseSecureStorageResult {
  const [items, setItems] = useState<SensitiveInfoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<HookError | null>(null);

  const { begin, mountedRef } = useAsyncLifecycle();
  const stableOptions = useStableOptions<UseSecureStorageOptions>(
    DEFAULTS,
    options
  );

  const applyError = useCallback(
    (operation: string, errorLike: unknown): HookError => {
      const hookError = createFetchError(operation as any, errorLike);

      if (isAuthenticationCanceled(errorLike)) {
        if (mountedRef.current) {
          setError(null);
        }
        return hookError;
      }

      if (mountedRef.current) {
        setError(hookError);
      }
      return hookError;
    },
    [mountedRef]
  );

  const fetchItems = useCallback(async () => {
    const { skip, ...requestOptions } = stableOptions;

    if (skip) {
      setItems([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = begin();
    setIsLoading(true);

    try {
      const result = await getAllItems(requestOptions);

      if (mountedRef.current && !controller.signal.aborted) {
        setItems(result);
        setError(null);
      }
    } catch (errorLike) {
      if (mountedRef.current && !controller.signal.aborted) {
        const canceled = isAuthenticationCanceled(errorLike);

        applyError('useSecureStorage.fetch', errorLike);

        if (!canceled) {
          setItems([]);
        }
      }
    } finally {
      if (mountedRef.current && !controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [begin, mountedRef, stableOptions, applyError]);

  useEffect(() => {
    fetchItems().catch(() => {});
  }, [fetchItems]);

  const refreshItems = useCallback(async () => {
    await fetchItems();
  }, [fetchItems]);

  const saveSecret = useCallback(
    async (key: string, value: string) => {
      try {
        const coreOptions = extractCoreStorageOptions(stableOptions, [
          'skip',
          'includeValues',
        ]);
        await setItem(key, value, coreOptions);
        if (mountedRef.current) {
          await fetchItems();
          setError(null);
        }
        return createHookSuccessResult();
      } catch (errorLike) {
        const hookError = createMutationError(
          'useSecureStorage.save',
          errorLike
        );
        if (mountedRef.current && !isAuthenticationCanceled(errorLike)) {
          setError(hookError);
        }
        return createHookFailureResult(hookError);
      }
    },
    [fetchItems, mountedRef, stableOptions]
  );

  const removeSecret = useCallback(
    async (key: string) => {
      try {
        const coreOptions = extractCoreStorageOptions(stableOptions, [
          'skip',
          'includeValues',
        ]);
        await deleteItem(key, coreOptions);
        if (mountedRef.current) {
          setItems((prev) => prev.filter((item) => item.key !== key));
          setError(null);
        }
        return createHookSuccessResult();
      } catch (errorLike) {
        const hookError = createMutationError(
          'useSecureStorage.remove',
          errorLike
        );
        if (mountedRef.current && !isAuthenticationCanceled(errorLike)) {
          setError(hookError);
        }
        return createHookFailureResult(hookError);
      }
    },
    [mountedRef, stableOptions]
  );

  const clearAll = useCallback(async () => {
    try {
      const coreOptions = extractCoreStorageOptions(stableOptions, [
        'skip',
        'includeValues',
      ]);
      await clearService(coreOptions);
      if (mountedRef.current) {
        setItems([]);
        setError(null);
      }
      return createHookSuccessResult();
    } catch (errorLike) {
      const hookError = createMutationError(
        'useSecureStorage.clearAll',
        errorLike
      );
      if (mountedRef.current && !isAuthenticationCanceled(errorLike)) {
        setError(hookError);
      }
      return createHookFailureResult(hookError);
    }
  }, [mountedRef, stableOptions]);

  return {
    items,
    isLoading,
    error,
    saveSecret,
    removeSecret,
    clearAll,
    refreshItems,
  };
}
