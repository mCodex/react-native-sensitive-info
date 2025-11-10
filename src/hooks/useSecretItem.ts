import { useCallback, useEffect, useState } from 'react';
import type {
  SensitiveInfoItem,
  SensitiveInfoOptions,
} from '../sensitive-info.nitro';
import { getItem } from '../core/storage';
import { createInitialAsyncState } from './types';
import type { AsyncState } from './types';
import useAsyncLifecycle from './useAsyncLifecycle';
import useStableOptions from './useStableOptions';
import { createFetchError, isAuthenticationCanceled } from './error-factory';

/**
 * Configuration accepted by {@link useSecretItem}.
 * Extends the core {@link SensitiveInfoOptions} while adding hook-only flags for reactiveness.
 */
export interface UseSecretItemOptions extends SensitiveInfoOptions {
  /** When `false`, skip decrypting the value and return metadata only. Defaults to `true`. */
  readonly includeValue?: boolean;
  /** Set to `true` to opt out of automatic fetching while keeping access to the imperative {@link UseSecretItemResult.refetch}. */
  readonly skip?: boolean;
}

const SECRET_ITEM_DEFAULTS: Required<
  Pick<UseSecretItemOptions, 'includeValue' | 'skip'>
> = {
  includeValue: true,
  skip: false,
};

/**
 * Reactive state returned by {@link useSecretItem}.
 */
export interface UseSecretItemResult extends AsyncState<SensitiveInfoItem> {
  /** Manually re-run the underlying native call. Helpful after a mutation or when `skip` toggles. */
  refetch: () => Promise<void>;
}

/**
 * Fetches a single entry from the secure store and keeps the result in sync with the component lifecycle.
 *
 * This hook automatically runs on mount and when options change, but can be skipped with `skip: true`.
 * It handles lifecycle cleanup (abort in-flight requests when unmounting) and authentication
 * cancellations (which are not errors, just user actions).
 *
 * @param key - The storage key to fetch
 * @param options - Configuration including service, access control, and fetch behavior
 *
 * @returns Async state with the item and a refetch function
 *
 * @example
 * ```tsx
 * // Basic usage
 * const { data, isLoading, error, refetch } = useSecretItem('authToken', {
 *   service: 'com.example.session'
 * })
 *
 * if (error) {
 *   return <ErrorView error={error} onRetry={refetch} />
 * }
 *
 * if (isLoading) {
 *   return <Skeleton />
 * }
 *
 * return (
 *   <View>
 *     <Text>Token: {data?.value}</Text>
 *     <Text>Security: {data?.metadata.securityLevel}</Text>
 *   </View>
 * )
 * ```
 *
 * @example
 * ```tsx
 * // Lazy loading: skip initial fetch
 * const { data, refetch } = useSecretItem('onDemandSecret', {
 *   service: 'com.example',
 *   skip: true
 * })
 *
 * return (
 *   <button onClick={refetch}>
 *     Load Secret
 *   </button>
 * )
 * ```
 *
 * @example
 * ```tsx
 * // Metadata only (no authentication required)
 * const { data } = useSecretItem('secretKey', {
 *   service: 'com.example',
 *   includeValue: false
 * })
 *
 * return <Text>Last modified: {data?.metadata.timestamp}</Text>
 * ```
 *
 * @see {@link useSecret} to combine read and write operations
 * @see {@link useSecureStorage} to manage multiple items
 *
 * @since 6.0.0
 */
export function useSecretItem(
  key: string,
  options?: UseSecretItemOptions
): UseSecretItemResult {
  const [state, setState] = useState<AsyncState<SensitiveInfoItem>>(
    createInitialAsyncState<SensitiveInfoItem>()
  );

  const { begin, mountedRef } = useAsyncLifecycle();
  const stableOptions = useStableOptions<UseSecretItemOptions>(
    SECRET_ITEM_DEFAULTS,
    options
  );

  const fetchItem = useCallback(async () => {
    const { skip, ...requestOptions } = stableOptions;

    if (skip) {
      setState({
        data: null,
        error: null,
        isLoading: false,
        isPending: false,
      });
      return;
    }

    const controller = begin();
    setState((prev) => ({ ...prev, isLoading: true, isPending: true }));

    try {
      const item = await getItem(key, requestOptions);

      if (mountedRef.current && !controller.signal.aborted) {
        setState({
          data: item,
          error: null,
          isLoading: false,
          isPending: false,
        });
      }
    } catch (errorLike) {
      if (mountedRef.current && !controller.signal.aborted) {
        if (isAuthenticationCanceled(errorLike)) {
          setState((prev) => ({
            data: prev.data,
            error: null,
            isLoading: false,
            isPending: false,
          }));
        } else {
          const hookError = createFetchError(
            'useSecretItem.fetch',
            errorLike
          );
          setState({
            data: null,
            error: hookError,
            isLoading: false,
            isPending: false,
          });
        }
      }
    }
  }, [begin, key, mountedRef, stableOptions]);

  useEffect(() => {
    fetchItem().catch(() => {});
  }, [fetchItem]);

  const refetch = useCallback(async () => {
    await fetchItem();
  }, [fetchItem]);

  return {
    ...state,
    refetch,
  };
}
