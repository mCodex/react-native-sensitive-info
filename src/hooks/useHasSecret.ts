import { useCallback, useMemo } from 'react'
import { hasItem } from '../core/storage'
import type { SensitiveInfoOptions } from '../sensitive-info.nitro'
import type { AsyncState } from './types'
import useAsync from './useAsync'
import useStableOptions from './useStableOptions'

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
	const stable = useStableOptions<UseHasSecretOptions>(DEFAULTS, options)
	const { skip } = stable
	const requestOptions = useMemo<SensitiveInfoOptions>(() => {
		const { skip: _s, ...rest } = stable
		return rest
	}, [stable])

	const run = useCallback(
		() => hasItem(key, requestOptions),
		[key, requestOptions]
	)

	return useAsync<boolean>(run, 'useHasSecret.evaluate', {
		hint: 'Most commonly triggered by an invalid key/service combination.',
		skip,
	})
}
