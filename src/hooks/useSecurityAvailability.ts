import { useCallback, useEffect, useRef, useState } from 'react'
import type { SecurityAvailability } from '../sensitive-info.nitro'
import { getSupportedSecurityLevels } from '../core/storage'
import { createInitialAsyncState } from './types'
import type { AsyncState } from './types'
import useAsyncLifecycle from './useAsyncLifecycle'
import createHookError from './error-utils'

/**
 * Result returned by {@link useSecurityAvailability}.
 */
export interface UseSecurityAvailabilityResult
  extends AsyncState<SecurityAvailability> {
  refetch: () => Promise<void>
}

/**
 * Queries which security primitives are available on the current device and caches the outcome.
 *
 * @example
 * ```tsx
 * const { data } = useSecurityAvailability()
 * if (data?.secureEnclave) {
 *   // show UI for hardware-backed storage
 * }
 * ```
 */
export function useSecurityAvailability(): UseSecurityAvailabilityResult {
  const [state, setState] = useState<AsyncState<SecurityAvailability>>(
    createInitialAsyncState<SecurityAvailability>()
  )

  const cacheRef = useRef<SecurityAvailability | null>(null)
  const dataRef = useRef<SecurityAvailability | null>(state.data)
  const { begin, mountedRef } = useAsyncLifecycle()

  useEffect(() => {
    dataRef.current = state.data
  }, [state.data])

  const fetchAvailability = useCallback(
    async (force = false) => {
      if (!force && cacheRef.current && dataRef.current == null) {
        setState({
          data: cacheRef.current,
          error: null,
          isLoading: false,
          isPending: false,
        })
        return
      }

      const controller = begin()
      setState((prev) => ({ ...prev, isLoading: true, isPending: true }))

      try {
        const capabilities = await getSupportedSecurityLevels()

        if (mountedRef.current && !controller.signal.aborted) {
          cacheRef.current = capabilities
          setState({
            data: capabilities,
            error: null,
            isLoading: false,
            isPending: false,
          })
        }
      } catch (error) {
        if (mountedRef.current && !controller.signal.aborted) {
          const hookError = createHookError(
            'useSecurityAvailability.fetch',
            error,
            'Try calling SensitiveInfo.getSupportedSecurityLevels() directly to inspect the native error.'
          )
          setState({
            data: null,
            error: hookError,
            isLoading: false,
            isPending: false,
          })
        }
      }
    },
    [begin, mountedRef]
  )

  useEffect(() => {
    fetchAvailability().catch(() => {})
  }, [fetchAvailability])

  const refetch = useCallback(async () => {
    await fetchAvailability(true)
  }, [fetchAvailability])

  return {
    ...state,
    refetch,
  }
}
