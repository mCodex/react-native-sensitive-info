import { useCallback, useEffect, useState } from 'react'
import type { SensitiveInfoOptions } from '../sensitive-info.nitro'
import { hasItem } from '../core/storage'
import { createInitialAsyncState } from './types'
import type { AsyncState } from './types'
import useAsyncLifecycle from './useAsyncLifecycle'
import useStableOptions from './useStableOptions'
import createHookError, { isAuthenticationCanceledError } from './error-utils'

/**
 * Options accepted by {@link useHasSecret}.
 */
export interface UseHasSecretOptions extends SensitiveInfoOptions {
  /** Disable the automatic existence check while still exposing {@link UseHasSecretResult.refetch}. */
  readonly skip?: boolean
}

const DEFAULTS: Required<Pick<UseHasSecretOptions, 'skip'>> = {
  skip: false,
}

/**
 * Result bag returned by {@link useHasSecret}.
 */
export interface UseHasSecretResult extends AsyncState<boolean> {
  /** Refresh the cached boolean value. */
  refetch: () => Promise<void>
}

/**
 * Checks if a secure item exists without fetching its payload.
 *
 * @example
 * ```tsx
 * const { data: exists } = useHasSecret('refreshToken', { service: 'com.example.session' })
 * ```
 */
export function useHasSecret(
  key: string,
  options?: UseHasSecretOptions
): UseHasSecretResult {
  const [state, setState] = useState<AsyncState<boolean>>(
    createInitialAsyncState<boolean>()
  )

  const { begin, mountedRef } = useAsyncLifecycle()
  const stableOptions = useStableOptions<UseHasSecretOptions>(DEFAULTS, options)

  const evaluate = useCallback(async () => {
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
      const exists = await hasItem(key, requestOptions)

      if (mountedRef.current && !controller.signal.aborted) {
        setState({
          data: exists,
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
            'useHasSecret.evaluate',
            errorLike,
            'Most commonly triggered by an invalid key/service combination.'
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
    evaluate().catch(() => {})
  }, [evaluate])

  const refetch = useCallback(async () => {
    await evaluate()
  }, [evaluate])

  return {
    ...state,
    refetch,
  }
}
