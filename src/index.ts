/**
 * # react-native-sensitive-info
 *
 * 🔐 React Native secure storage rebuilt on Nitro Modules — biometric-ready,
 * StrongBox-aware, and metadata-rich for modern mobile apps.
 *
 * @packageDocumentation
 *
 * ## Quick start
 *
 * ```ts
 * import { setItem, getItem } from 'react-native-sensitive-info'
 *
 * await setItem('session-token', 'abc123', {
 *   service: 'com.example.auth',
 *   accessControl: 'secureEnclaveBiometry',
 *   authenticationPrompt: { title: 'Unlock your session' },
 * })
 *
 * const item = await getItem('session-token', { service: 'com.example.auth' })
 * console.log(item?.value, item?.metadata.securityLevel)
 * ```
 *
 * ## Subpath exports
 *
 * The library is split into three side-effect-free entry points so apps only
 * pay for what they import:
 *
 * | Specifier                                  | Contents                                                      |
 * | ------------------------------------------ | ------------------------------------------------------------- |
 * | `react-native-sensitive-info`              | Imperative core (`setItem`, `getItem`, …) and types.          |
 * | `react-native-sensitive-info/hooks`        | React hooks (`useSecureStorage`, `useSecret`, `useKeyRotation`, …). |
 * | `react-native-sensitive-info/errors`       | Typed error classes and `instanceof`-friendly predicates.     |
 *
 * ## Defaults & gotchas
 *
 * - The default `service` is `'default'` — always set this explicitly per
 *   feature (e.g. `'com.example.auth'`) to avoid leaking secrets across
 *   modules.
 * - The default `accessControl` is **`'secureEnclaveBiometry'`** — reads on
 *   entries written with this policy will trigger a biometric prompt. Pass
 *   `accessControl: 'none'` for non-sensitive caches. Silent probes such as
 *   `hasItem`, metadata-only enumeration, and `getKeyVersion` ignore prompt
 *   fields on iOS; use `getItem` when the user explicitly unlocks a value.
 * - All errors thrown from this module are subclasses of {@link SensitiveInfoError}.
 *   Use `instanceof` or the `is*Error` predicates to branch safely.
 *
 * @see {@link setItem}
 * @see {@link useSecureStorage}
 * @see {@link SensitiveInfoError}
 */

export {
	canUseAccessControl,
	canUseAccessControlSync,
} from './core/access-control'
export {
	clearService,
	deleteItem,
	getAllItems,
	getItem,
	getKeyVersion,
	getSupportedSecurityLevels,
	hasItem,
	rotateKeys,
	SensitiveInfo,
	type SensitiveInfoApi,
	setItem,
} from './core/storage'
export {
	AuthenticationCanceledError,
	ErrorCode,
	type ErrorCodeValue,
	IntegrityViolationError,
	InvalidArgumentError,
	isAuthenticationCanceledError,
	isIntegrityViolationError,
	isInvalidArgumentError,
	isKeyInvalidatedError,
	isNotFoundError,
	isRotationFailedError,
	KeyInvalidatedError,
	NotFoundError,
	RotationFailedError,
	SensitiveInfoError,
} from './errors'
export type {
	AccessControl,
	AuthenticationPrompt,
	BiometryStatus,
	MutationResult,
	RotateKeysRequest,
	RotationResult,
	SecurityAvailability,
	SecurityLevel,
	SensitiveInfo as SensitiveInfoModule,
	SensitiveInfoDeleteRequest,
	SensitiveInfoEnumerateRequest,
	SensitiveInfoGetRequest,
	SensitiveInfoHasRequest,
	SensitiveInfoItem,
	SensitiveInfoOptions,
	SensitiveInfoSetRequest,
	SensitiveInfoSpec,
	StorageBackend,
	StorageMetadata,
} from './sensitive-info.nitro'
