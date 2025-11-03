import { useCallback, useEffect, useState } from 'react'
import type {
  SensitiveInfoItem,
  SensitiveInfoOptions,
} from '../sensitive-info.nitro'
import { clearService, deleteItem, getAllItems, setItem } from '../core/storage'
import {
  HookError,
  createHookFailureResult,
  createHookSuccessResult,
  type HookMutationResult,
} from './types'
import useAsyncLifecycle from './useAsyncLifecycle'
import useStableOptions from './useStableOptions'
import createHookError, { isAuthenticationCanceledError } from './error-utils'

/**
 * Options accepted by {@link useSecureStorage}.
 */
export interface UseSecureStorageOptions extends SensitiveInfoOptions {
  /** Include decrypted values when listing items. Defaults to `false` for better performance. */
  readonly includeValues?: boolean
  /** Bypass the initial fetch while leaving the imperative helpers available. */
  readonly skip?: boolean
}

const DEFAULTS: Required<
  Pick<UseSecureStorageOptions, 'includeValues' | 'skip'>
> = {
  includeValues: false,
  skip: false,
}

/**
 * Removes hook-only flags so that mutation helpers receive pristine {@link SensitiveInfoOptions}.
 */
const extractCoreOptions = (
  options: UseSecureStorageOptions
): SensitiveInfoOptions => {
  const { skip: _skip, includeValues: _includeValues, ...core } = options
  return core as SensitiveInfoOptions
}

/**
 * Structure returned by {@link useSecureStorage}.
 */
export interface UseSecureStorageResult {
  /** Latest snapshot of secrets returned by the underlying secure storage. */
  readonly items: SensitiveInfoItem[]
  /** Indicates whether initial or subsequent fetches are running. */
  readonly isLoading: boolean
  /** Hook-level error describing the last failure, if any. */
  readonly error: HookError | null
  /** Persist or replace a secret and refresh the cached list. */
  readonly saveSecret: (
    key: string,
    value: string
  ) => Promise<HookMutationResult>
  /** Delete a secret from secure storage and update the local cache. */
  readonly removeSecret: (key: string) => Promise<HookMutationResult>
  /** Remove every secret associated with the configured service. */
  readonly clearAll: () => Promise<HookMutationResult>
  /** Manually refresh the secure storage contents without mutating data. */
  readonly refreshItems: () => Promise<void>
}

/**
 * Manages a collection of secure items, exposing read/write helpers and render-ready state.
 *
 * @example
 * ```tsx
 * const {
 *   items,
 *   saveSecret,
 *   removeSecret,
 *   clearAll,
 * } = useSecureStorage({ service: 'com.example.session', includeValues: true })
 * ```
 */
export function useSecureStorage(
  options?: UseSecureStorageOptions
): UseSecureStorageResult {
  const [items, setItems] = useState<SensitiveInfoItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<HookError | null>(null)

  const { begin, mountedRef } = useAsyncLifecycle()
  const stableOptions = useStableOptions<UseSecureStorageOptions>(
    DEFAULTS,
    options
  )

  const applyError = useCallback(
    (operation: string, errorLike: unknown, hint: string): HookError => {
      const hookError = createHookError(operation, errorLike, hint)

      if (isAuthenticationCanceledError(errorLike)) {
        if (mountedRef.current) {
          setError(null)
        }
        return hookError
      }

      if (mountedRef.current) {
        setError(hookError)
      }
      return hookError
    },
    [mountedRef]
  )

  const fetchItems = useCallback(async () => {
    const { skip, ...requestOptions } = stableOptions

    if (skip) {
      setItems([])
      setIsLoading(false)
      setError(null)
      return
    }

    const controller = begin()
    setIsLoading(true)

    try {
      const result = await getAllItems(requestOptions)

      if (mountedRef.current && !controller.signal.aborted) {
        setItems(result)
        setError(null)
      }
    } catch (errorLike) {
      if (mountedRef.current && !controller.signal.aborted) {
        const canceled = isAuthenticationCanceledError(errorLike)

        applyError(
          'useSecureStorage.fetchItems',
          errorLike,
          'Ensure the service name matches the one used when storing the items.'
        )

        if (!canceled) {
          setItems([])
        }
      }
    } finally {
      if (mountedRef.current && !controller.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [begin, mountedRef, stableOptions])

  useEffect(() => {
    fetchItems().catch(() => {})
  }, [fetchItems])

  const refreshItems = useCallback(async () => {
    await fetchItems()
  }, [fetchItems])

  const saveSecret = useCallback(
    async (key: string, value: string) => {
      try {
        await setItem(key, value, extractCoreOptions(stableOptions))
        if (mountedRef.current) {
          await fetchItems()
        }
        return createHookSuccessResult()
      } catch (errorLike) {
        const hookError = applyError(
          'useSecureStorage.saveSecret',
          errorLike,
          'Check for duplicate keys or permission prompts that might have been dismissed.'
        )
        return createHookFailureResult(hookError)
      }
    },
    [applyError, fetchItems, mountedRef, stableOptions]
  )

  const removeSecret = useCallback(
    async (key: string) => {
      try {
        await deleteItem(key, extractCoreOptions(stableOptions))
        if (mountedRef.current) {
          setItems((prev) => prev.filter((item) => item.key !== key))
        }
        return createHookSuccessResult()
      } catch (errorLike) {
        const hookError = applyError(
          'useSecureStorage.removeSecret',
          errorLike,
          'Confirm the item still exists or that the user completed biometric prompts.'
        )
        return createHookFailureResult(hookError)
      }
    },
    [applyError, mountedRef, stableOptions]
  )

  const clearAll = useCallback(async () => {
    try {
      await clearService(extractCoreOptions(stableOptions))
      if (mountedRef.current) {
        setItems([])
        setError(null)
      }
      return createHookSuccessResult()
    } catch (errorLike) {
      const hookError = applyError(
        'useSecureStorage.clearAll',
        errorLike,
        'Inspect whether another process holds a lock on the secure storage.'
      )
      return createHookFailureResult(hookError)
    }
  }, [applyError, mountedRef, stableOptions])

  return {
    items,
    isLoading,
    error,
    saveSecret,
    removeSecret,
    clearAll,
    refreshItems,
  }
}
