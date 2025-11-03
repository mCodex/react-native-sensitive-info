import type { HybridObject } from 'react-native-nitro-modules';

/**
 * Captures how strong the effective protection was when a value got persisted.
 *
 * The native layer continuously downgrades to the strongest policy supported by the device. A
 * policy requested as `secureEnclaveBiometry` may therefore resolve to `biometry` or even
 * `software` on simulators and low-end hardware.
 */
export type SecurityLevel =
  | 'secureEnclave'
  | 'strongBox'
  | 'biometry'
  | 'deviceCredential'
  | 'software';

/**
 * Enumerates which native database held the encrypted record. This is useful for auditing mixed
 * environments (for example, Android devices that fall back to `encryptedSharedPreferences`).
 */
export type StorageBackend =
  | 'keychain'
  | 'androidKeystore'
  | 'encryptedSharedPreferences';

/** @see SensitiveInfoOptions.accessControl */
export type AccessControl =
  | 'secureEnclaveBiometry'
  | 'biometryCurrentSet'
  | 'biometryAny'
  | 'devicePasscode'
  | 'none';

/**
 * Human-friendly strings that will be rendered on biometric/device credential prompts.
 *
 * ```ts
 * await SensitiveInfo.getItem('pin', {
 *   authenticationPrompt: {
 *     title: 'Unlock Secure Notes',
 *     description: 'Authenticate to decrypt your note',
 *     cancel: 'Use another key',
 *   },
 * })
 * ```
 */
export interface AuthenticationPrompt {
  readonly title: string;
  readonly subtitle?: string;
  readonly description?: string;
  readonly cancel?: string;
}

/**
 * Tunables shared by both the read and write APIs.
 *
 * `iosSynchronizable`, `keychainGroup`, and the access-control options apply to every Apple
 * platform (iOS, macOS, visionOS, watchOS) even if the field name still mentions iOS for
 * backwards compatibility. On Android, strong (Class 3) biometrics are enforced automatically
 * whenever the hardware supports them, gracefully falling back to the strongest available guard.
 */
export interface SensitiveInfoOptions {
  /** Namespaces the stored entry. Defaults to the bundle identifier (when available) or `default`. */
  readonly service?: string;
  /** Apple platforms: Enables Keychain sync through iCloud. */
  readonly iosSynchronizable?: boolean;
  /** Apple platforms: Custom Keychain access group. */
  readonly keychainGroup?: string;
  /**
   * Desired access-control policy. The native implementation automatically downgrades to the
   * strongest supported strategy (Secure Enclave ➝ Biometry ➝ Device Credential ➝ None).
   */
  readonly accessControl?: AccessControl;
  /** Optional prompt strings displayed when user presence is required to open the key. */
  readonly authenticationPrompt?: AuthenticationPrompt;
}

export interface SensitiveInfoSetRequest extends SensitiveInfoOptions {
  readonly key: string;
  readonly value: string;
}

export interface SensitiveInfoGetRequest extends SensitiveInfoOptions {
  readonly key: string;
  /** Include the encrypted value when available. Defaults to true. */
  readonly includeValue?: boolean;
}

export interface SensitiveInfoDeleteRequest extends SensitiveInfoOptions {
  readonly key: string;
}

export interface SensitiveInfoHasRequest extends SensitiveInfoOptions {
  readonly key: string;
}

export interface SensitiveInfoEnumerateRequest extends SensitiveInfoOptions {
  /** When true, the stored value is returned for each item. Defaults to false. */
  readonly includeValues?: boolean;
}

export interface StorageMetadata {
  readonly securityLevel: SecurityLevel;
  readonly backend: StorageBackend;
  readonly accessControl: AccessControl;
  readonly timestamp: number;
}

/**
 * Envelope returned by the read APIs. `value` is omitted when the consumer opted out of
 * decryption or when the key is still hardware-gated (for example, prior to biometric verification).
 */
export interface SensitiveInfoItem {
  readonly key: string;
  readonly service: string;
  readonly value?: string;
  readonly metadata: StorageMetadata;
}

/**
 * Metadata snapshot returned by `setItem`, allowing clients to audit which security tier ended up
 * protecting the freshly written entry.
 */
export interface MutationResult {
  readonly metadata: StorageMetadata;
}

/**
 * Snapshot of the secure hardware capabilities currently exposed to the runtime. On Apple
 * platforms `secureEnclave` mirrors the device's Secure Enclave availability; on Android it maps to
 * StrongBox support. This mirrors the format returned by `getSupportedSecurityLevels()`.
 */
export interface SecurityAvailability {
  readonly secureEnclave: boolean;
  readonly strongBox: boolean;
  readonly biometry: boolean;
  readonly deviceCredential: boolean;
}

export interface SensitiveInfo
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  setItem(request: SensitiveInfoSetRequest): Promise<MutationResult>;
  getItem(request: SensitiveInfoGetRequest): Promise<SensitiveInfoItem | null>;
  deleteItem(request: SensitiveInfoDeleteRequest): Promise<boolean>;
  hasItem(request: SensitiveInfoHasRequest): Promise<boolean>;
  getAllItems(
    request?: SensitiveInfoEnumerateRequest
  ): Promise<SensitiveInfoItem[]>;
  clearService(request?: SensitiveInfoOptions): Promise<void>;
  getSupportedSecurityLevels(): Promise<SecurityAvailability>;
}

export type SensitiveInfoSpec = SensitiveInfo;
