import {
	AuthenticationCanceledError,
	ErrorCode,
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
	toSensitiveInfoError,
} from '../errors'

describe('errors', () => {
	describe('typed error classes', () => {
		it.each([
			['NotFoundError', new NotFoundError('x'), ErrorCode.NotFound],
			[
				'AuthenticationCanceledError',
				new AuthenticationCanceledError('x'),
				ErrorCode.AuthenticationCanceled,
			],
			[
				'IntegrityViolationError',
				new IntegrityViolationError('x'),
				ErrorCode.IntegrityViolation,
			],
			[
				'KeyInvalidatedError',
				new KeyInvalidatedError('x'),
				ErrorCode.KeyInvalidated,
			],
			[
				'RotationFailedError',
				new RotationFailedError('x'),
				ErrorCode.RotationFailed,
			],
		])('%s carries the expected code', (_name, err, code) => {
			expect(err).toBeInstanceOf(SensitiveInfoError)
			expect(err.code).toBe(code)
			expect(err.message).toBe('x')
		})

		it('uses default messages when none provided', () => {
			expect(new NotFoundError().message).toMatch(/not found/i)
			expect(new AuthenticationCanceledError().message).toMatch(/cancel/i)
			expect(new IntegrityViolationError().message).toMatch(/integrity/i)
			expect(new KeyInvalidatedError().message).toMatch(/hardware/i)
			expect(new RotationFailedError().message).toMatch(/rotation/i)
		})

		it('captures the key on IntegrityViolationError', () => {
			const err = new IntegrityViolationError('tampered', { key: 'tok' })
			expect(err.key).toBe('tok')
		})

		it('captures the alias on KeyInvalidatedError', () => {
			const err = new KeyInvalidatedError('invalid', { alias: 'rnsi.svc.v1' })
			expect(err.alias).toBe('rnsi.svc.v1')
		})

		describe('cause chaining', () => {
			it('retains the provided cause on SensitiveInfoError', () => {
				const cause = new Error('underlying')
				const err = new SensitiveInfoError(ErrorCode.NotFound, 'wrapped', {
					cause,
				})
				expect(err.cause).toBe(cause)
			})

			it('keeps cause non-enumerable to match native ES2022 Error semantics', () => {
				const cause = new Error('underlying')
				const err = new SensitiveInfoError(ErrorCode.NotFound, 'wrapped', {
					cause,
				})
				const descriptor = Object.getOwnPropertyDescriptor(err, 'cause')
				expect(descriptor).toBeDefined()
				expect(descriptor?.enumerable).toBe(false)
				expect(Object.keys(err)).not.toContain('cause')
				expect(JSON.parse(JSON.stringify(err))).not.toHaveProperty('cause')
			})

			it('does not define cause when not provided', () => {
				const err = new SensitiveInfoError(ErrorCode.NotFound, 'wrapped')
				expect(Object.hasOwn(err, 'cause')).toBe(false)
			})

			it('defines a non-enumerable own cause when explicitly passed as undefined', () => {
				const err = new SensitiveInfoError(ErrorCode.NotFound, 'wrapped', {
					cause: undefined,
				})
				const descriptor = Object.getOwnPropertyDescriptor(err, 'cause')
				expect(Object.hasOwn(err, 'cause')).toBe(true)
				expect(err.cause).toBeUndefined()
				expect(descriptor).toBeDefined()
				expect(descriptor?.enumerable).toBe(false)
				expect(Object.keys(err)).not.toContain('cause')
			})

			it('propagates cause through subclasses (NotFoundError)', () => {
				const cause = new Error('native miss')
				const err = new NotFoundError('missing', { cause })
				expect(err.cause).toBe(cause)
			})
		})
	})

	describe('toSensitiveInfoError', () => {
		it('returns the same instance when already typed', () => {
			const err = new NotFoundError()
			expect(toSensitiveInfoError(err)).toBe(err)
		})

		it('classifies by marker in Error.message', () => {
			const raw = new Error('something [E_NOT_FOUND] bad')
			const converted = toSensitiveInfoError(raw)
			expect(converted).toBeInstanceOf(NotFoundError)
		})

		it('classifies by code field on objects', () => {
			const raw = { code: 'E_INTEGRITY_VIOLATION', message: 'oops' }
			const converted = toSensitiveInfoError(raw)
			expect(converted).toBeInstanceOf(IntegrityViolationError)
		})

		it.each([
			['[E_AUTH_CANCELED]', AuthenticationCanceledError],
			['[E_INTEGRITY_VIOLATION]', IntegrityViolationError],
			['[E_KEY_INVALIDATED]', KeyInvalidatedError],
			['[E_ROTATION_FAILED]', RotationFailedError],
		])('converts marker %s', (marker, ctor) => {
			const raw = new Error(`${marker} native text`)
			const converted = toSensitiveInfoError(raw)
			expect(converted).toBeInstanceOf(ctor)
		})

		it('returns the original error when it cannot be classified', () => {
			const raw = new Error('unrelated')
			expect(toSensitiveInfoError(raw)).toBe(raw)
		})

		it('handles string errors', () => {
			expect(toSensitiveInfoError('[E_NOT_FOUND] missing')).toBeInstanceOf(
				NotFoundError
			)
			expect(toSensitiveInfoError('random')).toBe('random')
		})

		it('handles null/undefined', () => {
			expect(toSensitiveInfoError(null)).toBeNull()
			expect(toSensitiveInfoError(undefined)).toBeUndefined()
		})
	})

	describe('predicates', () => {
		it('recognises typed instances', () => {
			expect(isNotFoundError(new NotFoundError())).toBe(true)
			expect(
				isAuthenticationCanceledError(new AuthenticationCanceledError())
			).toBe(true)
			expect(isIntegrityViolationError(new IntegrityViolationError())).toBe(
				true
			)
			expect(isKeyInvalidatedError(new KeyInvalidatedError())).toBe(true)
			expect(isRotationFailedError(new RotationFailedError())).toBe(true)
		})

		it('recognises errors by marker', () => {
			expect(isNotFoundError(new Error('[E_NOT_FOUND]'))).toBe(true)
			expect(
				isAuthenticationCanceledError(new Error('[E_AUTH_CANCELED]'))
			).toBe(true)
			expect(
				isIntegrityViolationError(new Error('[E_INTEGRITY_VIOLATION]'))
			).toBe(true)
			expect(isKeyInvalidatedError(new Error('[E_KEY_INVALIDATED]'))).toBe(true)
			expect(isRotationFailedError(new Error('[E_ROTATION_FAILED]'))).toBe(true)
		})

		it('returns false for unrelated errors', () => {
			const other = new Error('random')
			expect(isNotFoundError(other)).toBe(false)
			expect(isAuthenticationCanceledError(other)).toBe(false)
			expect(isIntegrityViolationError(other)).toBe(false)
			expect(isKeyInvalidatedError(other)).toBe(false)
			expect(isRotationFailedError(other)).toBe(false)
		})
	})
})
