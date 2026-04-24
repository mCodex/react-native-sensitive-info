import { useCallback, useRef } from 'react'
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

	const { refetch: innerRefetch, ...state } = useAsync<SecurityAvailability>(
		run,
		'useSecurityAvailability.fetch',
		{
			hint: 'Try calling SensitiveInfo.getSupportedSecurityLevels() directly to inspect the native error.',
			preserveDataOnError: true,
		}
	)

	const refetch = useCallback(async () => {
		forceRef.current = true
		await innerRefetch()
	}, [innerRefetch])

	return { ...state, refetch }
}
