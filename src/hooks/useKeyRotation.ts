import { useCallback, useMemo, useState } from 'react'
import { getKeyVersion, rotateKeys } from '../core/storage'
import type {
	RotateKeysRequest,
	RotationResult,
	SensitiveInfoOptions,
} from '../sensitive-info.nitro'
import createHookError from './error-utils'
import {
	createHookFailureResult,
	createHookSuccessResult,
	type HookError,
	type HookMutationResult,
} from './types'
import useMutation from './useMutation'

export interface UseKeyRotationOptions extends SensitiveInfoOptions {
	/** When `true`, rotations eagerly re-encrypt all entries. Defaults to `false` (lazy). */
	readonly reEncryptEagerly?: boolean
}

/** Per-call overrides accepted by {@link UseKeyRotationResult.rotate}. */
export interface RotateCallOptions {
	readonly reEncryptEagerly?: boolean
}

export interface UseKeyRotationResult {
	/** Most recent rotation result, if any. */
	readonly lastResult: RotationResult | null
	/** Current error bag for rotation operations. */
	readonly error: HookError | null
	/** True while a rotation call is in flight. */
	readonly isRotating: boolean
	/**
	 * Trigger a master-key rotation for the configured service. Pass
	 * `{ reEncryptEagerly: true }` to override the hook-level default for this call only.
	 */
	readonly rotate: (
		overrides?: RotateCallOptions
	) => Promise<HookMutationResult>
	/** Imperatively read the active key version from the native module. */
	readonly readVersion: () => Promise<number | null>
}

/**
 * Provides a minimal wrapper around {@link rotateKeys} / {@link getKeyVersion} with loading,
 * result, and error state wired up for UI consumption.
 *
 * @param options - Storage scoping plus a `reEncryptEagerly` default for the `rotate()` helper.
 * @returns A {@link UseKeyRotationResult} with `lastResult`, `error`, `isRotating`, and the
 * imperative `rotate` / `readVersion` helpers.
 *
 * @remarks
 * - `rotate({ reEncryptEagerly: true })` may trigger one biometric prompt **per protected entry**.
 *   Prefer the default lazy rotation unless you have a compliance reason to migrate ciphertext
 *   immediately.
 * - `rotate()` never throws \u2014 it resolves with a {@link HookMutationResult}.
 *
 * @example
 * ```tsx
 * const { rotate, readVersion, isRotating, lastResult } = useKeyRotation({
 *   service: 'com.example.auth',
 * })
 *
 * await rotate()                          // lazy: returns immediately
 * await rotate({ reEncryptEagerly: true }) // eager: re-encrypts every entry now
 * const version = await readVersion()
 * ```
 *
 * @see {@link rotateKeys}
 * @see {@link getKeyVersion}
 */
export function useKeyRotation(
	options?: UseKeyRotationOptions
): UseKeyRotationResult {
	const [lastResult, setLastResult] = useState<RotationResult | null>(null)
	const [readError, setReadError] = useState<HookError | null>(null)

	const {
		error: mutateError,
		isLoading,
		mutate,
	} = useMutation(
		'useKeyRotation.rotate',
		'Check that the service exists and that no auth-gated entries are blocking eager rotation.'
	)

	const rotate = useCallback(
		async (overrides?: RotateCallOptions): Promise<HookMutationResult> => {
			const request: RotateKeysRequest = {
				...options,
				reEncryptEagerly:
					overrides?.reEncryptEagerly ?? options?.reEncryptEagerly ?? false,
			}
			const outcome = await mutate(() => rotateKeys(request))
			if (outcome.success) {
				setLastResult(outcome.data)
				return createHookSuccessResult()
			}
			return createHookFailureResult(outcome.error)
		},
		[mutate, options]
	)

	const readVersion = useCallback(async () => {
		try {
			const version = await getKeyVersion(options)
			setReadError(null)
			return version
		} catch (errorLike) {
			setReadError(
				createHookError(
					'useKeyRotation.readVersion',
					errorLike,
					'The native module may not yet be initialised. Retry after a small delay.'
				)
			)
			return null
		}
	}, [options])

	const error = mutateError ?? readError

	return useMemo(
		() => ({
			lastResult,
			error,
			isRotating: isLoading,
			rotate,
			readVersion,
		}),
		[lastResult, error, isLoading, rotate, readVersion]
	)
}
