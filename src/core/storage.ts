import { isNotFoundError, toSensitiveInfoError } from '../errors'
import getNativeInstance from '../internal/native'
import {
	normalizeOptions,
	normalizePromptedReadOptions,
	normalizeStorageScopeOptions,
} from '../internal/options'
import {
	validateKey,
	validateService,
	validateValue,
} from '../internal/validate'
import type {
	MutationResult,
	RotateKeysRequest,
	RotationResult,
	SecurityAvailability,
	SensitiveInfoDeleteRequest,
	SensitiveInfoEnumerateRequest,
	SensitiveInfoGetRequest,
	SensitiveInfoHasRequest,
	SensitiveInfoItem,
	SensitiveInfoOptions,
	SensitiveInfoSetRequest,
} from '../sensitive-info.nitro'

/**
 * Strongly typed façade around the underlying Nitro native object.
 *
 * Each member mirrors a top-level export: prefer the named exports for tree-shaking, or use this
 * interface when injecting/mocking the storage surface (e.g. in tests).
 */
export interface SensitiveInfoApi {
	/** See {@link setItem}. */
	readonly setItem: typeof setItem
	/** See {@link getItem}. */
	readonly getItem: typeof getItem
	/** See {@link hasItem}. */
	readonly hasItem: typeof hasItem
	/** See {@link deleteItem}. */
	readonly deleteItem: typeof deleteItem
	/** See {@link getAllItems}. */
	readonly getAllItems: typeof getAllItems
	/** See {@link clearService}. */
	readonly clearService: typeof clearService
	/** See {@link getSupportedSecurityLevels}. */
	readonly getSupportedSecurityLevels: typeof getSupportedSecurityLevels
	/** See {@link rotateKeys}. */
	readonly rotateKeys: typeof rotateKeys
	/** See {@link getKeyVersion}. */
	readonly getKeyVersion: typeof getKeyVersion
}

/**
 * Encrypts and persists a secret value in the platform secure storage.
 *
 * @param key   - Stable identifier for the entry (non-empty). Re-using a key overwrites the prior value.
 * @param value - UTF-8 string to encrypt. Encode binary data as base64 before passing.
 * @param options - Storage policy. See {@link SensitiveInfoOptions} for defaults.
 * @returns The {@link MutationResult} containing the metadata that was actually applied (the
 * platform may downgrade the requested `accessControl`).
 *
 * @throws {@link AuthenticationCanceledError} if the user dismisses the biometric prompt.
 * @throws {@link KeyInvalidatedError} if the device's biometric set changed since the last write.
 * @throws {@link SensitiveInfoError} for any other native failure.
 *
 * @example
 * ```ts
 * await setItem('session-token', token, {
 *   service: 'com.example.auth',
 *   accessControl: 'secureEnclaveBiometry',
 *   authenticationPrompt: { title: 'Save your session' },
 * })
 * ```
 *
 * @see {@link SensitiveInfoSetRequest}
 * @see {@link MutationResult}
 */
export async function setItem(
	key: string,
	value: string,
	options?: SensitiveInfoOptions
): Promise<MutationResult> {
	validateKey(key)
	validateValue(value)
	validateService(options)
	const native = getNativeInstance()
	const payload: SensitiveInfoSetRequest = {
		key,
		value,
		...normalizeOptions(options),
	}
	try {
		return await native.setItem(payload)
	} catch (error) {
		throw toSensitiveInfoError(error)
	}
}

/**
 * Retrieves a previously stored secret.
 *
 * @param key - Identifier of the entry to fetch.
 * @param options - Storage scoping plus an optional `includeValue` flag (defaults to `true`).
 *   Pass `includeValue: false` to fetch metadata only — cheaper, and on iOS this avoids the
 *   biometric prompt on auth-gated entries.
 * @returns The {@link SensitiveInfoItem}, or `null` when no entry exists for `key`.
 *
 * @remarks
 * `NotFoundError` is intentionally swallowed and surfaced as `null`. Every other native error is
 * mapped to its typed {@link SensitiveInfoError} subclass and re-thrown.
 *
 * @throws {@link AuthenticationCanceledError} if the user dismisses the biometric prompt.
 * @throws {@link IntegrityViolationError} if the on-disk record fails its HMAC check.
 * @throws {@link KeyInvalidatedError} if the entry's biometric guard is no longer satisfiable.
 *
 * @example
 * ```ts
 * const item = await getItem('session-token', { service: 'com.example.auth' })
 * if (item) console.log(item.value, item.metadata.securityLevel)
 * ```
 *
 * @see {@link SensitiveInfoGetRequest}
 * @see {@link SensitiveInfoItem}
 */
