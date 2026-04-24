import { useCallback, useState } from 'react'
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

export interface UseKeyRotationOptions extends SensitiveInfoOptions {
	/** When `true`, rotations eagerly re-encrypt all entries. Defaults to `false` (lazy). */
	readonly reEncryptEagerly?: boolean
}

export interface UseKeyRotationResult {
	/** Most recent rotation result, if any. */
	readonly lastResult: RotationResult | null
	/** Current error bag for rotation operations. */
	readonly error: HookError | null
	/** True while a rotation call is in flight. */
	readonly isRotating: boolean
	/** Trigger a master-key rotation for the configured service. */
	readonly rotate: () => Promise<HookMutationResult>
	/** Imperatively read the active key version from the native module. */
	readonly readVersion: () => Promise<number | null>
}

/**
 * Provides a minimal wrapper around {@link rotateKeys} / {@link getKeyVersion} with loading,
 * result, and error state wired up for UI consumption.
 */
export function useKeyRotation(
	options?: UseKeyRotationOptions
): UseKeyRotationResult {
	const [isRotating, setIsRotating] = useState(false)
	const [error, setError] = useState<HookError | null>(null)
	const [lastResult, setLastResult] = useState<RotationResult | null>(null)

	const rotate = useCallback(async () => {
		setIsRotating(true)
		setError(null)
		try {
			const request: RotateKeysRequest = {
				...options,
				reEncryptEagerly: options?.reEncryptEagerly ?? false,
			}
			const result = await rotateKeys(request)
			setLastResult(result)
			setIsRotating(false)
			return createHookSuccessResult()
		} catch (errorLike) {
			const hookError = createHookError(
				'useKeyRotation.rotate',
				errorLike,
				'Check that the service exists and that no auth-gated entries are blocking eager rotation.'
			)
			setError(hookError)
			setIsRotating(false)
			return createHookFailureResult(hookError)
		}
	}, [options])

	const readVersion = useCallback(async () => {
		try {
			return await getKeyVersion(options)
		} catch (errorLike) {
			setError(
				createHookError(
					'useKeyRotation.readVersion',
					errorLike,
					'The native module may not yet be initialised. Retry after a small delay.'
				)
			)
			return null
		}
	}, [options])

	return {
		lastResult,
		error,
		isRotating,
		rotate,
		readVersion,
	}
}
