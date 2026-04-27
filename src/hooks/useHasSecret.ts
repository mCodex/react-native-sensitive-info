import { useCallback } from 'react'
import { hasItem } from '../core/storage'
import type { SensitiveInfoOptions } from '../sensitive-info.nitro'
import type { AsyncState } from './types'
import useAsyncQuery from './useAsyncQuery'

export interface UseHasSecretOptions extends SensitiveInfoOptions {
	/** Disable the automatic existence check while still exposing `refetch`. */
	readonly skip?: boolean
}

const DEFAULTS: Required<Pick<UseHasSecretOptions, 'skip'>> = { skip: false }

export interface UseHasSecretResult extends AsyncState<boolean> {
	readonly refetch: () => Promise<void>
}

/**
 * Checks if a secure item exists without fetching its payload.
 */
export function useHasSecret(
	key: string,
	options?: UseHasSecretOptions
): UseHasSecretResult {
	const runner = useCallback(
		(request: SensitiveInfoOptions) => hasItem(key, request),
		[key]
	)
	return useAsyncQuery<boolean, UseHasSecretOptions>(
		runner,
		DEFAULTS,
		'useHasSecret.evaluate',
		options,
		'Most commonly triggered by an invalid key/service combination.'
	)
}
