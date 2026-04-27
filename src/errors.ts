/**
 * Typed error classes surfaced by the `react-native-sensitive-info` library.
 *
 * These are the canonical way to classify failures. String-based markers still work for backward
 * compatibility but are considered legacy.
 */

/** Stable discriminant codes emitted by the native layer. */
export const ErrorCode = {
	NotFound: 'E_NOT_FOUND',
	AuthenticationCanceled: 'E_AUTH_CANCELED',
	IntegrityViolation: 'E_INTEGRITY_VIOLATION',
	KeyInvalidated: 'E_KEY_INVALIDATED',
	RotationFailed: 'E_ROTATION_FAILED',
	Unknown: 'E_UNKNOWN',
} as const

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode]

/** Base class for every typed error thrown by the library. */
export class SensitiveInfoError extends Error {
	readonly code: ErrorCodeValue

	constructor(
		code: ErrorCodeValue,
		message: string,
		options?: { cause?: unknown }
	) {
		super(message, options)
		this.name = 'SensitiveInfoError'
		this.code = code
	}
}

/** The requested key does not exist in the secure store. */
export class NotFoundError extends SensitiveInfoError {
	constructor(message = 'Secret not found.', options?: { cause?: unknown }) {
		super(ErrorCode.NotFound, message, options)
		this.name = 'NotFoundError'
	}
}

/** The user dismissed the biometric / device-credential prompt. */
export class AuthenticationCanceledError extends SensitiveInfoError {
	constructor(
		message = 'Authentication prompt canceled by the user.',
		options?: { cause?: unknown }
	) {
		super(ErrorCode.AuthenticationCanceled, message, options)
		this.name = 'AuthenticationCanceledError'
	}
}

/**
 * HMAC verification of the stored metadata/ciphertext failed. This strongly suggests tampering at
 * rest and the affected entry should be treated as untrustworthy.
 */
export class IntegrityViolationError extends SensitiveInfoError {
	readonly key?: string
	constructor(
		message = 'Integrity check failed for stored secret.',
		options?: { cause?: unknown; key?: string }
	) {
		super(ErrorCode.IntegrityViolation, message, options)
		this.name = 'IntegrityViolationError'
		this.key = options?.key
	}
}

/**
 * The hardware-backed key tied to this entry was permanently invalidated (for example, because
 * biometrics were re-enrolled). The entry must be deleted and re-created.
 */
export class KeyInvalidatedError extends SensitiveInfoError {
	readonly alias?: string
	constructor(
		message = 'The hardware key backing this entry was permanently invalidated.',
		options?: { cause?: unknown; alias?: string }
	) {
		super(ErrorCode.KeyInvalidated, message, options)
		this.name = 'KeyInvalidatedError'
		this.alias = options?.alias
	}
}

/** `rotateKeys()` could not complete for the given service. */
export class RotationFailedError extends SensitiveInfoError {
	constructor(message = 'Key rotation failed.', options?: { cause?: unknown }) {
		super(ErrorCode.RotationFailed, message, options)
		this.name = 'RotationFailedError'
	}
}

// ---------------------------------------------------------------------------
// Adapters — bridge raw native errors (string markers + code fields) to typed
// classes. Kept pure so consumers can tree-shake these helpers.
// ---------------------------------------------------------------------------

const MARKER_TO_CODE: readonly [string, ErrorCodeValue][] = [
	['[E_NOT_FOUND]', ErrorCode.NotFound],
	['[E_AUTH_CANCELED]', ErrorCode.AuthenticationCanceled],
	['[E_INTEGRITY_VIOLATION]', ErrorCode.IntegrityViolation],
	['[E_KEY_INVALIDATED]', ErrorCode.KeyInvalidated],
	['[E_ROTATION_FAILED]', ErrorCode.RotationFailed],
]

const extractCode = (error: unknown): ErrorCodeValue | null => {
	if (error instanceof SensitiveInfoError) {
		return error.code
	}
	if (
		error != null &&
		typeof error === 'object' &&
		'code' in error &&
		typeof (error as { code: unknown }).code === 'string'
	) {
		const raw = (error as { code: string }).code
		const known = Object.values(ErrorCode).find((c) => c === raw)
		if (known) return known as ErrorCodeValue
	}
	const message =
		error instanceof Error
			? error.message
			: typeof error === 'string'
				? error
				: ''
	for (const [marker, code] of MARKER_TO_CODE) {
		if (message.includes(marker)) return code
	}
	return null
}

const extractMessage = (error: unknown, fallback: string): string => {
	if (error instanceof Error && error.message) return error.message
	if (typeof error === 'string' && error.length > 0) return error
	if (error !== null && typeof error === 'object' && 'message' in error) {
		const candidate = (error as { message?: unknown }).message
		if (typeof candidate === 'string' && candidate.length > 0) return candidate
	}
	return fallback
}

/**
 * Convert a raw native/unknown error into a typed {@link SensitiveInfoError} subclass.
 * Returns the original error untouched if it cannot be classified.
 */
export function toSensitiveInfoError(error: unknown): unknown {
	if (error instanceof SensitiveInfoError) return error
	const code = extractCode(error)
	if (code == null) return error
	const message = extractMessage(error, 'Secure storage error.')
	switch (code) {
		case ErrorCode.NotFound:
			return new NotFoundError(message, { cause: error })
		case ErrorCode.AuthenticationCanceled:
			return new AuthenticationCanceledError(message, { cause: error })
		case ErrorCode.IntegrityViolation:
			return new IntegrityViolationError(message, { cause: error })
		case ErrorCode.KeyInvalidated:
			return new KeyInvalidatedError(message, { cause: error })
		case ErrorCode.RotationFailed:
			return new RotationFailedError(message, { cause: error })
		default:
			return error
	}
}

/** Predicate helpers — prefer `instanceof` when you already have a typed error. */
export const isNotFoundError = (error: unknown): error is NotFoundError =>
	error instanceof NotFoundError || extractCode(error) === ErrorCode.NotFound

export const isAuthenticationCanceledError = (
	error: unknown
): error is AuthenticationCanceledError =>
	error instanceof AuthenticationCanceledError ||
	extractCode(error) === ErrorCode.AuthenticationCanceled

export const isIntegrityViolationError = (
	error: unknown
): error is IntegrityViolationError =>
	error instanceof IntegrityViolationError ||
	extractCode(error) === ErrorCode.IntegrityViolation

export const isKeyInvalidatedError = (
	error: unknown
): error is KeyInvalidatedError =>
	error instanceof KeyInvalidatedError ||
	extractCode(error) === ErrorCode.KeyInvalidated

export const isRotationFailedError = (
	error: unknown
): error is RotationFailedError =>
	error instanceof RotationFailedError ||
	extractCode(error) === ErrorCode.RotationFailed
