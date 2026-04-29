import { useCallback, useMemo, useRef, useState } from 'react'
import { clearService, deleteItem, getAllItems, setItem } from '../core/storage'
import { normalizeStorageScopeOptions } from '../internal/options'
import type {
	SensitiveInfoItem,
	SensitiveInfoOptions,
} from '../sensitive-info.nitro'
import deepEqual from './internal/deepEqual'
import {
	createHookFailureResult,
	createHookSuccessResult,
	type HookError,
	type HookMutationResult,
} from './types'
import useAsyncQuery from './useAsyncQuery'
import useMutation from './useMutation'

/**
 * Options accepted by {@link useSecureStorage}.
 */
export interface UseSecureStorageOptions extends SensitiveInfoOptions {
	/** Include decrypted values when listing items. Defaults to `false` for better performance. */
	readonly includeValues?: boolean
	/** Bypass the initial fetch while leaving the imperative helpers available. */
	readonly skip?: boolean
}

const DEFAULTS: Required<
	Pick<UseSecureStorageOptions, 'includeValues' | 'skip'>
> = {
	includeValues: false,
	skip: false,
}

/**
 * Removes hook-only flags so that mutation helpers receive pristine {@link SensitiveInfoOptions}.
 */
const stripIncludeValues = (
	request: SensitiveInfoOptions & { includeValues?: boolean }
): SensitiveInfoOptions => {
	const { includeValues: _includeValues, ...core } = request
	return core
}

// Frozen, shared empty list used as the items fallback so identity stays stable across renders.
const EMPTY_ITEMS: SensitiveInfoItem[] = Object.freeze(
	[] as SensitiveInfoItem[]
) as SensitiveInfoItem[]

/**
 * Structure returned by {@link useSecureStorage}.
 */
export interface UseSecureStorageResult {
	/** Latest snapshot of secrets returned by the underlying secure storage. */
	readonly items: SensitiveInfoItem[]
	/** Indicates whether initial or subsequent fetches are running. */
	readonly isLoading: boolean
	/** Hook-level error describing the last failure, if any. */
	readonly error: HookError | null
	/** Persist or replace a secret and refresh the cached list. */
	readonly saveSecret: (
		key: string,
		value: string
	) => Promise<HookMutationResult>
	/** Delete a secret from secure storage and update the local cache. */
	readonly removeSecret: (key: string) => Promise<HookMutationResult>
	/** Remove every secret associated with the configured service. */
	readonly clearAll: () => Promise<HookMutationResult>
	/** Manually refresh the secure storage contents without mutating data. */
	readonly refreshItems: () => Promise<void>
}

/**
 * Manages a collection of secure items, exposing read/write helpers and render-ready state.
 *
 * Internally composes {@link useAsyncQuery} for the initial fetch and {@link useMutation} for
 * the imperative helpers, so the hook stays a thin choreography layer over the shared
 * lifecycle/abort/error machinery.
 *
 * @param options - Storage scoping plus hook-only flags (`includeValues`, `skip`).
 * @returns A {@link UseSecureStorageResult} with the cached `items`, lifecycle flags, and
 * imperative mutation helpers (`saveSecret`, `removeSecret`, `clearAll`, `refreshItems`).
 *
 * @remarks
 * - Mutations refresh the local cache automatically \u2014 you do **not** need to call `refreshItems`
 *   after `saveSecret`/`removeSecret`/`clearAll`.
 * - `clearAll` is **non-recoverable** \u2014 confirm intent in the UI before invoking.
 * - For single-key reads prefer {@link useSecret} or {@link useSecretItem}; this hook is optimized
 *   for managing a list of entries.
 *
 * @example
 * ```tsx
 * const { items, saveSecret, removeSecret, clearAll } = useSecureStorage({
 *   service: 'com.example.session',
 *   includeValues: true,
 * })
 *
 * await saveSecret('session-token', token)
 * ```
 *
 * @see {@link getAllItems}
 * @see {@link useSecret}
 */
