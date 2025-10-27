/**
 * @internal - Hook utilities
 * Shared logic for all hooks following SRP principle
 */
import { useEffect, useRef } from 'react'
import type { SensitiveInfoOptions } from './sensitive-info.nitro'

/**
 * Shared state initialization for async operations
 */
export function initializeAsyncState<T>() {
  return {
    data: null as T | null,
    error: null,
    isLoading: true,
    isPending: false,
  }
}

/**
 * Shared hook for managing mounted state and cleanup
 */
export function useMountedRef() {
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      isMountedRef.current = false
      abortControllerRef.current?.abort()
    },
    []
  )

  return { isMountedRef, abortControllerRef }
}

/**
 * Shared options memoization with JSON stringification
 */
export function useMemoizedOptions(options?: SensitiveInfoOptions) {
  return JSON.stringify(options)
}

/**
 * Shared error state setter that checks if component is mounted
 */
export function createMountAwareSetter<T>(
  isMountedRef: React.MutableRefObject<boolean>,
  setState: React.Dispatch<React.SetStateAction<T>>
) {
  return (newState: T | ((prev: T) => T)) => {
    if (isMountedRef.current) {
      setState(newState)
    }
  }
}
