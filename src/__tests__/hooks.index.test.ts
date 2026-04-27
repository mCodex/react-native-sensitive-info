import * as hooks from '../hooks/index'

describe('hooks entry point', () => {
	it('re-exports every hook', () => {
		expect(typeof hooks.useHasSecret).toBe('function')
		expect(typeof hooks.useSecret).toBe('function')
		expect(typeof hooks.useSecretItem).toBe('function')
		expect(typeof hooks.useSecureOperation).toBe('function')
		expect(typeof hooks.useSecureStorage).toBe('function')
		expect(typeof hooks.useSecurityAvailability).toBe('function')
		expect(typeof hooks.useKeyRotation).toBe('function')
		expect(typeof hooks.HookError).toBe('function')
		expect(typeof hooks.createHookFailureResult).toBe('function')
		expect(typeof hooks.createHookSuccessResult).toBe('function')
	})
})
