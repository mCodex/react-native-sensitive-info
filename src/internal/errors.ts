/**
 * Legacy re-export surface kept for backward compatibility. New code should import from
 * `react-native-sensitive-info/errors` (or `src/errors.ts`) directly so that typed classes and
 * predicates tree-shake cleanly.
 */

export {
	isAuthenticationCanceledError,
	isNotFoundError,
	toSensitiveInfoError,
} from '../errors'

/**
 * Extracts a human-readable message from arbitrary error values.
 */
export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message
	if (typeof error === 'string') return error
	return 'An unknown error occurred'
}
