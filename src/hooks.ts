import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  SecurityAvailability,
  SensitiveInfoItem,
  SensitiveInfoOptions,
} from './sensitive-info.nitro'
import {
  clearService,
  deleteItem,
  getAllItems,
  getItem,
  getSupportedSecurityLevels,
  hasItem as checkHasItem,
  setItem as saveItem,
} from './index'
import { getErrorMessage } from './errors'
import { useMountedRef } from './hook-utils'

/**
 * Error wrapper for better error handling in hooks
 */
export class HookError extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'HookError'
  }
}

/**
 * Represents the state of an async operation
 */
export interface AsyncState<TData> {
  data: TData | null
  error: HookError | null
  isLoading: boolean
  isPending: boolean
}

/**
 * Result type for operations that return void
 */
export interface VoidAsyncState {
  error: HookError | null
  isLoading: boolean
  isPending: boolean
}

/**
 * Custom hook for managing a single secure storage item with loading and error states.
 * Handles memory cleanup and cancellation on unmount.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useSecretItem('apiToken', {
 *   service: 'myapp',
 *   accessControl: 'secureEnclaveBiometry'
 * })
 *
 * if (isLoading) return <Text>Loading...</Text>
 * if (error) return <Text>Error: {error.message}</Text>
 * return <Text>{data?.value}</Text>
 * ```
 */
export function useSecretItem(
  key: string,
  options?: SensitiveInfoOptions & { includeValue?: boolean; skip?: boolean }
): AsyncState<SensitiveInfoItem> & { refetch: () => Promise<void> } {
  const [state, setState] = useState<AsyncState<SensitiveInfoItem>>({
    data: null,
    error: null,
    isLoading: true,
    isPending: false,
  })

  // Use shared hook for mounted state and request cancellation
  const { isMountedRef, abortControllerRef } = useMountedRef()

  // Stable options object to avoid unnecessary re-renders
  const stableOptions = useMemo(
    () => ({ includeValue: true, ...options }),
    [JSON.stringify(options)]
  )

  const fetchItem = useCallback(async () => {
    // Don't fetch if skip is true
    if (stableOptions.skip) {
      setState({
        data: null,
        error: null,
        isLoading: false,
        isPending: false,
      })
      return
    }

    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController()
    const { signal } = abortControllerRef.current

    setState((prev) => ({
      ...prev,
      isLoading: true,
    }))

    try {
      const item = await getItem(key, stableOptions)

      // Check if component is still mounted and request wasn't cancelled
      if (isMountedRef.current && !signal.aborted) {
        setState({
          data: item,
          error: null,
          isLoading: false,
          isPending: false,
        })
      }
    } catch (err) {
      // Only update state if component is mounted and request wasn't cancelled
      if (isMountedRef.current && !signal.aborted) {
        const errorMessage = getErrorMessage(err)
        setState({
          data: null,
          error: new HookError(`Failed to fetch secret: ${errorMessage}`, err),
          isLoading: false,
          isPending: false,
        })
      }
    }
  }, [key, stableOptions])

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchItem()

    // Cleanup function: cancel request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      isMountedRef.current = false
    }
  }, [fetchItem])

  const refetch = useCallback(async () => {
    await fetchItem()
  }, [fetchItem])

  return {
    ...state,
    refetch,
  }
}

/**
 * Custom hook for checking if a secret exists.
 * Lightweight operation suitable for existence checks without fetching the value.
 *
 * @example
 * ```tsx
 * const { data: exists, isLoading } = useHasSecret('apiToken')
 *
 * if (isLoading) return <Text>Checking...</Text>
 * return <Text>{exists ? 'Secret exists' : 'Not found'}</Text>
 * ```
 */
export function useHasSecret(
  key: string,
  options?: SensitiveInfoOptions & { skip?: boolean }
): AsyncState<boolean> & { refetch: () => Promise<void> } {
  const [state, setState] = useState<AsyncState<boolean>>({
    data: null,
    error: null,
    isLoading: true,
    isPending: false,
  })

  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  const stableOptions = useMemo(() => options ?? {}, [JSON.stringify(options)])

  const checkExists = useCallback(async () => {
    if (stableOptions.skip) {
      setState({
        data: null,
        error: null,
        isLoading: false,
        isPending: false,
      })
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    const { signal } = abortControllerRef.current

    setState((prev) => ({
      ...prev,
      isLoading: true,
    }))

    try {
      const exists = await checkHasItem(key, stableOptions)

      if (isMountedRef.current && !signal.aborted) {
        setState({
          data: exists,
          error: null,
          isLoading: false,
          isPending: false,
        })
      }
    } catch (err) {
      if (isMountedRef.current && !signal.aborted) {
        const errorMessage = getErrorMessage(err)
        setState({
          data: null,
          error: new HookError(`Failed to check secret: ${errorMessage}`, err),
          isLoading: false,
          isPending: false,
        })
      }
    }
  }, [key, stableOptions])

  useEffect(() => {
    checkExists()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      isMountedRef.current = false
    }
  }, [checkExists])

  const refetch = useCallback(async () => {
    await checkExists()
  }, [checkExists])

  return {
    ...state,
    refetch,
  }
}

