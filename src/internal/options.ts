import type {
	AccessControl,
	AuthenticationPrompt,
	SensitiveInfoOptions,
} from '../sensitive-info.nitro'

export const DEFAULT_SERVICE = 'default'
export const DEFAULT_ACCESS_CONTROL: AccessControl = 'secureEnclaveBiometry'

/**
 * Normalises user supplied options by applying defaults and pruning `undefined` fields.
 *
 * Keeping the shape deterministic reduces marshalling work on the native side and makes
 * memoisation on hot paths cheap (stable JSON fingerprints).
 */
export function normalizeOptions(
	options?: SensitiveInfoOptions
): SensitiveInfoOptions {
	if (options == null) {
		return {
			service: DEFAULT_SERVICE,
			accessControl: DEFAULT_ACCESS_CONTROL,
		}
	}

	const normalized: Record<string, unknown> = {
		service: options.service ?? DEFAULT_SERVICE,
		accessControl: options.accessControl ?? DEFAULT_ACCESS_CONTROL,
	}

	if (options.iosSynchronizable !== undefined) {
		normalized.iosSynchronizable = options.iosSynchronizable
	}
	if (options.keychainGroup !== undefined) {
		normalized.keychainGroup = options.keychainGroup
	}
	if (options.authenticationPrompt !== undefined) {
		normalized.authenticationPrompt = options.authenticationPrompt
	}

	return normalized as SensitiveInfoOptions
}

export function normalizeStorageScopeOptions(
	options?: SensitiveInfoOptions
): SensitiveInfoOptions {
	const normalized: Record<string, unknown> = {
		service: options?.service ?? DEFAULT_SERVICE,
	}

	if (options?.iosSynchronizable !== undefined) {
		normalized.iosSynchronizable = options.iosSynchronizable
	}
	if (options?.keychainGroup !== undefined) {
		normalized.keychainGroup = options.keychainGroup
	}

	return normalized as SensitiveInfoOptions
}

export function normalizePromptedReadOptions(
	options?: SensitiveInfoOptions
): SensitiveInfoOptions {
	const normalized = normalizeStorageScopeOptions(options) as Record<
		string,
		unknown
	>

	if (options?.authenticationPrompt !== undefined) {
		normalized.authenticationPrompt =
			options.authenticationPrompt as AuthenticationPrompt
	}

	return normalized as SensitiveInfoOptions
}
