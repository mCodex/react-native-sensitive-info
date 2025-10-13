import { getHybridObjectConstructor } from 'react-native-nitro-modules'
import type {
  AccessControl,
  MutationResult,
  SecurityAvailability,
  SensitiveInfo as SensitiveInfoNativeHandle,
  SensitiveInfoDeleteRequest,
  SensitiveInfoEnumerateRequest,
  SensitiveInfoGetRequest,
  SensitiveInfoHasRequest,
  SensitiveInfoItem,
  SensitiveInfoOptions,
  SensitiveInfoSetRequest,
} from './views/sensitive-info.nitro'

const SensitiveInfoCtor = getHybridObjectConstructor<SensitiveInfoNativeHandle>(
  'SensitiveInfo'
)

let cachedInstance: SensitiveInfoNativeHandle | null = null

const DEFAULT_SERVICE = 'default'
const DEFAULT_ACCESS_CONTROL: AccessControl = 'secureEnclaveBiometry'

/**
 * Lazily instantiates the underlying Nitro hybrid object.
 * Nitro guarantees this object is shared across the app lifecycle, so we cache it on the JS side as well.
 */
function ensureInstance(): SensitiveInfoNativeHandle {
  if (cachedInstance == null) {
    cachedInstance = new SensitiveInfoCtor()
  }
  return cachedInstance
}

/**
 * Normalizes user provided options by applying sensible defaults and pruning `undefined` values.
 */
function resolveOptions(options?: SensitiveInfoOptions): SensitiveInfoOptions {
  if (options == null) {
    return {
      service: DEFAULT_SERVICE,
      accessControl: DEFAULT_ACCESS_CONTROL,
    }
  }
  return {
    service: options.service ?? DEFAULT_SERVICE,
    accessControl: options.accessControl ?? DEFAULT_ACCESS_CONTROL,
    iosSynchronizable: options.iosSynchronizable,
    keychainGroup: options.keychainGroup,
    androidBiometricsStrongOnly: options.androidBiometricsStrongOnly,
    authenticationPrompt: options.authenticationPrompt,
  }
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
  const native = ensureInstance()
  const payload: SensitiveInfoSetRequest = {
    key,
    value,
    ...resolveOptions(options),
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
  const native = ensureInstance()
  const payload: SensitiveInfoGetRequest = {
    key,
    includeValue: options?.includeValue ?? true,
    ...resolveOptions(options),
  }
  return native.getItem(payload)
}

/**
 * Determine whether a secret exists for the given key.
 */
export async function hasItem(
  key: string,
  options?: SensitiveInfoOptions
): Promise<boolean> {
  const native = ensureInstance()
  const payload: SensitiveInfoHasRequest = {
    key,
    ...resolveOptions(options),
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
  const native = ensureInstance()
  const payload: SensitiveInfoDeleteRequest = {
    key,
    ...resolveOptions(options),
  }
  return native.deleteItem(payload)
}

/**
 * Enumerate all secrets stored under a service. Values are omitted unless `includeValues` is set.
 */
export async function getAllItems(
  options?: SensitiveInfoEnumerateRequest
): Promise<SensitiveInfoItem[]> {
  const native = ensureInstance()
  const payload: SensitiveInfoEnumerateRequest = {
    includeValues: options?.includeValues ?? false,
    ...resolveOptions(options),
  }
  return native.getAllItems(payload)
}

/**
 * Remove every secret associated with a service.
 */
export async function clearService(options?: SensitiveInfoOptions): Promise<void> {
  const native = ensureInstance()
  return native.clearService(resolveOptions(options))
}

/**
 * Inspect which security primitives are available on the current device.
 */
export function getSupportedSecurityLevels(): Promise<SecurityAvailability> {
  const native = ensureInstance()
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

export type {
  AccessControl,
  MutationResult,
  SecurityAvailability,
  SensitiveInfoDeleteRequest,
  SensitiveInfoEnumerateRequest,
  SensitiveInfoGetRequest,
  SensitiveInfoHasRequest,
  SensitiveInfoItem,
  SensitiveInfoOptions,
  SensitiveInfoSetRequest,
} from './views/sensitive-info.nitro'
