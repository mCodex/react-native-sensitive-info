import { useCallback, useEffect, useState } from 'react'
import type {
  SensitiveInfoItem,
  SensitiveInfoOptions,
} from '../sensitive-info.nitro'
import { clearService, deleteItem, getAllItems, setItem } from '../core/storage'
import { HookError } from './types'
import useAsyncLifecycle from './useAsyncLifecycle'
import useStableOptions from './useStableOptions'
import createHookError from './error-utils'

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
  const sanitized = { ...options } as Record<string, unknown>
  delete sanitized.skip
  delete sanitized.includeValues
  return sanitized as SensitiveInfoOptions
}

/**
 * Structure returned by {@link useSecureStorage}.
 */
export interface UseSecureStorageResult {
  readonly items: SensitiveInfoItem[]
  readonly isLoading: boolean
  readonly error: HookError | null
  readonly saveSecret: (
    key: string,
    value: string
  ) => Promise<{ success: boolean; error?: HookError }>
  readonly removeSecret: (
    key: string
  ) => Promise<{ success: boolean; error?: HookError }>
  readonly clearAll: () => Promise<{ success: boolean; error?: HookError }>
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
        const hookError = createHookError(
          'useSecureStorage.fetchItems',
          errorLike,
          'Ensure the service name matches the one used when storing the items.'
        )
        setError(hookError)
        setItems([])
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
        return { success: true } as const
      } catch (errorLike) {
        const hookError = createHookError(
          'useSecureStorage.saveSecret',
          errorLike,
          'Check for duplicate keys or permission prompts that might have been dismissed.'
        )
        if (mountedRef.current) {
          setError(hookError)
        }
        return { success: false, error: hookError } as const
      }
    },
    [fetchItems, mountedRef, stableOptions]
  )

  const removeSecret = useCallback(
    async (key: string) => {
      try {
        await deleteItem(key, extractCoreOptions(stableOptions))
        if (mountedRef.current) {
          setItems((prev) => prev.filter((item) => item.key !== key))
        }
        return { success: true } as const
      } catch (errorLike) {
        const hookError = createHookError(
          'useSecureStorage.removeSecret',
          errorLike,
          'Confirm the item still exists or that the user completed biometric prompts.'
        )
        if (mountedRef.current) {
          setError(hookError)
        }
        return { success: false, error: hookError } as const
      }
    },
    [mountedRef, stableOptions]
  )

  const clearAll = useCallback(async () => {
    try {
      await clearService(extractCoreOptions(stableOptions))
      if (mountedRef.current) {
        setItems([])
        setError(null)
      }
      return { success: true } as const
    } catch (errorLike) {
      const hookError = createHookError(
        'useSecureStorage.clearAll',
        errorLike,
        'Inspect whether another process holds a lock on the secure storage.'
      )
      if (mountedRef.current) {
        setError(hookError)
      }
      return { success: false, error: hookError } as const
    }
  }, [mountedRef, stableOptions])

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
