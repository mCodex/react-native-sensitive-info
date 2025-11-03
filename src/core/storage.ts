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
} from '../sensitive-info.nitro';
import getNativeInstance from '../internal/native';
import { normalizeOptions } from '../internal/options';
import { isNotFoundError } from '../internal/errors';

/**
 * Strongly typed façade around the underlying Nitro native object.
 * Each function handles payload normalization before delegating to native code.
 */
export interface SensitiveInfoApi {
  readonly setItem: typeof setItem;
  readonly getItem: typeof getItem;
  readonly hasItem: typeof hasItem;
  readonly deleteItem: typeof deleteItem;
  readonly getAllItems: typeof getAllItems;
  readonly clearService: typeof clearService;
  readonly getSupportedSecurityLevels: typeof getSupportedSecurityLevels;
}

/**
 * Persist a secret value in the platform secure storage.
 * When possible, the native side elevates the access control to hardware-backed storage such as Secure Enclave or StrongBox.
 */
export async function setItem(
  key: string,
  value: string,
  options?: SensitiveInfoOptions
): Promise<MutationResult> {
  const native = getNativeInstance();
  const payload: SensitiveInfoSetRequest = {
    key,
    value,
    ...normalizeOptions(options),
  };
  return native.setItem(payload);
}

/**
 * Retrieve a previously stored secret. Pass `includeValue: false` to fetch metadata only.
 *
 * @example
 * ```ts
 * const token = await getItem('refreshToken', { service: 'com.example.session' })
 * ```
 */
export async function getItem(
  key: string,
  options?: SensitiveInfoOptions & { includeValue?: boolean }
): Promise<SensitiveInfoItem | null> {
  const native = getNativeInstance();
  const payload: SensitiveInfoGetRequest = {
    key,
    includeValue: options?.includeValue ?? true,
    ...normalizeOptions(options),
  };

  try {
    return await native.getItem(payload);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Determine whether a secret exists for the given key.
 *
 * @example
 * ```ts
 * const hasLegacyToken = await hasItem('legacyToken', { service: 'legacy' })
 * ```
 */
export async function hasItem(
  key: string,
  options?: SensitiveInfoOptions
): Promise<boolean> {
  const native = getNativeInstance();
  const payload: SensitiveInfoHasRequest = {
    key,
    ...normalizeOptions(options),
  };
  return native.hasItem(payload);
}

/**
 * Delete a stored secret.
 *
 * @example
 * ```ts
 * await deleteItem('refreshToken', { service: 'com.example.session' })
 * ```
 */
export async function deleteItem(
  key: string,
  options?: SensitiveInfoOptions
): Promise<boolean> {
  const native = getNativeInstance();
  const payload: SensitiveInfoDeleteRequest = {
    key,
    ...normalizeOptions(options),
  };
  return native.deleteItem(payload);
}

/**
 * Enumerate all secrets stored under a service. Values are omitted unless `includeValues` is set.
 *
 * @example
 * ```ts
 * const sessions = await getAllItems({ service: 'com.example.session', includeValues: true })
 * ```
 */
export async function getAllItems(
  options?: SensitiveInfoEnumerateRequest
): Promise<SensitiveInfoItem[]> {
  const native = getNativeInstance();
  const payload: SensitiveInfoEnumerateRequest = {
    includeValues: options?.includeValues ?? false,
    ...normalizeOptions(options),
  };
  return native.getAllItems(payload);
}

/**
 * Remove every secret associated with a service.
 *
 * @example
 * ```ts
 * await clearService({ service: 'com.example.session' })
 * ```
 */
export async function clearService(
  options?: SensitiveInfoOptions
): Promise<void> {
  const native = getNativeInstance();
  return native.clearService(normalizeOptions(options));
}

/**
 * Inspect which security primitives are available on the current device.
 *
 * @example
 * ```ts
 * const support = await getSupportedSecurityLevels()
 * ```
 */
export function getSupportedSecurityLevels(): Promise<SecurityAvailability> {
  const native = getNativeInstance();
  return native.getSupportedSecurityLevels();
}

/**
 * Convenient namespace exposing the secure storage surface area. Aids tree-shaking when consumers
 * destructure the API.
 */
export const SensitiveInfo: SensitiveInfoApi = {
  setItem,
  getItem,
  hasItem,
  deleteItem,
  getAllItems,
  clearService,
  getSupportedSecurityLevels,
};

export default SensitiveInfo;
