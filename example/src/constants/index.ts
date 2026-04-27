import type {
	AccessControl,
	AuthenticationPrompt,
	SensitiveInfoOptions,
} from 'react-native-sensitive-info'

export type ModeKey = 'open' | 'biometric'

export interface AccessMode {
	readonly key: ModeKey
	readonly label: string
	readonly accessControl: AccessControl
}

export const ACCESS_MODES: readonly AccessMode[] = [
	{ key: 'open', label: 'No lock', accessControl: 'none' },
	{ key: 'biometric', label: 'Biometric', accessControl: 'biometryCurrentSet' },
]

export const DEFAULT_SERVICE = 'demo-safe'
export const GITHUB_URL =
	'https://github.com/mcodex/react-native-sensitive-info'

export const BIOMETRIC_PROMPT: AuthenticationPrompt = {
	title: 'Unlock your secret',
	subtitle: 'Biometric authentication is required',
	description: 'This demo stores data behind your biometric enrollment.',
	cancel: 'Cancel',
}

/**
 * Read APIs (`getAllItems`, `hasItem`, `getKeyVersion`, …) never need an explicit
 * `accessControl` — the platform infers the policy from the stored attributes.
 * Passing it forces an extra `LAContext` allocation on iOS, which can trigger
 * spurious biometric prompts. So we keep two distinct option bags:
 *
 *   - `readOptions`  : service only.
 *   - `writeOptions` : full policy + prompt for `setItem` / `rotateKeys` / `getItem`.
 */
export interface ResolvedOptions {
	readonly readOptions: SensitiveInfoOptions
	readonly writeOptions: SensitiveInfoOptions
	readonly prompt?: AuthenticationPrompt
}

export const resolveOptions = (mode: ModeKey): ResolvedOptions => {
	const entry =
		ACCESS_MODES.find((candidate) => candidate.key === mode) ?? ACCESS_MODES[0]
	const isBiometric = entry.key === 'biometric'
	return {
		readOptions: { service: DEFAULT_SERVICE },
		writeOptions: {
			service: DEFAULT_SERVICE,
			accessControl: entry.accessControl,
			...(isBiometric ? { authenticationPrompt: BIOMETRIC_PROMPT } : {}),
		},
		prompt: isBiometric ? BIOMETRIC_PROMPT : undefined,
	}
}
