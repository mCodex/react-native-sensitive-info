import { useCallback } from 'react'
import type { VoidAsyncState } from './types'
import useMutation from './useMutation'

/**
 * Result returned by {@link useSecureOperation}.
 */
export interface UseSecureOperationResult extends VoidAsyncState {
	/** Executes the secured procedure while tracking loading and error state. */
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
	const { error, isLoading, isPending, mutate } = useMutation(
		'useSecureOperation.execute',
		'Review the async callback passed to execute() for thrown errors.'
	)

	const execute = useCallback(
		async (operation: () => Promise<void>) => {
			await mutate(() => operation())
		},
		[mutate]
	)

	return { error, isLoading, isPending, execute }
}