export async function getItem(
	key: string,
	options?: SensitiveInfoOptions & { includeValue?: boolean }
): Promise<SensitiveInfoItem | null> {
	validateKey(key)
	validateService(options)
	const native = getNativeInstance()
	const includeValue = options?.includeValue ?? true
	const payload: SensitiveInfoGetRequest = {
		key,
		includeValue,
		...(includeValue
			? normalizePromptedReadOptions(options)
			: normalizeStorageScopeOptions(options)),
	}

	try {
		return await native.getItem(payload)
	} catch (error) {
		if (isNotFoundError(error)) return null
		throw toSensitiveInfoError(error)
	}
}

/**
 * Cheap existence check that never decrypts the value.
 *
 * @param key - Identifier to look up.
 * @param options - Storage scoping. `accessControl` / `authenticationPrompt` are ignored here —
 *   `hasItem` is designed to stay silent, even for biometric-protected entries.
 * @returns `true` when an entry exists for the key, `false` otherwise.
 *
 * @throws {@link SensitiveInfoError} for unexpected native failures (storage IO, etc.).
 *
 * @example
 * ```ts
 * if (await hasItem('session-token', { service: 'com.example.auth' })) {
 *   // skip onboarding
 * }
 * ```
 *
 * @see {@link SensitiveInfoHasRequest}
 */
export async function hasItem(
	key: string,
	options?: SensitiveInfoOptions
): Promise<boolean> {
	validateKey(key)
	validateService(options)
	const native = getNativeInstance()
	const payload: SensitiveInfoHasRequest = {
		key,
		...normalizeStorageScopeOptions(options),
	}
	try {
		return await native.hasItem(payload)
	} catch (error) {
		throw toSensitiveInfoError(error)
	}
}

/**
 * Deletes a stored secret. Idempotent — calling on a missing key resolves with `false` rather
 * than throwing.
 *
 * @param key - Identifier of the entry to delete.
 * @param options - Storage scoping. The `accessControl`/`authenticationPrompt` from the original
 *   write are not required for deletion.
 * @returns `true` when an entry was removed, `false` when the key did not exist.
 *
 * @throws {@link SensitiveInfoError} for unexpected native failures.
 *
 * @example
 * ```ts
 * await deleteItem('session-token', { service: 'com.example.auth' })
 * ```
 *
 * @see {@link SensitiveInfoDeleteRequest}
 */
export async function deleteItem(
	key: string,
	options?: SensitiveInfoOptions
): Promise<boolean> {
	validateKey(key)
	validateService(options)
	const native = getNativeInstance()
	const payload: SensitiveInfoDeleteRequest = {
		key,
		...normalizeStorageScopeOptions(options),
	}
	try {
		return await native.deleteItem(payload)
	} catch (error) {
		throw toSensitiveInfoError(error)
	}
}

/**
 * Enumerates every entry stored under the configured service namespace.
 *
 * @param options - Pass `{ includeValues: true }` to decrypt and return values; defaults to
 *   metadata-only for performance and to avoid biometric prompts on protected entries. Prompt
 *   strings are only forwarded when values are requested.
 * @returns Array of {@link SensitiveInfoItem}. Returns `[]` when the service is empty.
 *
 * @throws {@link AuthenticationCanceledError} when `includeValues: true` and the user cancels.
 * @throws {@link SensitiveInfoError} for unexpected native failures.
 *
 * @example
 * ```ts
 * const items = await getAllItems({ service: 'com.example.auth' })
 * console.log(items.map((i) => i.key))
 * ```
 *
 * @see {@link SensitiveInfoEnumerateRequest}
 */
export async function getAllItems(
	options?: SensitiveInfoEnumerateRequest
): Promise<SensitiveInfoItem[]> {
	validateService(options)
	const native = getNativeInstance()
	const payload: SensitiveInfoEnumerateRequest = {
		includeValues: options?.includeValues ?? false,
		...(options?.includeValues === true
			? normalizePromptedReadOptions(options)
			: normalizeStorageScopeOptions(options)),
	}
	try {
		return await native.getAllItems(payload)
	} catch (error) {
		throw toSensitiveInfoError(error)
	}
}