export function useSecureStorage(
	options?: UseSecureStorageOptions
): UseSecureStorageResult {
	'use no memo'
	// Intentional opt-out: this hook coordinates several refs (cache, abort,
	// pending mutation) during render to keep the public API stable across
	// option-object identity changes — a pattern the React Compiler cannot
	// preserve without losing the deep-equality guarantees we ship.
	const fetchRunner = useCallback((request: SensitiveInfoOptions) => {
		const includeValues =
			(request as UseSecureStorageOptions).includeValues === true
		return getAllItems(
			includeValues ? request : normalizeStorageScopeOptions(request)
		)
	}, [])

	const fetchQuery = useAsyncQuery<
		SensitiveInfoItem[],
		UseSecureStorageOptions
	>(
		fetchRunner,
		DEFAULTS,
		'useSecureStorage.fetchItems',
		options,
		'Ensure the service name matches the one used when storing the items.'
	)

	const [localItems, setLocalItems] = useState<SensitiveInfoItem[] | null>(null)

	const items = useMemo(
		() => localItems ?? fetchQuery.data ?? EMPTY_ITEMS,
		[localItems, fetchQuery.data]
	)

	const {
		error: mutationError,
		mutate,
		clearError,
	} = useMutation('useSecureStorage.mutate', '')

	// Stabilize the mutation options reference: callers commonly pass inline literals,
	// so we cache by structural equality to prevent cascading re-creation of saveSecret /
	// removeSecret / clearAll callbacks.
	const coreOptionsRef = useRef<SensitiveInfoOptions | null>(null)
	const nextCoreOptions = stripIncludeValues({ ...options })
	if (
		coreOptionsRef.current === null ||
		!deepEqual(coreOptionsRef.current, nextCoreOptions)
	) {
		coreOptionsRef.current = nextCoreOptions
	}
	const coreOptions = coreOptionsRef.current

	const saveSecret = useCallback(
		async (key: string, value: string): Promise<HookMutationResult> => {
			const outcome = await mutate(() => setItem(key, value, coreOptions), {
				operation: 'useSecureStorage.saveSecret',
				hint: 'Check for duplicate keys or permission prompts that might have been dismissed.',
			})
			if (!outcome.success) {
				return createHookFailureResult(outcome.error)
			}
			setLocalItems(null)
			await fetchQuery.refetch()
			return createHookSuccessResult()
		},
		[mutate, coreOptions, fetchQuery.refetch]
	)

	const removeSecret = useCallback(
		async (key: string): Promise<HookMutationResult> => {
			const outcome = await mutate(() => deleteItem(key, coreOptions), {
				operation: 'useSecureStorage.removeSecret',
				hint: 'Confirm the item still exists or that the user completed biometric prompts.',
			})
			if (!outcome.success) {
				return createHookFailureResult(outcome.error)
			}
			setLocalItems((prev) =>
				(prev ?? fetchQuery.data ?? []).filter((item) => item.key !== key)
			)
			return createHookSuccessResult()
		},
		[mutate, coreOptions, fetchQuery.data]
	)

	const clearAll = useCallback(async (): Promise<HookMutationResult> => {
		const outcome = await mutate(() => clearService(coreOptions), {
			operation: 'useSecureStorage.clearAll',
			hint: 'Inspect whether another process holds a lock on the secure storage.',
		})
		if (!outcome.success) {
			return createHookFailureResult(outcome.error)
		}
		setLocalItems([])
		clearError()
		return createHookSuccessResult()
	}, [mutate, coreOptions, clearError])

	const refreshItems = useCallback(async () => {
		setLocalItems(null)
		await fetchQuery.refetch()
	}, [fetchQuery.refetch])

	const error = mutationError ?? fetchQuery.error

	return useMemo(
		() => ({
			items,
			isLoading: fetchQuery.isLoading,
			error,
			saveSecret,
			removeSecret,
			clearAll,
			refreshItems,
		}),
		[
			items,
			fetchQuery.isLoading,
			error,
			saveSecret,
			removeSecret,
			clearAll,
			refreshItems,
		]
	)
}
