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
 *
 * @param key     - Identifier to look up. Changing the key triggers a fresh check.
 * @param options - Storage scoping plus a `skip` flag.
 * @returns A {@link UseHasSecretResult} where `data` is the boolean existence flag and `refetch`
 * re-runs the check on demand.
 *
 * @remarks Prefer this over {@link useSecret} / {@link useSecretItem} when you only need to know
 * whether a key exists \u2014 it never decrypts and never triggers biometric prompts.
 *
 * @example
 * ```tsx
 * const { data: hasToken, isLoading } = useHasSecret('session-token', {
 *   service: 'com.example.auth',
 * })
 *
 * if (isLoading) return null
 * return hasToken ? <Dashboard /> : <Onboarding />
 * ```
 *
 * @see {@link hasItem}
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