/**
 * Removes every entry associated with a service.
 *
 * @param options - Storage scoping (only `service`/`keychainGroup`/`iosSynchronizable` matter).
 * @returns Resolves when the service has been emptied.
 *
 * @remarks This is **non-recoverable** — there is no undo. Prefer this over deleting keys one by
 * one when wiping a feature on logout.
 *
 * @throws {@link SensitiveInfoError} for unexpected native failures.
 *
 * @example
 * ```ts
 * await clearService({ service: 'com.example.auth' })
 * ```
 */
export async function clearService(
	options?: SensitiveInfoOptions
): Promise<void> {
	validateService(options)
	const native = getNativeInstance()
	try {
		return await native.clearService(normalizeStorageScopeOptions(options))
	} catch (error) {
		throw toSensitiveInfoError(error)
	}
}

/**
 * Inspects which security primitives are available on the current device.
 *
 * Use this to drive feature flags (e.g. show "Enable Face ID" only when `biometry === true`)
 * before writing entries that require those capabilities.
 *
 * @returns A {@link SecurityAvailability} snapshot — `secureEnclave` is iOS-only, `strongBox` is
 * Android-only.
 *
 * @throws {@link SensitiveInfoError} for unexpected native failures.
 *
 * @example
 * ```ts
 * const caps = await getSupportedSecurityLevels()
 * if (caps.biometry) enableBiometricUnlock()
 * ```
 *
 * @see {@link useSecurityAvailability} for the React-hook variant.
 */
export async function getSupportedSecurityLevels(): Promise<SecurityAvailability> {
	const native = getNativeInstance()
	try {
		return await native.getSupportedSecurityLevels()
	} catch (error) {
		throw toSensitiveInfoError(error)
	}
}

/**
 * Rotates the master key for the given service.
 *
 * @param options - Pass `{ reEncryptEagerly: true }` to re-encrypt every existing entry in the
 *   same call; defaults to lazy rotation (entries are migrated on next read/write).
 * @returns A {@link RotationResult} with `previousVersion`, `newVersion`, and `reEncryptedCount`.
 *
 * @remarks Eager rotation may trigger one biometric prompt **per protected entry** — prefer the
 * default lazy mode unless you need to migrate ciphertext immediately for compliance reasons.
 *
 * @throws {@link RotationFailedError} when the native layer cannot generate a new key.
 * @throws {@link AuthenticationCanceledError} during eager rotation when the user cancels.
 *
 * @example
 * ```ts
 * const { newVersion } = await rotateKeys({ service: 'com.example.auth' })
 * console.log(`rotated to v${newVersion}`)
 * ```
 *
 * @see {@link RotateKeysRequest}
 * @see {@link useKeyRotation}
 */
export async function rotateKeys(
	options?: RotateKeysRequest
): Promise<RotationResult> {
	validateService(options)
	const native = getNativeInstance()
	const payload: RotateKeysRequest = {
		reEncryptEagerly: options?.reEncryptEagerly ?? false,
		...(options?.reEncryptEagerly === true
			? normalizePromptedReadOptions(options)
			: normalizeStorageScopeOptions(options)),
	}
	try {
		return await native.rotateKeys(payload)
	} catch (error) {
		throw toSensitiveInfoError(error)
	}
}

/**
 * Returns the currently active key version for the given service.
 *
 * @param options - Storage scoping. `authenticationPrompt` is ignored here — this call should
 *   never trigger biometrics.
 * @returns A non-negative integer. `0` indicates a legacy entry that has not been rotated yet.
 *
 * @throws {@link SensitiveInfoError} for unexpected native failures.
 *
 * @example
 * ```ts
 * const version = await getKeyVersion({ service: 'com.example.auth' })
 * if (version === 0) await rotateKeys({ service: 'com.example.auth' })
 * ```
 *
 * @see {@link rotateKeys}
 */
export async function getKeyVersion(
	options?: SensitiveInfoOptions
): Promise<number> {
	validateService(options)
	const native = getNativeInstance()
	try {
		return await native.getKeyVersion(normalizeStorageScopeOptions(options))
	} catch (error) {
		throw toSensitiveInfoError(error)
	}
}

/**
 * Convenient namespace exposing the secure storage surface. Named exports are the preferred way
 * to consume the library for optimal tree-shaking.
 */
export const SensitiveInfo: SensitiveInfoApi = {
	setItem,
	getItem,
	hasItem,
	deleteItem,
	getAllItems,
	clearService,
	getSupportedSecurityLevels,
	rotateKeys,
	getKeyVersion,
}
