import { useCallback } from 'react'
import { getItem } from '../core/storage'
import { normalizeStorageScopeOptions } from '../internal/options'
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
 *
 * @param key     - Identifier of the entry to fetch. Changing the key triggers a fresh request.
 * @param options - Storage scoping plus hook-only flags (`includeValue`, `skip`).
 * @returns A {@link UseSecretItemResult} with `data`/`error`/`isLoading`/`isPending` state and a
 * `refetch` helper.
 *
 * @remarks
 * - Pass `includeValue: false` to fetch metadata only \u2014 cheaper, and on iOS this avoids the
 *   biometric prompt. Use {@link useSecret} instead when you also need mutation helpers.
 * - The hook absorbs `NotFoundError` from the underlying {@link getItem} call and surfaces it as
 *   `data: null` \u2014 every other error appears in `error` as a {@link HookError}.
 *
 * @example
 * ```tsx
 * const { data, isLoading, refetch } = useSecretItem('session-token', {
 *   service: 'com.example.auth',
 * })
 *
 * if (isLoading) return <Spinner />
 * if (!data) return <SignInScreen />
 * return <Dashboard token={data.value!} backend={data.metadata.backend} />
 * ```
 *
 * @see {@link getItem}
 * @see {@link useSecret}
 */
export function useSecretItem(
	key: string,
	options?: UseSecretItemOptions
): UseSecretItemResult {
	const runner = useCallback(
		(request: SensitiveInfoOptions) => {
			const includeValue =
				(request as UseSecretItemOptions).includeValue ?? true
			return getItem(
				key,
				includeValue
					? request
					: { ...normalizeStorageScopeOptions(request), includeValue }
			)
		},
		[key]
	)
	return useAsyncQuery<SensitiveInfoItem, UseSecretItemOptions>(
		runner,
		DEFAULTS,
		'useSecretItem.fetch',
		options,
		'Verify that the key/service pair exists and that includeValue is allowed for the caller.'
	)
}
