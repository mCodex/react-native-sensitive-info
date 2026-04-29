import type { HybridObject } from 'react-native-nitro-modules'

/**
 * Captures how strong the effective protection was when a value got persisted.
 *
 * The native layer continuously downgrades to the strongest policy supported by the device. A
 * policy requested as `secureEnclaveBiometry` may therefore resolve to `biometry` or even
 * `software` on simulators and low-end hardware.
 *
 * @see {@link StorageMetadata.securityLevel}
 */
export type SecurityLevel =
	/** Apple Secure Enclave or equivalent — keys never leave dedicated security hardware. */
	| 'secureEnclave'
	/** Android StrongBox-backed Keystore — tamper-resistant secure element. */
	| 'strongBox'
	/** Hardware-backed but gated by the user's enrolled biometric (Face/Touch ID, fingerprint). */
	| 'biometry'
	/** Hardware-backed but gated by the device passcode/PIN/pattern. */
	| 'deviceCredential'
	/** Software-only protection — used as a last-resort fallback (simulators, very old devices). */
	| 'software'

/**
 * Enumerates which native database held the encrypted record.
 *
 * @see {@link StorageMetadata.backend}
 */
export type StorageBackend =
	/** Apple Keychain Services (`kSecClassGenericPassword` items). */
	| 'keychain'
	/** Android Keystore-wrapped entry stored alongside metadata. */
	| 'androidKeystore'
	/** Android `EncryptedSharedPreferences` fallback when Keystore is unavailable. */
	| 'encryptedSharedPreferences'

/**
 * Access-control policy applied when persisting an entry.
 *
 * The native layer downgrades automatically to the strongest available policy on the host device,
 * so the requested value is the *desired ceiling* rather than a guaranteed level. Inspect
 * {@link StorageMetadata.accessControl} after writing to confirm what the platform actually
 * applied.
 *
 * @see {@link SensitiveInfoOptions.accessControl}
 */
export type AccessControl =
	/**
	 * Strongest policy: requires Secure Enclave / StrongBox **and** a current biometric. Reads
	 * trigger a biometric prompt on every access.
	 */
	| 'secureEnclaveBiometry'
	/**
	 * Requires the user's currently enrolled biometric set. Adding/removing a fingerprint or
	 * re-enrolling Face ID invalidates the entry, surfacing as {@link KeyInvalidatedError}.
	 */
	| 'biometryCurrentSet'
	/** Any enrolled biometric on the device — survives biometric re-enrollment. */
	| 'biometryAny'
	/** Device passcode/PIN/pattern only — no biometric prompt. */
	| 'devicePasscode'
	/** No user-presence requirement — entry is readable while the device is unlocked. */
	| 'none'

/**
 * Human-friendly strings that will be rendered on biometric/device credential prompts.
 *
 * Field rendering depends on the platform: iOS only honours `title` and `cancel` on Touch ID,
 * while Android's BiometricPrompt also displays `subtitle` and `description`.
 */
export interface AuthenticationPrompt {
	/** Title shown at the top of the prompt. Required on Android. */
	readonly title: string
	/** Optional subtitle (Android BiometricPrompt only). */
	readonly subtitle?: string
	/** Optional body text (Android BiometricPrompt only). */
	readonly description?: string
	/** Label for the cancel button. Defaults to the platform's localized cancel string. */
	readonly cancel?: string
}

/**
 * Tunables shared by both the read and write APIs.
 *
 * Pass the same `service` on read and write to scope your secrets to a logical namespace.
 * `accessControl` is a write policy; silent reads such as `hasItem`, metadata-only enumeration,
 * and `getKeyVersion` intentionally ignore prompt-bearing fields on iOS.
 *
 * @see {@link AccessControl}
 * @see {@link AuthenticationPrompt}
 */
export interface SensitiveInfoOptions {
	/**
	 * Namespaces the stored entry. Use a reverse-DNS string per feature (e.g. `'com.example.auth'`)
	 * to avoid colliding with other modules in the host app.
	 *
	 * @defaultValue The bundle identifier when available, otherwise `'default'`.
	 */
	readonly service?: string
	/** Apple platforms: enables Keychain sync through iCloud (`kSecAttrSynchronizable`). */
	readonly iosSynchronizable?: boolean
	/** Apple platforms: custom Keychain access group for sharing entries between apps. */
	readonly keychainGroup?: string
	/**
	 * Desired access-control policy. The native implementation automatically downgrades to the
	 * strongest supported strategy (Secure Enclave → Biometry → Device Credential → None).
	 *
	 * @defaultValue `'secureEnclaveBiometry'`
	 * @see {@link AccessControl}
	 */
	readonly accessControl?: AccessControl
	/**
	 * Prompt strings displayed when user presence is required to open the key. Use this for
	 * value reads/writes, not silent probes such as `hasItem` or metadata-only enumeration.
	 */
	readonly authenticationPrompt?: AuthenticationPrompt
}

