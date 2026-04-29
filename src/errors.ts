/**
 * # Typed errors
 *
 * Canonical error surface for `react-native-sensitive-info`. Every failure thrown by the library
 * is an instance of {@link SensitiveInfoError} or one of its subclasses, classified by a stable
 * {@link ErrorCode} discriminant.
 *
 * Use `instanceof` (preferred) or the `is*Error` predicates to branch in catch blocks. Legacy
 * string-marker matching (`error.message.includes('[E_NOT_FOUND]')`) is still supported via
 * {@link toSensitiveInfoError} but considered legacy.
 *
 * @packageDocumentation
 */

/**
 * Stable discriminant codes emitted by the native layer.
 *
 * @remarks
 * | Code                       | Meaning                                                              |
 * | -------------------------- | -------------------------------------------------------------------- |
 * | `E_NOT_FOUND`              | The requested key does not exist.                                    |
 * | `E_AUTH_CANCELED`          | User dismissed the biometric / device-credential prompt.             |
 * | `E_INTEGRITY_VIOLATION`    | HMAC verification failed — entry should be treated as tampered.      |
 * | `E_KEY_INVALIDATED`        | Hardware key was invalidated (e.g. biometric re-enrollment).         |
 * | `E_ROTATION_FAILED`        | `rotateKeys()` could not complete.                                   |
 * | `E_UNKNOWN`                | Catch-all for unclassified failures.                                 |
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

/**
 * Union of every value in {@link ErrorCode}. Use this to type variables that hold an error code.
 *
 * @see {@link ErrorCode}
 */
export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode]

/**
 * Base class for every typed error thrown by the library.
 *
 * All `is*Error` predicates and the `toSensitiveInfoError` adapter funnel into subclasses of this
 * type, so a single `instanceof SensitiveInfoError` check is sufficient to identify any failure
 * originating from secure storage.
 *
 * @example
 * ```ts
 * try {
 *   await getItem('session-token', { service: 'com.example.auth' })
 * } catch (e) {
 *   if (e instanceof SensitiveInfoError) console.log(e.code)
 * }
 * ```
 */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: intentional type-only `cause` augmentation via interface merging; see the `SensitiveInfoError` interface declaration below.
export class SensitiveInfoError extends Error {
	/** Stable discriminant identifying the failure mode. */
	readonly code: ErrorCodeValue

