import type {
  MutationResult,
  SecurityAvailability,
  SensitiveInfoDeleteRequest,
  SensitiveInfoEnumerateRequest,
  SensitiveInfoGetRequest,
  SensitiveInfoHasRequest,
  SensitiveInfoItem,
  SensitiveInfoOptions,
  SensitiveInfoSetRequest,
} from './sensitive-info.nitro'
import getNativeInstance from './native'
import { normalizeOptions } from './options'
import { isNotFoundError } from './errors'

/**
 * Persist a secret value in the platform secure storage.
 * When possible, the native side elevates the access control to hardware-backed storage such as Secure Enclave or StrongBox.
 *
 * ```ts
 * await setItem('refreshToken', token, {
 *   service: 'com.mcodex.session',
 *   accessControl: 'secureEnclaveBiometry',
 *   authenticationPrompt: { title: 'Authorize to update your session' },
 * })
 * ```
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
  return native.setItem(payload)
}

/**
 * Retrieve a previously stored secret.
 * By default the decrypted value is returned. Pass `includeValue: false` to fetch metadata only.
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
    if (isNotFoundError(error)) {
      return null
    }
    throw error
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
  return native.hasItem(payload)
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
  return native.deleteItem(payload)
}

/**
 * Enumerate all secrets stored under a service. Values are omitted unless `includeValues` is set.
 */
export async function getAllItems(
  options?: SensitiveInfoEnumerateRequest
): Promise<SensitiveInfoItem[]> {
  const native = getNativeInstance()
  const payload: SensitiveInfoEnumerateRequest = {
    includeValues: options?.includeValues ?? false,
    ...normalizeOptions(options),
  }
  return native.getAllItems(payload)
}

/**
 * Remove every secret associated with a service.
 */
export async function clearService(
  options?: SensitiveInfoOptions
): Promise<void> {
  const native = getNativeInstance()
  return native.clearService(normalizeOptions(options))
}

/**
 * Inspect which security primitives are available on the current device.
 */
export function getSupportedSecurityLevels(): Promise<SecurityAvailability> {
  const native = getNativeInstance()
  return native.getSupportedSecurityLevels()
}

/**
 * Convenient namespace exposing the secure storage surface area.
 */
export const SensitiveInfo = {
  setItem,
  getItem,
  hasItem,
  deleteItem,
  getAllItems,
  clearService,
  getSupportedSecurityLevels,
} as const

export default SensitiveInfo
