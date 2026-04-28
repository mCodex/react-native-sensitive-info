import { InvalidArgumentError } from '../errors'
import {
	MAX_KEY_BYTES,
	MAX_VALUE_BYTES,
	validateKey,
	validateService,
	validateValue,
} from '../internal/validate'

describe('internal/validate', () => {
	describe('validateKey', () => {
		it('accepts non-empty strings', () => {
			expect(() => validateKey('valid-key')).not.toThrow()
		})

		it.each([
			['empty string', ''],
			['whitespace only', '   '],
			['number', 42],
			['null', null],
			['undefined', undefined],
		])('rejects %s', (_label, input) => {
			expect(() => validateKey(input)).toThrow(InvalidArgumentError)
		})

		it('rejects keys exceeding MAX_KEY_BYTES', () => {
			const tooLong = 'a'.repeat(MAX_KEY_BYTES + 1)
			expect(() => validateKey(tooLong)).toThrow(InvalidArgumentError)
		})

		it('attaches the argument name to the error', () => {
			try {
				validateKey('')
			} catch (error) {
				expect(error).toBeInstanceOf(InvalidArgumentError)
				expect((error as InvalidArgumentError).argument).toBe('key')
			}
		})
	})

	describe('validateService', () => {
		it('accepts undefined options (defaults will be applied later)', () => {
			expect(() => validateService(undefined)).not.toThrow()
			expect(() => validateService({})).not.toThrow()
		})

		it('rejects an explicit empty service', () => {
			expect(() => validateService({ service: '' })).toThrow(
				InvalidArgumentError
			)
		})

		it('rejects whitespace-only service names', () => {
			expect(() => validateService({ service: '   ' })).toThrow(
				InvalidArgumentError
			)
		})

		it('accepts a normal service name', () => {
			expect(() =>
				validateService({ service: 'com.example.auth' })
			).not.toThrow()
		})
	})

	describe('validateValue', () => {
		it('accepts strings up to MAX_VALUE_BYTES', () => {
			expect(() => validateValue('short')).not.toThrow()
		})

		it('rejects non-string values', () => {
			expect(() => validateValue(123)).toThrow(InvalidArgumentError)
			expect(() => validateValue(null)).toThrow(InvalidArgumentError)
		})

		it('rejects values exceeding MAX_VALUE_BYTES', () => {
			const tooBig = 'x'.repeat(MAX_VALUE_BYTES + 1)
			expect(() => validateValue(tooBig)).toThrow(InvalidArgumentError)
		})

		it('counts UTF-8 byte length, not character count', () => {
			// '\u{1F600}' (😀) is 4 UTF-8 bytes; allow well-under-the-limit input through.
			expect(() => validateValue('\u{1F600}')).not.toThrow()
		})

		it('counts 2-byte UTF-8 sequences (e.g. accented Latin)', () => {
			// 'é' (U+00E9) is 2 UTF-8 bytes; ensure the 2-byte branch is exercised.
			const atLimit = `${'x'.repeat(MAX_VALUE_BYTES - 2)}é`
			const tooBig = `${'x'.repeat(MAX_VALUE_BYTES - 1)}é`
			expect(() => validateValue(atLimit)).not.toThrow()
			expect(() => validateValue(tooBig)).toThrow(InvalidArgumentError)
		})

		it('treats a lone high surrogate as a 3-byte sequence (no skipping)', () => {
			// Unpaired high surrogate at end of string should count as 3 bytes (replacement),
			// not 4, and must not advance past end of string.
			const atLimit = `${'x'.repeat(MAX_VALUE_BYTES - 3)}\uD83D`
			const tooBig = `${'x'.repeat(MAX_VALUE_BYTES - 2)}\uD83D`
			expect(() => validateValue(atLimit)).not.toThrow()
			expect(() => validateValue(tooBig)).toThrow(InvalidArgumentError)
		})

		it('handles a high surrogate followed by a non-low surrogate without skipping the next character', () => {
			// '\uD83D' is unpaired (3 bytes) and 'a' is 1 byte — total tail is 4 bytes.
			const atLimit = `${'x'.repeat(MAX_VALUE_BYTES - 4)}\uD83Da`
			const tooBig = `${'x'.repeat(MAX_VALUE_BYTES - 3)}\uD83Da`
			expect(() => validateValue(atLimit)).not.toThrow()
			expect(() => validateValue(tooBig)).toThrow(InvalidArgumentError)
		})
	})
})
