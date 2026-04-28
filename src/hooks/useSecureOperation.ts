import { useCallback, useMemo } from 'react'
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
 * @returns A {@link UseSecureOperationResult} with `error`/`isLoading`/`isPending` flags and an
 * `execute(operation)` helper that runs the supplied async callback while tracking lifecycle.
 *
 * @remarks
 * - `execute()` swallows the underlying throw and surfaces the failure as `error` (a typed
 *   {@link HookError}). It never re-throws.
 * - User-cancelled biometric prompts surface as a `HookError` whose `cause` is an
 *   {@link AuthenticationCanceledError} \u2014 inspect `.cause` if you need to differentiate.
 *
 * @example
 * ```tsx
 * const secureLogout = useSecureOperation()
 *
 * const handleLogout = () =>
 *   secureLogout.execute(() => clearService({ service: 'com.example.auth' }))
 *
 * if (secureLogout.error) toast(secureLogout.error.message)
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

	return useMemo(
		() => ({ error, isLoading, isPending, execute }),
		[error, isLoading, isPending, execute]
	)
}
