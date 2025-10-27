import { useCallback, useState } from 'react'
import { createInitialVoidState } from './types'
import type { VoidAsyncState } from './types'
import useAsyncLifecycle from './useAsyncLifecycle'
import createHookError from './error-utils'

/**
 * Result returned by {@link useSecureOperation}.
 */
export interface UseSecureOperationResult extends VoidAsyncState {
  readonly execute: (operation: () => Promise<void>) => Promise<void>
}

/**
 * Wraps a single asynchronous procedure (such as clearing a service) with loading and error state.
 *
 * @example
 * ```tsx
 * const secureLogout = useSecureOperation()
 *
 * const handleLogout = () => secureLogout.execute(() => SensitiveInfo.clearService({ service: 'auth' }))
 * ```
 */
export function useSecureOperation(): UseSecureOperationResult {
  const [state, setState] = useState<VoidAsyncState>(createInitialVoidState())
  const { begin, mountedRef } = useAsyncLifecycle()

  const execute = useCallback(
    async (operation: () => Promise<void>) => {
      const controller = begin()

      setState({
        error: null,
        isLoading: true,
        isPending: true,
      })

      try {
        await operation()

        if (mountedRef.current && !controller.signal.aborted) {
          setState({
            error: null,
            isLoading: false,
            isPending: false,
          })
        }
      } catch (errorLike) {
        if (mountedRef.current && !controller.signal.aborted) {
          setState({
            error: createHookError(
              'useSecureOperation.execute',
              errorLike,
              'Review the async callback passed to execute() for thrown errors.'
            ),
            isLoading: false,
            isPending: true,
          })
        }
      }
    },
    [begin, mountedRef]
  )

  return {
    ...state,
    execute,
  }
}
