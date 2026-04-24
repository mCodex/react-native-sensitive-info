import { isNotFoundError, toSensitiveInfoError } from '../errors'
import getNativeInstance from '../internal/native'
import { normalizeOptions } from '../internal/options'
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
 * Wraps any native throw in a typed {@link SensitiveInfoError} subclass so consumers can rely on
 * `instanceof` checks without importing the legacy marker helpers.
 */
const asTyped = (error: unknown): never => {
	throw toSensitiveInfoError(error)
}

/**
 * Strongly typed façade around the underlying Nitro native object.
 */
export interface SensitiveInfoApi {
	readonly setItem: typeof setItem
	readonly getItem: typeof getItem
	readonly hasItem: typeof hasItem
	readonly deleteItem: typeof deleteItem
	readonly getAllItems: typeof getAllItems
	readonly clearService: typeof clearService
	readonly getSupportedSecurityLevels: typeof getSupportedSecurityLevels
	readonly rotateKeys: typeof rotateKeys
	readonly getKeyVersion: typeof getKeyVersion
}

/**
 * Persist a secret value in the platform secure storage.
 */
export async function setItem(
	key: string,
	value: string,
	options?: SensitiveInfoOptions
): Promise<MutationResult> {
	const native = getNativeInstance()
	const payload: SensitiveInfoSetRequest = {
		key,
		value,
		...normalizeOptions(options),
	}
	try {
		return await native.setItem(payload)
	} catch (error) {
		return asTyped(error)
	}
}

/**
 * Retrieve a previously stored secret.
 */
export async function getItem(
	key: string,
	options?: SensitiveInfoOptions & { includeValue?: boolean }
): Promise<SensitiveInfoItem | null> {
	const native = getNativeInstance()
	const payload: SensitiveInfoGetRequest = {
		key,
		includeValue: options?.includeValue ?? true,
		...normalizeOptions(options),
	}

	try {
		return await native.getItem(payload)
	} catch (error) {
		if (isNotFoundError(error)) return null
		return asTyped(error)
	}
}

/**
 * Determine whether a secret exists for the given key.
 */
export async function hasItem(
	key: string,
	options?: SensitiveInfoOptions
): Promise<boolean> {
	const native = getNativeInstance()
	const payload: SensitiveInfoHasRequest = {
		key,
		...normalizeOptions(options),
	}
	try {
		return await native.hasItem(payload)
	} catch (error) {
		return asTyped(error)
	}
}

/**
 * Delete a stored secret.
 */
export async function deleteItem(
	key: string,
	options?: SensitiveInfoOptions
): Promise<boolean> {
	const native = getNativeInstance()
	const payload: SensitiveInfoDeleteRequest = {
		key,
		...normalizeOptions(options),
	}
	try {
		return await native.deleteItem(payload)
	} catch (error) {
		return asTyped(error)
	}
}

/**
 * Enumerate all secrets stored under a service.
 */
export async function getAllItems(
	options?: SensitiveInfoEnumerateRequest
): Promise<SensitiveInfoItem[]> {
	const native = getNativeInstance()
	const payload: SensitiveInfoEnumerateRequest = {
		includeValues: options?.includeValues ?? false,
		...normalizeOptions(options),
	}
	try {
		return await native.getAllItems(payload)
	} catch (error) {
		return asTyped(error)
	}
}

/**
 * Remove every secret associated with a service.
 */
export async function clearService(
	options?: SensitiveInfoOptions
): Promise<void> {
	const native = getNativeInstance()
	try {
		return await native.clearService(normalizeOptions(options))
	} catch (error) {
		return asTyped(error)
	}
}

/**
 * Inspect which security primitives are available on the current device.
 */
export async function getSupportedSecurityLevels(): Promise<SecurityAvailability> {
	const native = getNativeInstance()
	try {
		return await native.getSupportedSecurityLevels()
	} catch (error) {
		return asTyped(error)
	}
}

/**
 * Rotate the master key for a given service. Existing entries are re-encrypted lazily by default.
 */
export async function rotateKeys(
	options?: RotateKeysRequest
): Promise<RotationResult> {
	const native = getNativeInstance()
	const payload: RotateKeysRequest = {
		reEncryptEagerly: options?.reEncryptEagerly ?? false,
		...normalizeOptions(options),
	}
	try {
		return await native.rotateKeys(payload)
	} catch (error) {
		return asTyped(error)
	}
}

/**
 * Returns the currently active key version for the given service.
 */
export async function getKeyVersion(
	options?: SensitiveInfoOptions
): Promise<number> {
	const native = getNativeInstance()
	try {
		return await native.getKeyVersion(normalizeOptions(options))
	} catch (error) {
		return asTyped(error)
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
