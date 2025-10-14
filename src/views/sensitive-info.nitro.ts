import type { HybridObject } from 'react-native-nitro-modules'

/**
 * Enumerates the highest security tier that was effectively applied while storing a value.
 */
export type SecurityLevel =
  | 'secureEnclave'
  | 'strongBox'
  | 'biometry'
  | 'deviceCredential'
  | 'software'

/**
 * Enumerates the native storage backend used to persist sensitive data.
 */
export type StorageBackend =
  | 'keychain'
  | 'androidKeystore'
  | 'encryptedSharedPreferences'

/**
 * Enumerates the access-control policy enforced by the underlying secure storage.
 */
export type AccessControl =
  | 'secureEnclaveBiometry'
  | 'biometryCurrentSet'
  | 'biometryAny'
  | 'devicePasscode'
  | 'none'

/**
 * Configuration for the biometric/device credential prompt shown when a protected item is accessed.
 */
export interface AuthenticationPrompt {
  readonly title: string
  readonly subtitle?: string
  readonly description?: string
  readonly cancel?: string
}

/**
 * Options that influence how data is written or retrieved from the secure store.
 */
export interface SensitiveInfoOptions {
  /** Namespaces the stored entry. Defaults to the bundle identifier (when available) or `default`. */
  readonly service?: string
  /** iOS: Enable keychain item synchronization via iCloud. */
  readonly iosSynchronizable?: boolean
  /** iOS: Custom keychain access group. */
  readonly keychainGroup?: string
  /**
   * Desired access-control policy. The native implementation will automatically fall back to the
   * strongest supported policy for the current device (Secure Enclave ➝ Biometry ➝ Device Credential ➝ None).
   */
  readonly accessControl?: AccessControl
  /** Android: fine tune whether the hardware-authenticated key should require biometrics only. */
  readonly androidBiometricsStrongOnly?: boolean
  /** Optional prompt configuration that will be shown when protected keys require user presence. */
  readonly authenticationPrompt?: AuthenticationPrompt
}

export interface SensitiveInfoSetRequest extends SensitiveInfoOptions {
  readonly key: string
  readonly value: string
}

export interface SensitiveInfoGetRequest extends SensitiveInfoOptions {
  readonly key: string
  /** Include the encrypted value when available. Defaults to true. */
  readonly includeValue?: boolean
}

export interface SensitiveInfoDeleteRequest extends SensitiveInfoOptions {
  readonly key: string
}

export interface SensitiveInfoHasRequest extends SensitiveInfoOptions {
  readonly key: string
}

export interface SensitiveInfoEnumerateRequest extends SensitiveInfoOptions {
  /** When true, the stored value is returned for each item. Defaults to false. */
  readonly includeValues?: boolean
}

export interface StorageMetadata {
  readonly securityLevel: SecurityLevel
  readonly backend: StorageBackend
  readonly accessControl: AccessControl
  readonly timestamp: number
}

export interface SensitiveInfoItem {
  readonly key: string
  readonly service: string
  readonly value?: string
  readonly metadata: StorageMetadata
}

export interface MutationResult {
  readonly metadata: StorageMetadata
}

export interface SecurityAvailability {
  readonly secureEnclave: boolean
  readonly strongBox: boolean
  readonly biometry: boolean
  readonly deviceCredential: boolean
}

export interface SensitiveInfo
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  setItem(request: SensitiveInfoSetRequest): Promise<MutationResult>
  getItem(request: SensitiveInfoGetRequest): Promise<SensitiveInfoItem | null>
  deleteItem(request: SensitiveInfoDeleteRequest): Promise<boolean>
  hasItem(request: SensitiveInfoHasRequest): Promise<boolean>
  getAllItems(
    request?: SensitiveInfoEnumerateRequest
  ): Promise<SensitiveInfoItem[]>
  clearService(request?: SensitiveInfoOptions): Promise<void>
  getSupportedSecurityLevels(): Promise<SecurityAvailability>
}

export type SensitiveInfoSpec = SensitiveInfo