/**
 * Payload for {@link SensitiveInfo.setItem}. Inherits all {@link SensitiveInfoOptions}.
 */
export interface SensitiveInfoSetRequest extends SensitiveInfoOptions {
	/** Key under which to store the entry. Must be non-empty and stable across writes. */
	readonly key: string
	/** UTF-8 string value to encrypt. For binary data, encode as base64 before passing. */
	readonly value: string
}

/**
 * Payload for {@link SensitiveInfo.getItem}. Inherits all {@link SensitiveInfoOptions}.
 */
export interface SensitiveInfoGetRequest extends SensitiveInfoOptions {
	/** Key to look up within the configured `service`. */
	readonly key: string
	/**
	 * Include the decrypted value on the returned item. Set to `false` to fetch metadata-only
	 * (cheaper, and on iOS avoids triggering the biometric prompt).
	 *
	 * @defaultValue `true`
	 */
	readonly includeValue?: boolean
}

/**
 * Payload for {@link SensitiveInfo.deleteItem}. Inherits all {@link SensitiveInfoOptions}.
 */
export interface SensitiveInfoDeleteRequest extends SensitiveInfoOptions {
	/** Key to delete within the configured `service`. */
	readonly key: string
}

/**
 * Payload for {@link SensitiveInfo.hasItem}. Inherits all {@link SensitiveInfoOptions}.
 */
export interface SensitiveInfoHasRequest extends SensitiveInfoOptions {
	/** Key to check for existence within the configured `service`. */
	readonly key: string
}

/**
 * Payload for {@link SensitiveInfo.getAllItems}. Inherits all {@link SensitiveInfoOptions}.
 */
export interface SensitiveInfoEnumerateRequest extends SensitiveInfoOptions {
	/**
	 * When `true`, the stored value is decrypted and returned for each item. Leave as `false` for
	 * cheap metadata listings (and to avoid biometric prompts when listing protected entries).
	 *
	 * @defaultValue `false`
	 */
	readonly includeValues?: boolean
}

/**
 * Request payload for {@link SensitiveInfo.rotateKeys}.
 */
export interface RotateKeysRequest extends SensitiveInfoOptions {
	/**
	 * When `true`, the library eagerly re-encrypts every existing entry with the new key version.
	 * When `false`, entries are re-encrypted lazily on next read/write.
	 *
	 * @remarks Eager rotation may trigger one biometric prompt **per protected entry**. Prefer the
	 * default lazy mode unless you have a compliance reason to migrate ciphertext immediately.
	 * @defaultValue `false`
	 */
	readonly reEncryptEagerly?: boolean
}

/**
 * Outcome of a {@link SensitiveInfo.rotateKeys} call.
 */
export interface RotationResult {
	/** Key version that was active before rotation. `0` for first-time rotation of legacy entries. */
	readonly previousVersion: number
	/** New active key version. Subsequent writes will be tagged with this version. */
	readonly newVersion: number
	/** Number of entries re-encrypted in the same call (>0 only when `reEncryptEagerly` is `true`). */
	readonly reEncryptedCount: number
}

/**
 * Metadata describing how an entry is protected at rest. Returned alongside every read result
 * and after every write.
 */
export interface StorageMetadata {
	/** Effective protection class applied by the native layer (may be downgraded from the request). */
	readonly securityLevel: SecurityLevel
	/** Native database that holds the encrypted record. */
	readonly backend: StorageBackend
	/** Access-control policy actually applied — compare with the requested {@link AccessControl}. */
	readonly accessControl: AccessControl
	/** Unix epoch (milliseconds) of the last successful write. */
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
	/** Key under which the entry was stored. */
	readonly key: string
	/** Service namespace the entry belongs to. */
	readonly service: string
	/** Decrypted value. Absent when the request opted out via `includeValue: false`. */
	readonly value?: string
	/** Storage metadata describing protection class, backend, and integrity. */
	readonly metadata: StorageMetadata
}

/**
 * Metadata snapshot returned by {@link SensitiveInfo.setItem}.
 */
export interface MutationResult {
	/** Metadata for the entry that was just written. */
	readonly metadata: StorageMetadata
}

/**
 * Fine-grained biometric availability state.
 *
 * Disambiguates the three UX-distinct outcomes a single boolean cannot express: "hardware is
 * missing", "hardware is present but the user has not enrolled a biometric", and "ready to use".
 * Drive feature toggles and onboarding CTAs off this field — for example, render a *"Set up
 * Face ID in Settings"* deep-link when the value is `'notEnrolled'` instead of hiding the toggle
 * entirely.
 *
 * String-literal union (no TypeScript `enum`) so comparisons narrow correctly, the values are
 * fully tree-shakable, and zero runtime objects are emitted.
 *
 * @see {@link SecurityAvailability.biometryStatus}
 * @see {@link SecurityAvailability.biometry}
 */
