import { useCallback, useMemo } from 'react'
import { deleteItem, setItem } from '../core/storage'
import type {
	SensitiveInfoItem,
	SensitiveInfoOptions,
} from '../sensitive-info.nitro'
import createHookError from './error-utils'
import {
	type AsyncState,
	createHookFailureResult,
	createHookSuccessResult,
	type HookMutationResult,
} from './types'
import { type UseSecretItemOptions, useSecretItem } from './useSecretItem'

/**
 * Configuration object for {@link useSecret}.
 * Combines the read options from {@link useSecretItem} with mutation convenience flags.
 */
export type UseSecretOptions = UseSecretItemOptions

/**
 * Result bag returned by {@link useSecret}.
 */
export interface UseSecretResult extends AsyncState<SensitiveInfoItem> {
	/** Persist a new value for the tracked secret and refresh the cache. */
	readonly saveSecret: (value: string) => Promise<HookMutationResult>
	/** Delete the tracked secret from secure storage. */
	readonly deleteSecret: () => Promise<HookMutationResult>
	/** Re-run the underlying fetch even if `skip` is enabled. */
	readonly refetch: () => Promise<void>
}

/**
 * Removes hook-specific flags before delegating to the storage module.
 */
const normalizeMutationOptions = (
	options?: UseSecretOptions
): SensitiveInfoOptions | undefined => {
	if (!options) return undefined
	const { skip: _skip, includeValue: _includeValue, ...core } = options
	return core as SensitiveInfoOptions
}

/**
 * Maintains a secure item while exposing imperative helpers to mutate or refresh it.
 *
 * Combines a read subscription (via {@link useSecretItem}) with `saveSecret` / `deleteSecret`
 * helpers that automatically refresh the cached entry on success.
 *
 * @param key     - Identifier of the secret to track. Changing the key triggers a fresh fetch.
 * @param options - Storage scoping plus hook flags (`skip`, `includeValue`).
 * @returns A {@link UseSecretResult} with `data`/`error`/`isLoading`/`isPending` state and the
 * `saveSecret`, `deleteSecret`, `refetch` helpers.
 *
 * @remarks
 * - Mutation helpers never throw \u2014 they resolve with a {@link HookMutationResult} discriminated
 *   union. Branch with `if (!result.success)`.
 * - If you only need read access, prefer {@link useSecretItem} \u2014 lighter result shape.
 *
 * @example
 * ```tsx
 * const { data, isLoading, saveSecret, deleteSecret } = useSecret('refreshToken', {
 *   service: 'com.example.session',
 * })
 *
 * await saveSecret(nextToken)
 * await deleteSecret()
 * ```
 *
 * @see {@link useSecretItem}
 * @see {@link setItem}
 * @see {@link deleteItem}
 */
export function useSecret(
	key: string,
	options?: UseSecretOptions
): UseSecretResult {
	const { data, error, isLoading, isPending, refetch } = useSecretItem(
		key,
		options
	)

	const saveSecret = useCallback(
		async (value: string) => {
			try {
				await setItem(key, value, normalizeMutationOptions(options))
				await refetch()
				return createHookSuccessResult()
			} catch (errorLike) {
				const hookError = createHookError(
					'useSecret.saveSecret',
					errorLike,
					'Check the access control requirements for this key.'
				)
				return createHookFailureResult(hookError)
			}
		},
		[key, options, refetch]
	)

	const deleteSecret = useCallback(async () => {
		try {
			await deleteItem(key, normalizeMutationOptions(options))
			await refetch()
			return createHookSuccessResult()
		} catch (errorLike) {
			const hookError = createHookError(
				'useSecret.deleteSecret',
				errorLike,
				'Ensure the user completed biometric prompts or that the key is spelled correctly.'
			)
			return createHookFailureResult(hookError)
		}
	}, [key, options, refetch])

	return useMemo(
		() => ({
			data,
			error,
			isLoading,
			isPending,
			saveSecret,
			deleteSecret,
			refetch,
		}),
		[data, error, isLoading, isPending, saveSecret, deleteSecret, refetch]
	)
}
