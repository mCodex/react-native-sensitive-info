import type { HybridObject } from 'react-native-nitro-modules'

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
	| 'software'

/**
 * Enumerates which native database held the encrypted record.
 */
export type StorageBackend =
	| 'keychain'
	| 'androidKeystore'
	| 'encryptedSharedPreferences'

/** @see SensitiveInfoOptions.accessControl */
export type AccessControl =
	| 'secureEnclaveBiometry'
	| 'biometryCurrentSet'
	| 'biometryAny'
	| 'devicePasscode'
	| 'none'

/**
 * Human-friendly strings that will be rendered on biometric/device credential prompts.
 */
export interface AuthenticationPrompt {
	readonly title: string
	readonly subtitle?: string
	readonly description?: string
	readonly cancel?: string
}

/**
 * Tunables shared by both the read and write APIs.
 */
export interface SensitiveInfoOptions {
	/** Namespaces the stored entry. Defaults to the bundle identifier (when available) or `default`. */
	readonly service?: string
	/** Apple platforms: Enables Keychain sync through iCloud. */
	readonly iosSynchronizable?: boolean
	/** Apple platforms: Custom Keychain access group. */
	readonly keychainGroup?: string
	/**
	 * Desired access-control policy. The native implementation automatically downgrades to the
	 * strongest supported strategy (Secure Enclave ➝ Biometry ➝ Device Credential ➝ None).
	 */
	readonly accessControl?: AccessControl
	/** Optional prompt strings displayed when user presence is required to open the key. */
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

/**
 * Request payload for {@link SensitiveInfo.rotateKeys}.
 */
export interface RotateKeysRequest extends SensitiveInfoOptions {
	/**
	 * When true, the library eagerly re-encrypts every existing entry with the new key version.
	 * When false (default), entries are re-encrypted lazily on next read/write.
	 * Note: eager rotation may trigger biometric prompts for auth-gated entries.
	 */
	readonly reEncryptEagerly?: boolean
}

/**
 * Outcome of a {@link SensitiveInfo.rotateKeys} call.
 */
export interface RotationResult {
	readonly previousVersion: number
	readonly newVersion: number
	/** Number of entries re-encrypted in the same call (>0 only when `reEncryptEagerly` is true). */
	readonly reEncryptedCount: number
}

export interface StorageMetadata {
	readonly securityLevel: SecurityLevel
	readonly backend: StorageBackend
	readonly accessControl: AccessControl
	readonly timestamp: number
	/**
	 * Monotonically increasing version of the master key that produced the stored ciphertext.
	 * Absent values are treated as `0` (legacy entries) and opportunistically upgraded on read.
	 */
	readonly keyVersion?: number
	/**
	 * Base64 HMAC-SHA256 signature over the metadata + ciphertext, produced with a subkey
	 * derived from the master key. Used to detect tampering at rest.
	 */
	readonly integrityTag?: string
}

/**
 * Envelope returned by the read APIs.
 */
export interface SensitiveInfoItem {
	readonly key: string
	readonly service: string
	readonly value?: string
	readonly metadata: StorageMetadata
}

/**
 * Metadata snapshot returned by `setItem`.
 */
export interface MutationResult {
	readonly metadata: StorageMetadata
}

/**
 * Snapshot of the secure hardware capabilities currently exposed to the runtime.
 */
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
	/**
	 * Rotates the master key for the given service and returns the previous/new version. Existing
	 * entries are re-encrypted lazily on next access (default) or eagerly when requested.
	 */
	rotateKeys(request?: RotateKeysRequest): Promise<RotationResult>
	/** Returns the currently active key version for the given service. */
	getKeyVersion(request?: SensitiveInfoOptions): Promise<number>
}

export type SensitiveInfoSpec = SensitiveInfo
