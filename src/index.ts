/**
 * Root entry point — exposes the side-effect-free core storage API and type surface.
 *
 * React hooks live under `react-native-sensitive-info/hooks`.
 * Typed error classes live under `react-native-sensitive-info/errors`.
 */

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
	isAuthenticationCanceledError,
	isIntegrityViolationError,
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
