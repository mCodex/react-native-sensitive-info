/**
 * Internal error helpers used by hook-side code paths. Public predicates and typed error classes
 * live in `src/errors.ts` (exposed via the `react-native-sensitive-info/errors` subpath); import
 * them from there directly.
 */

/**
 * Extracts a human-readable message from arbitrary error values.
 */
export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message
	if (typeof error === 'string') return error
	return 'An unknown error occurred'
}
