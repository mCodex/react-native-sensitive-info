import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { getSupportedSecurityLevels } from '../core/storage'
import type { SecurityAvailability } from '../sensitive-info.nitro'
import type { AsyncState } from './types'
import useAsync from './useAsync'

/**
 * Tunables for {@link useSecurityAvailability}.
 *
 * @public
 */
export interface UseSecurityAvailabilityOptions {
	/**
	 * When `true`, automatically calls {@link UseSecurityAvailabilityResult.refetch} whenever the
	 * app transitions to the `active` state. Recommended for screens that gate UI on biometric
	 * enrollment — covers the common flow where the user leaves to system settings, enrolls/removes
	 * a biometric, and returns to the app.
	 *
	 * @remarks Back-to-back `active` transitions within ~500 ms are debounced to avoid double
	 * fetches when iOS briefly inactivates the app for system overlays (Control Center, Face ID
	 * sheet, etc.). Listener is detached on unmount.
	 *
	 * @defaultValue `false`
	 */
	readonly refreshOnForeground?: boolean
}

/**
 * Result returned by {@link useSecurityAvailability}.
 *
 * @public
 */
export interface UseSecurityAvailabilityResult
	extends AsyncState<SecurityAvailability> {
	/** Forces a fresh native call, bypassing the per-instance cache. */
	readonly refetch: () => Promise<void>
}

const FOREGROUND_DEBOUNCE_MS = 500

/** Queries device security capabilities and caches the result per component instance. */
export function useSecurityAvailability(
	options?: UseSecurityAvailabilityOptions
): UseSecurityAvailabilityResult {
	const cacheRef = useRef<SecurityAvailability | null>(null)
	const forceRef = useRef(false)

	const run = useCallback(async () => {
		if (cacheRef.current && !forceRef.current) return cacheRef.current
		forceRef.current = false
		const value = await getSupportedSecurityLevels()
		cacheRef.current = value
		return value
	}, [])

	const inner = useAsync<SecurityAvailability>(
		run,
		'useSecurityAvailability.fetch',
		{
			hint: 'Try calling SensitiveInfo.getSupportedSecurityLevels() directly to inspect the native error.',
			preserveDataOnError: true,
		}
	)

	const refetch = useCallback(async () => {
		forceRef.current = true
		await inner.refetch()
		// Depend on the whole `inner` object: the React Compiler infers `inner` as
		// the dependency and a more specific `[inner.refetch]` would prevent it
		// from preserving this memoization.
	}, [inner])

	const refreshOnForeground = options?.refreshOnForeground === true
	const lastRefreshRef = useRef(0)

	useEffect(() => {
		if (!refreshOnForeground) return undefined
		const handleChange = (next: AppStateStatus) => {
			if (next !== 'active') return
			const now = Date.now()
			if (now - lastRefreshRef.current < FOREGROUND_DEBOUNCE_MS) return
			lastRefreshRef.current = now
			void refetch()
		}
		const subscription = AppState.addEventListener('change', handleChange)
		return () => subscription.remove()
	}, [refreshOnForeground, refetch])

	return useMemo(
		() => ({
			data: inner.data,
			error: inner.error,
			isLoading: inner.isLoading,
			isPending: inner.isPending,
			refetch,
		}),
		[inner.data, inner.error, inner.isLoading, inner.isPending, refetch]
	)
}
