import type {
	AccessControl,
	AuthenticationPrompt,
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

export const BIOMETRIC_PROMPT: AuthenticationPrompt = {
	title: 'Unlock your secret',
	subtitle: 'Biometric authentication is required',
	description: 'This demo stores data behind your biometric enrollment.',
	cancel: 'Cancel',
}
