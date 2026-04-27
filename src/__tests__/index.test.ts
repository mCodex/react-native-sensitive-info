import {
	clearService,
	ErrorCode,
	getAllItems,
	getItem,
	getKeyVersion,
	getSupportedSecurityLevels,
	hasItem,
	IntegrityViolationError,
	KeyInvalidatedError,
	NotFoundError,
	RotationFailedError,
	rotateKeys,
	SensitiveInfo,
	SensitiveInfoError,
	setItem,
} from '../index'

describe('package entrypoint', () => {
	it('re-exports the storage helpers', () => {
		expect(typeof setItem).toBe('function')
		expect(typeof getItem).toBe('function')
		expect(typeof getAllItems).toBe('function')
		expect(typeof clearService).toBe('function')
		expect(typeof getSupportedSecurityLevels).toBe('function')
		expect(typeof hasItem).toBe('function')
		expect(typeof rotateKeys).toBe('function')
		expect(typeof getKeyVersion).toBe('function')
	})

	it('exposes the named SensitiveInfo facade bound to the same helpers', () => {
		expect(SensitiveInfo.setItem).toBe(setItem)
		expect(SensitiveInfo.getItem).toBe(getItem)
		expect(SensitiveInfo.rotateKeys).toBe(rotateKeys)
		expect(SensitiveInfo.getKeyVersion).toBe(getKeyVersion)
	})

	it('exposes typed error classes and codes', () => {
		expect(ErrorCode.NotFound).toBeDefined()
		expect(ErrorCode.IntegrityViolation).toBeDefined()
		expect(new NotFoundError('x')).toBeInstanceOf(SensitiveInfoError)
		expect(new IntegrityViolationError('x')).toBeInstanceOf(SensitiveInfoError)
		expect(new KeyInvalidatedError('x')).toBeInstanceOf(SensitiveInfoError)
		expect(new RotationFailedError('x')).toBeInstanceOf(SensitiveInfoError)
	})
})
