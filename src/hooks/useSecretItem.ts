import { useCallback, useMemo } from 'react'
import { getItem } from '../core/storage'
import type {
	SensitiveInfoItem,
	SensitiveInfoOptions,
} from '../sensitive-info.nitro'
import type { AsyncState } from './types'
import useAsync from './useAsync'
import useStableOptions from './useStableOptions'

export interface UseSecretItemOptions extends SensitiveInfoOptions {
	/** When `false`, skip decrypting the value and return metadata only. Defaults to `true`. */
	readonly includeValue?: boolean
	/** Set to `true` to opt out of automatic fetching. */
	readonly skip?: boolean
}

const DEFAULTS: Required<Pick<UseSecretItemOptions, 'includeValue' | 'skip'>> =
	{
		includeValue: true,
		skip: false,
	}

export interface UseSecretItemResult extends AsyncState<SensitiveInfoItem> {
	readonly refetch: () => Promise<void>
}

/**
 * Fetches a single entry from the secure store and keeps the result in sync with the component.
 */
export function useSecretItem(
	key: string,
	options?: UseSecretItemOptions
): UseSecretItemResult {
	const stable = useStableOptions<UseSecretItemOptions>(DEFAULTS, options)
	const { skip } = stable
	const requestOptions = useMemo<SensitiveInfoOptions>(() => {
		const { skip: _s, ...rest } = stable
		return rest as SensitiveInfoOptions
	}, [stable])

	const run = useCallback(
		() => getItem(key, requestOptions),
		[key, requestOptions]
	)

	return useAsync<SensitiveInfoItem>(run, 'useSecretItem.fetch', {
		hint: 'Verify that the key/service pair exists and that includeValue is allowed for the caller.',
		skip,
	})
}
