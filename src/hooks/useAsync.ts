import { useCallback, useEffect, useState } from 'react'
import { isAuthenticationCanceledError } from '../errors'
import createHookError from './error-utils'
import { type AsyncState, createInitialAsyncState } from './types'
import useAsyncLifecycle from './useAsyncLifecycle'

export interface UseAsyncResult<T> extends AsyncState<T> {
	readonly refetch: () => Promise<void>
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
		readonly hint?: string
		readonly skip?: boolean
		/** When `true`, data is preserved on error instead of being reset to `null`. */
		readonly preserveDataOnError?: boolean
	} = {}
): UseAsyncResult<T> {
	const { hint, skip = false, preserveDataOnError = false } = options
	const [state, setState] = useState<AsyncState<T>>(
		createInitialAsyncState<T>()
	)
	const { begin, mountedRef } = useAsyncLifecycle()

	const execute = useCallback(async () => {
		if (skip) {
			setState({
				data: null,
				error: null,
				isLoading: false,
				isPending: false,
			})
			return
		}

		const controller = begin()
		setState((prev) => ({ ...prev, isLoading: true, isPending: true }))

		try {
			const result = await run(controller.signal)
			if (mountedRef.current && !controller.signal.aborted) {
				setState({
					data: result,
					error: null,
					isLoading: false,
					isPending: false,
				})
			}
		} catch (errorLike) {
			if (!mountedRef.current || controller.signal.aborted) return
			if (isAuthenticationCanceledError(errorLike)) {
				setState((prev) => ({
					data: prev.data,
					error: null,
					isLoading: false,
					isPending: false,
				}))
				return
			}
			const hookError = createHookError(operation, errorLike, hint)
			setState((prev) => ({
				data: preserveDataOnError ? prev.data : null,
				error: hookError,
				isLoading: false,
				isPending: false,
			}))
		}
	}, [skip, begin, mountedRef, run, operation, hint, preserveDataOnError])

	useEffect(() => {
		execute().catch(() => {})
	}, [execute])

	const refetch = useCallback(async () => {
		await execute()
	}, [execute])

	return { ...state, refetch }
}
