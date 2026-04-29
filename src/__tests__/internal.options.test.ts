import {
	DEFAULT_ACCESS_CONTROL,
	DEFAULT_SERVICE,
	normalizeOptions,
	normalizePromptedReadOptions,
	normalizeStorageScopeOptions,
} from '../internal/options'

describe('internal/options', () => {
	it('returns defaults when no options are provided', () => {
		expect(normalizeOptions()).toEqual({
			service: DEFAULT_SERVICE,
			accessControl: DEFAULT_ACCESS_CONTROL,
		})
	})

	it('applies defaults while preserving provided values', () => {
		expect(
			normalizeOptions({
				service: 'custom',
				iosSynchronizable: true,
			})
		).toEqual({
			service: 'custom',
			accessControl: DEFAULT_ACCESS_CONTROL,
			iosSynchronizable: true,
		})
	})

	it('propagates optional fields verbatim', () => {
		const prompt = {
			title: 'Authenticate',
			description: 'Custom prompt',
			cancel: 'Abort',
		}
		expect(
			normalizeOptions({
				accessControl: 'biometryAny',
				keychainGroup: 'group.shared',
				authenticationPrompt: prompt,
			})
		).toEqual({
			service: DEFAULT_SERVICE,
			accessControl: 'biometryAny',
			keychainGroup: 'group.shared',
			authenticationPrompt: prompt,
		})
	})

	it('normalizes storage scope without access policy or prompts', () => {
		expect(
			normalizeStorageScopeOptions({
				service: 'custom',
				accessControl: 'biometryAny',
				iosSynchronizable: true,
				keychainGroup: 'group.shared',
				authenticationPrompt: { title: 'Authenticate' },
			})
		).toEqual({
			service: 'custom',
			iosSynchronizable: true,
			keychainGroup: 'group.shared',
		})
	})

	it('normalizes prompted reads without write-only access policy', () => {
		const prompt = { title: 'Authenticate' }

		expect(
			normalizePromptedReadOptions({
				service: 'custom',
				accessControl: 'biometryAny',
				authenticationPrompt: prompt,
			})
		).toEqual({
			service: 'custom',
			authenticationPrompt: prompt,
		})
	})
})
