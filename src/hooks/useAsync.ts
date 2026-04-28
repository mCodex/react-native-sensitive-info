import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { isAuthenticationCanceledError } from '../errors'
import createHookError from './error-utils'
import type { HookError } from './types'
import { type AsyncState, createInitialAsyncState } from './types'
import useAsyncLifecycle from './useAsyncLifecycle'

export interface UseAsyncResult<T> extends AsyncState<T> {
	readonly refetch: () => Promise<void>
}

type AsyncAction<T> =
	| { type: 'reset' }
	| { type: 'load' }
	| { type: 'success'; data: T | null }
	| { type: 'cancel' }
	| { type: 'error'; error: HookError; preserveData: boolean }

const RESET_STATE: AsyncState<unknown> = {
	data: null,
	error: null,
	isLoading: false,
	isPending: false,
}

const reducer = <T>(
	state: AsyncState<T>,
	action: AsyncAction<T>
): AsyncState<T> => {
	switch (action.type) {
		case 'reset':
			return state.data === null &&
				state.error === null &&
				!state.isLoading &&
				!state.isPending
				? state
				: (RESET_STATE as AsyncState<T>)
		case 'load':
			return state.isLoading && state.isPending
				? state
				: { ...state, isLoading: true, isPending: true }
		case 'success':
			return {
				data: action.data,
				error: null,
				isLoading: false,
				isPending: false,
			}
		case 'cancel':
			return state.error === null && !state.isLoading && !state.isPending
				? state
				: { data: state.data, error: null, isLoading: false, isPending: false }
		case 'error':
			return {
				data: action.preserveData ? state.data : null,
				error: action.error,
				isLoading: false,
				isPending: false,
			}
	}
}

/**
 * Consolidates the shared async-lifecycle pattern (state machine + abort + mount guard) used by
 * every data-fetching hook in this package.
 *
 * Callers must provide a **stable** `run` callback — typically wrapped in `useCallback` — along
 * with the operation identifier used for error reporting.
 *
 * @internal
 */
export default function useAsync<T>(
	run: (signal: AbortSignal) => Promise<T | null>,
	operation: string,
	options: {
		readonly hint?: string | undefined
		readonly skip?: boolean | undefined
		/** When `true`, data is preserved on error instead of being reset to `null`. */
		readonly preserveDataOnError?: boolean | undefined
	} = {}
): UseAsyncResult<T> {
	'use no memo'
	// Intentional opt-out: the body uses optional chaining inside a try/catch
	// (a value-block pattern the React Compiler does not yet support). The
	// inner reducer + memoized callbacks already minimise re-renders.
	const { hint, skip = false, preserveDataOnError = false } = options
	const [state, dispatch] = useReducer(
		reducer as (state: AsyncState<T>, action: AsyncAction<T>) => AsyncState<T>,
		undefined,
		createInitialAsyncState<T>
	)
	const { begin, mountedRef } = useAsyncLifecycle()

	const execute = useCallback(async () => {
		if (skip) {
			dispatch({ type: 'reset' })
			return
		}

		const controller = begin()
		dispatch({ type: 'load' })

		try {
			const result = await run(controller.signal)
			if (mountedRef.current && !controller.signal.aborted) {
				dispatch({ type: 'success', data: result })
			}
		} catch (errorLike) {
			if (!mountedRef.current || controller.signal.aborted) return
			if (isAuthenticationCanceledError(errorLike)) {
				dispatch({ type: 'cancel' })
				return
			}
			const hookError = createHookError(operation, errorLike, hint)
			dispatch({
				type: 'error',
				error: hookError,
				preserveData: preserveDataOnError,
			})
		}
	}, [skip, begin, mountedRef, run, operation, hint, preserveDataOnError])

	useEffect(() => {
		execute().catch(() => {})
	}, [execute])

	const refetch = useCallback(async () => {
		await execute()
	}, [execute])

	return useMemo(
		() => ({
			data: state.data,
			error: state.error,
			isLoading: state.isLoading,
			isPending: state.isPending,
			refetch,
		}),
		[state.data, state.error, state.isLoading, state.isPending, refetch]
	)
}
