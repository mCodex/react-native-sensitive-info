import {
	createInitialAsyncState,
	createInitialVoidState,
	HookError,
} from '../hooks/types'

describe('hooks/types', () => {
	it('constructs HookError with metadata', () => {
		const cause = new Error('native failure')
		const error = new HookError('Wrapper message', {
			cause,
			operation: 'useSecret.save',
			hint: 'Check the key.',
		})

		expect(error).toBeInstanceOf(Error)
		expect(error.cause).toBe(cause)
		expect(error.operation).toBe('useSecret.save')
		expect(error.hint).toBe('Check the key.')
	})

	it('keeps cause non-enumerable to match native ES2022 Error semantics', () => {
		const cause = new Error('native failure')
		const error = new HookError('Wrapper message', { cause })

		const descriptor = Object.getOwnPropertyDescriptor(error, 'cause')
		expect(descriptor).toBeDefined()
		expect(descriptor?.enumerable).toBe(false)
		expect(Object.keys(error)).not.toContain('cause')
		expect(JSON.parse(JSON.stringify(error))).not.toHaveProperty('cause')
	})

	it('omits cause when not provided', () => {
		const error = new HookError('Wrapper message')
		expect(Object.hasOwn(error, 'cause')).toBe(false)
	})

	it('defines a non-enumerable own cause when explicitly passed as undefined', () => {
		const error = new HookError('Wrapper message', { cause: undefined })
		const descriptor = Object.getOwnPropertyDescriptor(error, 'cause')
		expect(Object.hasOwn(error, 'cause')).toBe(true)
		expect(error.cause).toBeUndefined()
		expect(descriptor).toBeDefined()
		expect(descriptor?.enumerable).toBe(false)
		expect(Object.keys(error)).not.toContain('cause')
	})

	it('creates the initial async state', () => {
		const state = createInitialAsyncState<string>()
		expect(state).toEqual({
			data: null,
			error: null,
			isLoading: true,
			isPending: false,
		})
	})

	it('creates the initial void async state', () => {
		const state = createInitialVoidState()
		expect(state).toEqual({
			error: null,
			isLoading: false,
			isPending: false,
		})
	})
})
