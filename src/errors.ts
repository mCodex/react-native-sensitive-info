/**
 * Stable discriminant codes emitted by the native layer.
 */
export const ErrorCode = {
	NotFound: 'E_NOT_FOUND',
	AuthenticationCanceled: 'E_AUTH_CANCELED',
	IntegrityViolation: 'E_INTEGRITY_VIOLATION',
	KeyInvalidated: 'E_KEY_INVALIDATED',
	RotationFailed: 'E_ROTATION_FAILED',
	InvalidArgument: 'E_INVALID_ARGUMENT',
	Unknown: 'E_UNKNOWN',
} as const

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode]

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: intentional type-only `cause` augmentation via interface merging
export class SensitiveInfoError extends Error {
	readonly code: ErrorCodeValue

	constructor(
		code: ErrorCodeValue,
		message: string,
		options?: { cause?: unknown }
	) {
		super(message)
		this.name = 'SensitiveInfoError'
		this.code = code
		if (options && 'cause' in options) {
			Object.defineProperty(this, 'cause', {
				value: options.cause,
				writable: true,
				configurable: true,
				enumerable: false,
			})
		}
	}
}

export interface SensitiveInfoError {
	readonly cause?: unknown
}

export class NotFoundError extends SensitiveInfoError {
	constructor(message = 'Secret not found.', options?: { cause?: unknown }) {
		super(ErrorCode.NotFound, message, options)
		this.name = 'NotFoundError'
	}
}

export class AuthenticationCanceledError extends SensitiveInfoError {
	constructor(
		message = 'Authentication prompt canceled by the user.',
		options?: { cause?: unknown }
	) {
		super(ErrorCode.AuthenticationCanceled, message, options)
		this.name = 'AuthenticationCanceledError'
	}
}

export class IntegrityViolationError extends SensitiveInfoError {
	readonly key?: string | undefined
	constructor(
		message = 'Integrity check failed for stored secret.',
		options?: { cause?: unknown; key?: string }
	) {
		super(ErrorCode.IntegrityViolation, message, options)
		this.name = 'IntegrityViolationError'
		this.key = options?.key
	}
}

export class KeyInvalidatedError extends SensitiveInfoError {
	readonly alias?: string | undefined
	constructor(
		message = 'The hardware key backing this entry was permanently invalidated.',
		options?: { cause?: unknown; alias?: string }
	) {
		super(ErrorCode.KeyInvalidated, message, options)
		this.name = 'KeyInvalidatedError'
		this.alias = options?.alias
	}
}

export class RotationFailedError extends SensitiveInfoError {
	constructor(message = 'Key rotation failed.', options?: { cause?: unknown }) {
		super(ErrorCode.RotationFailed, message, options)
		this.name = 'RotationFailedError'
	}
}

export class InvalidArgumentError extends SensitiveInfoError {
	readonly argument?: string | undefined
	constructor(
		message = 'Invalid argument supplied to secure storage.',
		options?: { cause?: unknown; argument?: string }
	) {
		super(ErrorCode.InvalidArgument, message, options)
		this.name = 'InvalidArgumentError'
		this.argument = options?.argument
	}
}

// ---------------------------------------------------------------------------
// Adapters — bridge raw native errors to typed classes.
// ---------------------------------------------------------------------------

const MARKER_TO_CODE: readonly [string, ErrorCodeValue][] = [
	['[E_NOT_FOUND]', ErrorCode.NotFound],
	['[E_AUTH_CANCELED]', ErrorCode.AuthenticationCanceled],
	['[E_INTEGRITY_VIOLATION]', ErrorCode.IntegrityViolation],
	['[E_KEY_INVALIDATED]', ErrorCode.KeyInvalidated],
	['[E_ROTATION_FAILED]', ErrorCode.RotationFailed],
	['[E_INVALID_ARGUMENT]', ErrorCode.InvalidArgument],
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
 *
 * Already-typed `SensitiveInfoError` instances are returned as-is. The legacy
 * string-marker path exists for back-compat with pre-typed-error releases.
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
		case ErrorCode.InvalidArgument:
			return new InvalidArgumentError(message, { cause: error })
		default:
			return error
	}
}

// ---------------------------------------------------------------------------
// Type guards — one factory replaces seven identical predicates.
// ---------------------------------------------------------------------------

function makeErrorPredicate<T extends SensitiveInfoError>(
	// biome-ignore lint/suspicious/noExplicitAny: constructor typing
	cls: new (...args: any[]) => T,
	code: ErrorCodeValue
): (error: unknown) => error is T {
	return (error: unknown): error is T =>
		error instanceof cls || extractCode(error) === code
}

export const isNotFoundError = makeErrorPredicate(
	NotFoundError,
	ErrorCode.NotFound
)
export const isAuthenticationCanceledError = makeErrorPredicate(
	AuthenticationCanceledError,
	ErrorCode.AuthenticationCanceled
)
export const isIntegrityViolationError = makeErrorPredicate(
	IntegrityViolationError,
	ErrorCode.IntegrityViolation
)
export const isKeyInvalidatedError = makeErrorPredicate(
	KeyInvalidatedError,
	ErrorCode.KeyInvalidated
)
export const isRotationFailedError = makeErrorPredicate(
	RotationFailedError,
	ErrorCode.RotationFailed
)
export const isInvalidArgumentError = makeErrorPredicate(
	InvalidArgumentError,
	ErrorCode.InvalidArgument
)
