import { getItem } from '../core/storage'
import type {
	SensitiveInfoItem,
	SensitiveInfoOptions,
} from '../sensitive-info.nitro'
import type { AsyncState } from './types'
import useAsyncQuery from './useAsyncQuery'

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
	return useAsyncQuery<SensitiveInfoItem, UseSecretItemOptions>(
		(request) => getItem(key, request),
		DEFAULTS,
		'useSecretItem.fetch',
		options,
		'Verify that the key/service pair exists and that includeValue is allowed for the caller.'
	)
}
