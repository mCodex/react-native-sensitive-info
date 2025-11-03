import { useCallback, useEffect, useState } from 'react'
import type {
  SensitiveInfoItem,
  SensitiveInfoOptions,
} from '../sensitive-info.nitro'
import { getItem } from '../core/storage'
import { createInitialAsyncState } from './types'
import type { AsyncState } from './types'
import useAsyncLifecycle from './useAsyncLifecycle'
import useStableOptions from './useStableOptions'
import createHookError, { isAuthenticationCanceledError } from './error-utils'

/**
 * Configuration accepted by {@link useSecretItem}.
 * Extends the core {@link SensitiveInfoOptions} while adding hook-only flags for reactiveness.
 */
export interface UseSecretItemOptions extends SensitiveInfoOptions {
  /** When `false`, skip decrypting the value and return metadata only. Defaults to `true`. */
  readonly includeValue?: boolean
  /** Set to `true` to opt out of automatic fetching while keeping access to the imperative {@link UseSecretItemResult.refetch}. */
  readonly skip?: boolean
}

const SECRET_ITEM_DEFAULTS: Required<
  Pick<UseSecretItemOptions, 'includeValue' | 'skip'>
> = {
  includeValue: true,
  skip: false,
}

/**
 * Reactive state returned by {@link useSecretItem}.
 */
export interface UseSecretItemResult extends AsyncState<SensitiveInfoItem> {
  /** Manually re-run the underlying native call. Helpful after a mutation or when `skip` toggles. */
  refetch: () => Promise<void>
}

/**
 * Fetches a single entry from the secure store and keeps the result in sync with the component lifecycle.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useSecretItem('refreshToken', {
 *   service: 'com.example.session',
 *   includeValue: true,
 * })
 * ```
 */
export function useSecretItem(
  key: string,
  options?: UseSecretItemOptions
): UseSecretItemResult {
  const [state, setState] = useState<AsyncState<SensitiveInfoItem>>(
    createInitialAsyncState<SensitiveInfoItem>()
  )

  const { begin, mountedRef } = useAsyncLifecycle()
  const stableOptions = useStableOptions<UseSecretItemOptions>(
    SECRET_ITEM_DEFAULTS,
    options
  )

  const fetchItem = useCallback(async () => {
    const { skip, ...requestOptions } = stableOptions

    if (skip) {
      setState({
        data: null,
        error: null,
        isLoading: false,
        isPending: false,
      })
      return
    }

    const controller = begin()
    setState((prev) => ({ ...prev, isLoading: true, isPending: true }))

    try {
      const item = await getItem(key, requestOptions)

      if (mountedRef.current && !controller.signal.aborted) {
        setState({
          data: item,
          error: null,
          isLoading: false,
          isPending: false,
        })
      }
    } catch (errorLike) {
      if (mountedRef.current && !controller.signal.aborted) {
        if (isAuthenticationCanceledError(errorLike)) {
          setState((prev) => ({
            data: prev.data,
            error: null,
            isLoading: false,
            isPending: false,
          }))
        } else {
          const hookError = createHookError(
            'useSecretItem.fetch',
            errorLike,
            'Verify that the key/service pair exists and that includeValue is allowed for the caller.'
          )
          setState({
            data: null,
            error: hookError,
            isLoading: false,
            isPending: false,
          })
        }
      }
    }
  }, [begin, key, mountedRef, stableOptions])

  useEffect(() => {
    fetchItem().catch(() => {})
  }, [fetchItem])

  const refetch = useCallback(async () => {
    await fetchItem()
  }, [fetchItem])

  return {
    ...state,
    refetch,
  }
}
