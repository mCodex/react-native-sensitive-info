import { useCallback, useState } from 'react'
import createHookError, { isAuthenticationCanceledError } from './error-utils'
import {
	createHookFailureResult,
	type HookError,
	type HookFailureResult,
} from './types'
import useAsyncLifecycle from './useAsyncLifecycle'

/**
 * Outcome of a {@link UseMutationResult.mutate} call. Successful runs include the resolved value;
 * failures carry a normalized {@link HookError}.
 */
export type MutationOutcome<T> =
	| { readonly success: true; readonly data: T }
	| HookFailureResult

/**
 * Shared state contract surfaced by {@link useMutation}. Mirrors {@link VoidAsyncState} so that
 * mutation-driven hooks can spread it into their public result without translation.
 */
export interface UseMutationState {
	readonly error: HookError | null
	readonly isLoading: boolean
	readonly isPending: boolean
}

/**
 * Options accepted on a per-call basis to customise error reporting.
 */
export interface MutateCallOptions {
	readonly operation?: string
	readonly hint?: string
}

export interface UseMutationResult extends UseMutationState {
	/**
	 * Runs an imperative async procedure and tracks loading + error state. Auth-cancel
	 * errors are silently absorbed (no error surfaced) but still produce a failure outcome
	 * so callers can short-circuit their own UI flow.
	 */
	readonly mutate: <T>(
		fn: (signal: AbortSignal) => Promise<T>,
		options?: MutateCallOptions
	) => Promise<MutationOutcome<T>>
	/** Clears the current error without otherwise touching state. */
	readonly clearError: () => void
}

const IDLE: UseMutationState = {
	error: null,
	isLoading: false,
	isPending: false,
}

/**
 * Generic state-machine + abort wiring shared by every mutation-style hook (`useSecureOperation`,
 * `useKeyRotation`, plus the `saveSecret`/`removeSecret`/`clearAll` helpers in
 * `useSecureStorage`). Centralises the auth-cancel / mount-guard / abort logic so each consumer
 * can stay a thin wrapper.
 *
 * @internal
 */
const useMutation = (
	defaultOperation: string,
	defaultHint: string
): UseMutationResult => {
	const [state, setState] = useState<UseMutationState>(IDLE)
	const { begin, mountedRef } = useAsyncLifecycle()

	const mutate = useCallback(
		async <T>(
			fn: (signal: AbortSignal) => Promise<T>,
			options?: MutateCallOptions
		): Promise<MutationOutcome<T>> => {
			const operation = options?.operation ?? defaultOperation
			const hint = options?.hint ?? defaultHint
			const controller = begin()

			setState({ error: null, isLoading: true, isPending: true })

			try {
				const data = await fn(controller.signal)
				if (mountedRef.current && !controller.signal.aborted) {
					setState(IDLE)
				}
				return { success: true, data }
			} catch (errorLike) {
				const hookError = createHookError(operation, errorLike, hint)
				if (!mountedRef.current || controller.signal.aborted) {
					return createHookFailureResult(hookError)
				}
				if (isAuthenticationCanceledError(errorLike)) {
					setState(IDLE)
				} else {
					setState({ error: hookError, isLoading: false, isPending: false })
				}
				return createHookFailureResult(hookError)
			}
		},
		[begin, mountedRef, defaultOperation, defaultHint]
	)

	const clearError = useCallback(() => {
		setState((prev) => (prev.error ? { ...prev, error: null } : prev))
	}, [])

	return { ...state, mutate, clearError }
}

export default useMutation
