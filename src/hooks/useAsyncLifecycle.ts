import type { RefObject } from 'react'
import { useCallback, useEffect, useRef } from 'react'

export interface AsyncLifecycleControls {
	/**
	 * Indicates whether the component that owns the hook is still mounted. Helpful when dispatching asynchronous state updates.
	 */
	readonly mountedRef: RefObject<boolean>
	/**
	 * Stores the last {@link AbortController} created by {@link begin}. Exposed for advanced scenarios such as manual cancellation.
	 */
	readonly controllerRef: RefObject<AbortController | null>
	/** Aborts and clears the current execution signal, if one exists. */
	cancel: () => void
	/**
	 * Aborts the previous async job (if any) and returns a fresh {@link AbortController} tied to the current execution flow.
	 */
	begin: () => AbortController
}

/**
 * Tracks whether the owning component can still receive state updates and aborts
 * the previous signal when a request is replaced or the component unmounts.
 *
 * Aborting only stops work that observes the signal. It does not cancel a native
 * secure-storage write or biometric prompt already in progress.
 *
 * @example
 * ```tsx
 * const { begin, mountedRef } = useAsyncLifecycle()
 *
 * const fetchProfile = async () => {
 *   const controller = begin()
 *   const profile = await api.loadProfile({ signal: controller.signal })
 *   if (mountedRef.current && !controller.signal.aborted) {
 *     setProfile(profile)
 *   }
 * }
 * ```
 */
const useAsyncLifecycle = (): AsyncLifecycleControls => {
	const mountedRef = useRef(true)
	const controllerRef = useRef<AbortController | null>(null)
	const cancel = useCallback(() => {
		controllerRef.current?.abort()
		controllerRef.current = null
	}, [])

	useEffect(() => {
		mountedRef.current = true

		return () => {
			mountedRef.current = false
			cancel()
		}
	}, [cancel])

	const begin = useCallback(() => {
		cancel()
		const controller = new AbortController()
		controllerRef.current = controller
		return controller
	}, [cancel])

	return {
		mountedRef,
		controllerRef,
		cancel,
		begin,
	}
}

export default useAsyncLifecycle
