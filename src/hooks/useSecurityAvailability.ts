import { useCallback, useMemo, useRef } from 'react'
import { getSupportedSecurityLevels } from '../core/storage'
import type { SecurityAvailability } from '../sensitive-info.nitro'
import type { AsyncState } from './types'
import useAsync from './useAsync'

export interface UseSecurityAvailabilityResult
	extends AsyncState<SecurityAvailability> {
	readonly refetch: () => Promise<void>
}

/**
 * Queries which security primitives are available on the current device and caches the outcome.
 *
 * @returns A {@link UseSecurityAvailabilityResult} with `data` (the latest snapshot),
 * `error`/`isLoading`/`isPending` flags, and a `refetch` helper that bypasses the cache.
 *
 * @remarks
 * - The hook caches the first successful response **per component instance** — subsequent
 *   renders of that same component reuse the cached value without hitting the native module.
 *   Multiple component instances each maintain their own cache.
 * - `refetch()` forces a fresh native call — use it after the user changes biometric enrollment
 *   in system settings.
 * - On error, the previously cached `data` is preserved so you can render fallback UI without
 *   losing capability info.
 *
 * @example
 * ```tsx
 * const { data: caps, isLoading } = useSecurityAvailability()
 *
 * if (isLoading || !caps) return null
 * return caps.biometry
 *   ? <EnableFaceIdToggle />
 *   : <Text>Biometrics unavailable on this device.</Text>
 * ```
 *
 * @see {@link getSupportedSecurityLevels}
 */
export function useSecurityAvailability(): UseSecurityAvailabilityResult {
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
	}, [inner.refetch])

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