export type BiometryStatus =
	/** Hardware present, at least one biometric enrolled, currently usable. */
	| 'available'
	/**
	 * Hardware present but no fingerprint/face is registered. Surface a *"Set up Face ID / fingerprint"*
	 * CTA that deep-links to system settings instead of hiding the toggle.
	 */
	| 'notEnrolled'
	/**
	 * Biometric hardware is missing or permanently disabled (administrator policy, hardware fault,
	 * passcode not set on iOS). Hide the toggle entirely.
	 */
	| 'notAvailable'
	/**
	 * Too many recent failed attempts have temporarily locked biometrics. Render a *"Try again later"*
	 * affordance and consider falling back to `devicePasscode`.
	 *
	 * @remarks Currently surfaced from `LAError.biometryLockout` on iOS. On Android, transient lockout
	 * is reported via `BiometricPrompt` failure paths rather than {@link getSupportedSecurityLevels}.
	 */
	| 'lockedOut'
	/**
	 * The capability probe could not classify the device. Treat as `'notAvailable'` for gating
	 * purposes; the value exists to keep the union forward-compatible.
	 */
	| 'unknown'

/**
 * Snapshot of the secure hardware capabilities currently exposed to the runtime.
 *
 * Use this to drive feature toggles (e.g. show "Enable biometric unlock" only when `biometry` is
 * `true`) instead of attempting writes that will fail at runtime.
 */
export interface SecurityAvailability {
	/**
	 * A hardware-isolated key store is present and addressable. On iOS/macOS this maps to the
	 * Apple Secure Enclave; on Android it mirrors {@link strongBox} (true when StrongBox is
	 * available), so a single boolean lets cross-platform code gate "use hardware-backed keys"
	 * UX without branching on `Platform.OS`.
	 */
	readonly secureEnclave: boolean
	/** Android StrongBox is present. **Android only** — always `false` on iOS. */
	readonly strongBox: boolean
	/**
	 * Convenience boolean equal to `biometryStatus === 'available'`. Kept for backward
	 * compatibility — prefer {@link biometryStatus} for nuanced UX gating (e.g. distinguishing
	 * "not enrolled" from "no hardware").
	 */
	readonly biometry: boolean
	/**
	 * Detailed biometric availability state. See {@link BiometryStatus} for the per-value contract.
	 *
	 * @remarks Invariant: `biometry === (biometryStatus === 'available')`. Both fields are populated
	 * by the same native probe.
	 */
	readonly biometryStatus: BiometryStatus
	/** Device has a credential set (passcode/PIN/pattern). */
	readonly deviceCredential: boolean
}

/**
 * Native HybridObject contract implemented in Swift (iOS) and Kotlin (Android).
 *
 * Application code should normally import the wrapper functions from `react-native-sensitive-info`
 * instead of using this interface directly — the wrappers normalize options and surface typed
 * errors.
 */
export interface SensitiveInfo
	extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
	/** Encrypts and persists `request.value`. See {@link setItem} for the recommended wrapper. */
	setItem(request: SensitiveInfoSetRequest): Promise<MutationResult>
	/** Decrypts and returns the entry, or `null` when missing. See {@link getItem}. */
	getItem(request: SensitiveInfoGetRequest): Promise<SensitiveInfoItem | null>
	/** Deletes the entry. Resolves `true` on success, `false` when the entry was absent. See {@link deleteItem}. */
	deleteItem(request: SensitiveInfoDeleteRequest): Promise<boolean>
	/** Cheap existence check — does not decrypt. See {@link hasItem}. */
	hasItem(request: SensitiveInfoHasRequest): Promise<boolean>
	/** Enumerates entries in the service. See {@link getAllItems}. */
	getAllItems(
		request?: SensitiveInfoEnumerateRequest
	): Promise<SensitiveInfoItem[]>
	/** Removes every entry in the service namespace. See {@link clearService}. */
	clearService(request?: SensitiveInfoOptions): Promise<void>
	/** Reports the device's secure-hardware capabilities. See {@link getSupportedSecurityLevels}. */
	getSupportedSecurityLevels(): Promise<SecurityAvailability>
	/**
	 * Rotates the master key for the given service and returns the previous/new version. Existing
	 * entries are re-encrypted lazily on next access (default) or eagerly when requested.
	 *
	 * @see {@link rotateKeys}
	 */
	rotateKeys(request?: RotateKeysRequest): Promise<RotationResult>
	/** Returns the currently active key version for the given service. See {@link getKeyVersion}. */
	getKeyVersion(request?: SensitiveInfoOptions): Promise<number>
}

export type SensitiveInfoSpec = SensitiveInfo