/**
 * Custom hook for managing all secrets in a service.
 * Provides CRUD operations and automatic state management.
 *
 * @example
 * ```tsx
 * const {
 *   items,
 *   isLoading,
 *   error,
 *   saveSecret,
 *   removeSecret,
 *   refreshItems,
 * } = useSecureStorage({
 *   service: 'myapp',
 *   includeValues: true,
 * })
 *
 * return (
 *   <View>
 *     {items.map(item => <Text key={item.key}>{item.key}</Text>)}
 *     <Button onPress={() => saveSecret('token', 'value')} title="Save" />
 *   </View>
 * )
 * ```
 */
export function useSecureStorage(
  options?: SensitiveInfoOptions & { includeValues?: boolean; skip?: boolean }
): {
  items: SensitiveInfoItem[]
  isLoading: boolean
  error: HookError | null
  saveSecret: (
    key: string,
    value: string
  ) => Promise<{ success: boolean; error?: HookError }>
  removeSecret: (
    key: string
  ) => Promise<{ success: boolean; error?: HookError }>
  clearAll: () => Promise<{ success: boolean; error?: HookError }>
  refreshItems: () => Promise<void>
} {
  const [items, setItems] = useState<SensitiveInfoItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<HookError | null>(null)

  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  const stableOptions = useMemo(
    () => ({ includeValues: false, ...options }),
    [JSON.stringify(options)]
  )

  const fetchItems = useCallback(async () => {
    if (stableOptions.skip) {
      setItems([])
      setIsLoading(false)
      setError(null)
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    const { signal } = abortControllerRef.current

    setIsLoading(true)

    try {
      const allItems = await getAllItems(stableOptions)

      if (isMountedRef.current && !signal.aborted) {
        setItems(allItems)
        setError(null)
      }
    } catch (err) {
      if (isMountedRef.current && !signal.aborted) {
        const errorMessage = getErrorMessage(err)
        setError(new HookError(`Failed to fetch items: ${errorMessage}`, err))
        setItems([])
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [stableOptions])

  useEffect(() => {
    fetchItems().catch(() => {
      // Error is already handled in fetchItems state update
    })

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      isMountedRef.current = false
    }
  }, [fetchItems])

  const saveSecret = useCallback(
    async (key: string, value: string) => {
      try {
        await saveItem(key, value, stableOptions)

        if (isMountedRef.current) {
          // Refresh items to reflect the new state
          await fetchItems()
        }

        return { success: true }
      } catch (err) {
        const errorMessage = getErrorMessage(err)
        const hookError = new HookError(
          `Failed to save secret: ${errorMessage}`,
          err
        )

        if (isMountedRef.current) {
          setError(hookError)
        }

        return { success: false, error: hookError }
      }
    },
    [stableOptions, fetchItems]
  )

  const removeSecret = useCallback(
    async (key: string) => {
      try {
        await deleteItem(key, stableOptions)

        if (isMountedRef.current) {
          // Optimistically remove from local state
          setItems((prev) => prev.filter((item) => item.key !== key))
        }

        return { success: true }
      } catch (err) {
        const errorMessage = getErrorMessage(err)
        const hookError = new HookError(
          `Failed to delete secret: ${errorMessage}`,
          err
        )

        if (isMountedRef.current) {
          setError(hookError)
        }

        return { success: false, error: hookError }
      }
    },
    [stableOptions]
  )

  const clearAll = useCallback(async () => {
    try {
      await clearService(stableOptions)

      if (isMountedRef.current) {
        setItems([])
        setError(null)
      }

      return { success: true }
    } catch (err) {
      const errorMessage = getErrorMessage(err)
      const hookError = new HookError(
        `Failed to clear service: ${errorMessage}`,
        err
      )

      if (isMountedRef.current) {
        setError(hookError)
      }

      return { success: false, error: hookError }
    }
  }, [stableOptions])

  const refreshItems = useCallback(async () => {
    await fetchItems()
  }, [fetchItems])

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

/**
 * Custom hook for querying device security capabilities.
 * Results are cached to avoid unnecessary native calls.
 *
 * @example
 * ```tsx
 * const { capabilities, isLoading, error, refetch } = useSecurityAvailability()
 *
 * return (
 *   <View>
 *     <Text>Secure Enclave: {capabilities?.secureEnclave ? 'Yes' : 'No'}</Text>
 *     <Button onPress={refetch} title="Refresh" />
 *   </View>
 * )
 * ```
 */
export function useSecurityAvailability(): AsyncState<SecurityAvailability> & {
  refetch: () => Promise<void>
} {
  const [state, setState] = useState<AsyncState<SecurityAvailability>>({
    data: null,
    error: null,
    isLoading: true,
    isPending: false,
  })

  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)
  const cacheRef = useRef<SecurityAvailability | null>(null)

  const fetchCapabilities = useCallback(async () => {
    // Return cached value if available
    if (cacheRef.current && state.data === null) {
      setState({
        data: cacheRef.current,
        error: null,
        isLoading: false,
        isPending: false,
      })
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    const { signal } = abortControllerRef.current

    setState((prev) => ({
      ...prev,
      isLoading: true,
    }))

    try {
      const capabilities = await getSupportedSecurityLevels()

      if (isMountedRef.current && !signal.aborted) {
        // Cache the result
        cacheRef.current = capabilities

        setState({
          data: capabilities,
          error: null,
          isLoading: false,
          isPending: false,
        })
      }
    } catch (err) {
      if (isMountedRef.current && !signal.aborted) {
        const errorMessage = getErrorMessage(err)
        setState({
          data: null,
          error: new HookError(
            `Failed to fetch security availability: ${errorMessage}`,
            err
          ),
          isLoading: false,
          isPending: false,
        })
      }
    }
  }, [])

  useEffect(() => {
    fetchCapabilities().catch(() => {
      // Error is already handled in fetchCapabilities state update
    })

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      isMountedRef.current = false
    }
  }, [fetchCapabilities])

  const refetch = useCallback(async () => {
    await fetchCapabilities()
  }, [fetchCapabilities])

  return {
    ...state,
    refetch,
  }
}

/**
 * Custom hook for managing a single secret with save, delete, and refetch operations.
 * Combines reading and writing into a single, convenient interface.
 *
 * @example
 * ```tsx
 * const {
 *   item,
 *   isLoading,
 *   error,
 *   saveSecret,
 *   deleteSecret,
 *   refetch,
 * } = useSecret('apiToken', { service: 'myapp' })
 *
 * return (
 *   <View>
 *     {item && <Text>{item.value}</Text>}
 *     <Button onPress={() => saveSecret('newValue')} title="Update" />
 *     <Button onPress={deleteSecret} title="Delete" />
 *   </View>
 * )
 * ```
 */
export function useSecret(
  key: string,
  options?: SensitiveInfoOptions & { includeValue?: boolean }
): AsyncState<SensitiveInfoItem> & {
  saveSecret: (
    value: string
  ) => Promise<{ success: boolean; error?: HookError }>
  deleteSecret: () => Promise<{ success: boolean; error?: HookError }>
  refetch: () => Promise<void>
} {
  const { data, error, isLoading, isPending, refetch } = useSecretItem(
    key,
    options
  )
  const isMountedRef = useRef(true)

  useEffect(
    () => () => {
      isMountedRef.current = false
    },
    []
  )

  const saveSecret = useCallback(
    async (value: string) => {
      try {
        await saveItem(key, value, options)

        if (isMountedRef.current) {
          // Refetch to update local state
          await refetch()
        }

        return { success: true }
      } catch (err) {
        const errorMessage = getErrorMessage(err)
        const hookError = new HookError(
          `Failed to save secret: ${errorMessage}`,
          err
        )
        return { success: false, error: hookError }
      }
    },
    [key, options, refetch]
  )

  const deleteSecret = useCallback(async () => {
    try {
      await deleteItem(key, options)

      if (isMountedRef.current) {
        // Refetch to update local state
        await refetch()
      }

      return { success: true }
    } catch (err) {
      const errorMessage = getErrorMessage(err)
      const hookError = new HookError(
        `Failed to delete secret: ${errorMessage}`,
        err
      )
      return { success: false, error: hookError }
    }
  }, [key, options, refetch])

  return {
    data,
    error,
    isLoading,
    isPending,
    saveSecret,
    deleteSecret,
    refetch,
  }
}

/**
 * Custom hook for performing a one-time operation on secure storage with loading state.
 * Useful for operations that don't need to be reactive (e.g., bulk operations).
 *
 * @example
 * ```tsx
 * const { execute, isLoading, error } = useSecureOperation()
 *
 * const handleLogout = () => {
 *   execute(() => clearService({ service: 'auth' }))
 * }
 *
 * return <Button onPress={handleLogout} disabled={isLoading} title="Logout" />
 * ```
 */
export function useSecureOperation(): VoidAsyncState & {
  execute: (operation: () => Promise<void>) => Promise<void>
} {
  const [state, setState] = useState<VoidAsyncState>({
    error: null,
    isLoading: false,
    isPending: false,
  })

  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      isMountedRef.current = false
    },
    []
  )

  const execute = useCallback(async (operation: () => Promise<void>) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    const { signal } = abortControllerRef.current

    setState({
      error: null,
      isLoading: true,
      isPending: true,
    })

    try {
      await operation()

      if (isMountedRef.current && !signal.aborted) {
        setState({
          error: null,
          isLoading: false,
          isPending: false,
        })
      }
    } catch (err) {
      if (isMountedRef.current && !signal.aborted) {
        const errorMessage = getErrorMessage(err)
        setState({
          error: new HookError(`Operation failed: ${errorMessage}`, err),
          isLoading: false,
          isPending: true,
        })
      }
    }
  }, [])

  return {
    ...state,
    execute,
  }
}