	/**
	 * @param code    - Stable {@link ErrorCodeValue} for the failure.
	 * @param message - Human-readable description.
	 * @param options - Optional `cause` for error chaining (see ECMAScript 2022 `Error` cause).
	 */
	constructor(
		code: ErrorCodeValue,
		message: string,
		options?: { cause?: unknown }
	) {
		super(message)
		this.name = 'SensitiveInfoError'
		this.code = code
		// Define `cause` manually instead of passing it to `super()` so this
		// compiles cleanly under TS configs whose `lib` predates ES2022 (where
		// the second `Error` constructor argument was introduced), while keeping
		// the property non-enumerable to match the native ES2022 `Error` constructor.
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

/**
 * Type-only declaration merge that exposes the optional `cause` property on
 * {@link SensitiveInfoError} for consumers compiling with a `tsconfig` `lib`
 * target that predates ES2022 (where `Error.cause` was added). Using interface
 * merging—rather than a `declare` class field—keeps the source fully erasable
 * by Babel/SWC and avoids emitting an enumerable own property.
 */
export interface SensitiveInfoError {
	readonly cause?: unknown
}

/**
 * The requested key does not exist in the secure store.
 *
 * Note: {@link getItem} swallows this error and returns `null` instead. You will only observe
 * `NotFoundError` directly when bypassing the wrapper or when implementing a custom layer atop
 * the native HybridObject.
 *
 * @example
 * ```ts
 * try { await native.getItem({ key: 'missing' }) }
 * catch (e) { if (isNotFoundError(e)) return null }
 * ```
 */
export class NotFoundError extends SensitiveInfoError {
	/**
	 * @param message - Defaults to `'Secret not found.'`.
	 * @param options - Optional `cause` for error chaining.
	 */
	constructor(message = 'Secret not found.', options?: { cause?: unknown }) {
		super(ErrorCode.NotFound, message, options)
		this.name = 'NotFoundError'
	}
}

/**
 * The user dismissed the biometric / device-credential prompt.
 *
 * @remarks Treat this as a normal user gesture rather than a bug — do not retry automatically;
 * surface a clear UI affordance for the user to re-attempt.
 *
 * @example
 * ```ts
 * try { await getItem('token', { service: 'auth' }) }
 * catch (e) { if (isAuthenticationCanceledError(e)) showUnlockButton() }
 * ```
 */
export class AuthenticationCanceledError extends SensitiveInfoError {
	/**
	 * @param message - Defaults to `'Authentication prompt canceled by the user.'`.
	 * @param options - Optional `cause` for error chaining.
	 */
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
 *
 * @remarks Recommended remediation: delete the affected entry, force the user to re-authenticate
 * with the upstream service, and report telemetry so you can detect device-level compromise.
 *
 * @example
 * ```ts
 * try { await getItem('token', { service: 'auth' }) }
 * catch (e) {
 *   if (isIntegrityViolationError(e)) {
 *     await deleteItem('token', { service: 'auth' })
 *     forceReauth()
 *   }
 * }
 * ```
 */
export class IntegrityViolationError extends SensitiveInfoError {
	/** Key whose ciphertext failed verification, when known. */
	readonly key?: string | undefined
	/**
	 * @param message - Defaults to `'Integrity check failed for stored secret.'`.
	 * @param options - `cause` for error chaining and `key` for the affected identifier.
	 */
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
 *
 * @remarks This is the expected error after a user adds/removes a fingerprint or re-enrolls Face
 * ID on entries written with `accessControl: 'biometryCurrentSet'` or `'secureEnclaveBiometry'`.
 *
 * @example
 * ```ts
 * try { await getItem('token', { service: 'auth' }) }
 * catch (e) {
 *   if (isKeyInvalidatedError(e)) {
 *     await deleteItem('token', { service: 'auth' })
 *     promptUserToSetUpAgain()
 *   }
 * }
 * ```
 */
export class KeyInvalidatedError extends SensitiveInfoError {
	/** Native keystore alias that was invalidated, when known. */
	readonly alias?: string | undefined
	/**
	 * @param message - Defaults to `'The hardware key backing this entry was permanently invalidated.'`.
	 * @param options - `cause` for error chaining and `alias` for the affected keystore entry.
	 */
	constructor(
		message = 'The hardware key backing this entry was permanently invalidated.',
		options?: { cause?: unknown; alias?: string }
	) {
		super(ErrorCode.KeyInvalidated, message, options)
		this.name = 'KeyInvalidatedError'
		this.alias = options?.alias
	}
}

/**
 * {@link rotateKeys} could not complete for the given service.
 *
 * @example
 * ```ts
 * try { await rotateKeys({ service: 'auth' }) }
 * catch (e) { if (isRotationFailedError(e)) reportTelemetry(e) }
 * ```
 */
export class RotationFailedError extends SensitiveInfoError {
	/**
	 * @param message - Defaults to `'Key rotation failed.'`.
	 * @param options - Optional `cause` for error chaining.
	 */
	constructor(message = 'Key rotation failed.', options?: { cause?: unknown }) {
		super(ErrorCode.RotationFailed, message, options)
		this.name = 'RotationFailedError'
	}
}

/**
 * Indicates that a TS-side input violated the library's contract — for example, an empty `key`,
 * a service name longer than the supported limit, or a value whose serialized size exceeds the
 * configured ceiling.
 *
 * @remarks
 * This error is raised **before** any native call is made, so no biometric prompt is shown and
 * no on-disk state is touched. Treat it as a programmer error and fix the call site.
 *
 * @example
 * ```ts
 * try { await setItem('', value, { service: 'auth' }) }
 * catch (e) { if (isInvalidArgumentError(e)) console.warn(e.argument, e.message) }
 * ```
 */
export class InvalidArgumentError extends SensitiveInfoError {
	/** Name of the argument that failed validation, when known (e.g. `'key'`, `'value'`). */
	readonly argument?: string | undefined
	/**
	 * @param message - Human-readable description of the violation.
	 * @param options - `cause` for error chaining and `argument` for the offending field name.
	 */
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
// Adapters — bridge raw native errors (string markers + code fields) to typed
// classes. Kept pure so consumers can tree-shake these helpers.
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
 * @param error - Anything caught from a native call — typically an `Error` with a `code` field or
 *   a legacy string-marker message such as `'[E_NOT_FOUND] missing key'`.
 * @returns The corresponding typed error subclass when classifiable, otherwise the original
 * error untouched (so consumers can decide how to handle unknown failures).
 *
 * @remarks Already-typed `SensitiveInfoError` instances are returned as-is. The legacy
 * string-marker path exists purely for back-compat with pre-typed-error releases; new code should
 * rely on `instanceof` against the exported subclasses.
 *
 * @example
 * ```ts
 * try { await native.setItem(req) }
 * catch (raw) {
 *   const e = toSensitiveInfoError(raw)
 *   if (e instanceof KeyInvalidatedError) await reset()
 *   else throw e
 * }
 * ```
 *
 * @see {@link SensitiveInfoError}
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

/**
 * Type guard that narrows `error` to {@link NotFoundError}.
 *
 * @param error - Anything thrown from a `react-native-sensitive-info` call.
 * @returns `true` when the error matches the {@link ErrorCode.NotFound} discriminant.
 *
 * @example
 * ```ts
 * try { await native.getItem({ key: 'missing' }) }
 * catch (e) { if (isNotFoundError(e)) return null; throw e }
 * ```
 *
 * @see {@link NotFoundError}
 */
export const isNotFoundError = (error: unknown): error is NotFoundError =>
	error instanceof NotFoundError || extractCode(error) === ErrorCode.NotFound

/**
 * Type guard that narrows `error` to {@link AuthenticationCanceledError}.
 *
 * @param error - Anything thrown from a `react-native-sensitive-info` call.
 * @returns `true` when the user dismissed the biometric / device-credential prompt.
 *
 * @example
 * ```ts
 * try { await getItem('token', { service: 'auth' }) }
 * catch (e) { if (isAuthenticationCanceledError(e)) showRetry(); else throw e }
 * ```
 *
 * @see {@link AuthenticationCanceledError}
 */
export const isAuthenticationCanceledError = (
	error: unknown
): error is AuthenticationCanceledError =>
	error instanceof AuthenticationCanceledError ||
	extractCode(error) === ErrorCode.AuthenticationCanceled

/**
 * Type guard that narrows `error` to {@link IntegrityViolationError}.
 *
 * @param error - Anything thrown from a `react-native-sensitive-info` call.
 * @returns `true` when HMAC verification failed for the stored ciphertext.
 *
 * @example
 * ```ts
 * try { await getItem('token', { service: 'auth' }) }
 * catch (e) {
 *   if (isIntegrityViolationError(e)) await deleteItem('token', { service: 'auth' })
 *   else throw e
 * }
 * ```
 *
 * @see {@link IntegrityViolationError}
 */
export const isIntegrityViolationError = (
	error: unknown
): error is IntegrityViolationError =>
	error instanceof IntegrityViolationError ||
	extractCode(error) === ErrorCode.IntegrityViolation

/**
 * Type guard that narrows `error` to {@link KeyInvalidatedError}.
 *
 * @param error - Anything thrown from a `react-native-sensitive-info` call.
 * @returns `true` when the hardware key backing the entry was invalidated (e.g. biometric
 * re-enrollment).
 *
 * @example
 * ```ts
 * try { await getItem('token', { service: 'auth' }) }
 * catch (e) {
 *   if (isKeyInvalidatedError(e)) await deleteItem('token', { service: 'auth' })
 *   else throw e
 * }
 * ```
 *
 * @see {@link KeyInvalidatedError}
 */
export const isKeyInvalidatedError = (
	error: unknown
): error is KeyInvalidatedError =>
	error instanceof KeyInvalidatedError ||
	extractCode(error) === ErrorCode.KeyInvalidated

/**
 * Type guard that narrows `error` to {@link RotationFailedError}.
 *
 * @param error - Anything thrown from a `react-native-sensitive-info` call.
 * @returns `true` when {@link rotateKeys} could not complete.
 *
 * @example
 * ```ts
 * try { await rotateKeys({ service: 'auth' }) }
 * catch (e) { if (isRotationFailedError(e)) report(e); else throw e }
 * ```
 *
 * @see {@link RotationFailedError}
 */
export const isRotationFailedError = (
	error: unknown
): error is RotationFailedError =>
	error instanceof RotationFailedError ||
	extractCode(error) === ErrorCode.RotationFailed

/**
 * Type guard that narrows `error` to {@link InvalidArgumentError}.
 *
 * @param error - Anything thrown from a `react-native-sensitive-info` call.
 * @returns `true` when a TS-side input violated the library's contract.
 *
 * @example
 * ```ts
 * try { await setItem('', value, { service: 'auth' }) }
 * catch (e) { if (isInvalidArgumentError(e)) showFormError(e.argument) }
 * ```
 *
 * @see {@link InvalidArgumentError}
 */
export const isInvalidArgumentError = (
	error: unknown
): error is InvalidArgumentError =>
	error instanceof InvalidArgumentError ||
	extractCode(error) === ErrorCode.InvalidArgument
