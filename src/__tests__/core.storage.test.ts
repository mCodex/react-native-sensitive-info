import type {
	SensitiveInfoDeleteRequest,
	SensitiveInfoEnumerateRequest,
	SensitiveInfoGetRequest,
	SensitiveInfoHasRequest,
	SensitiveInfoOptions,
	SensitiveInfoSetRequest,
} from '../sensitive-info.nitro'

describe('core/storage', () => {
	const nativeHandle = {
		setItem: jest.fn(),
		getItem: jest.fn(),
		hasItem: jest.fn(),
		deleteItem: jest.fn(),
		getAllItems: jest.fn(),
		clearService: jest.fn(),
		getSupportedSecurityLevels: jest.fn(),
		rotateKeys: jest.fn(),
		getKeyVersion: jest.fn(),
	}

	const normalizeOptions = jest
		.fn<
			ReturnType<typeof import('../internal/options').normalizeOptions>,
			[SensitiveInfoOptions | undefined]
		>()
		.mockReturnValue({
			service: 'normalized',
			accessControl: 'secureEnclaveBiometry',
		})
	const normalizePromptedReadOptions = jest
		.fn<
			ReturnType<
				typeof import('../internal/options').normalizePromptedReadOptions
			>,
			[SensitiveInfoOptions | undefined]
		>()
		.mockReturnValue({
			service: 'normalized',
		})
	const normalizeStorageScopeOptions = jest
		.fn<
			ReturnType<
				typeof import('../internal/options').normalizeStorageScopeOptions
			>,
			[SensitiveInfoOptions | undefined]
		>()
		.mockReturnValue({
			service: 'normalized',
		})

	const isNotFoundError = jest.fn()

	const loadModule = async () => {
		jest.resetModules()

		jest.doMock('../internal/native', () => ({
			__esModule: true,
			default: jest.fn(() => nativeHandle),
		}))

		jest.doMock('../internal/options', () => ({
			normalizeOptions,
			normalizePromptedReadOptions,
			normalizeStorageScopeOptions,
		}))

		jest.doMock('../internal/errors', () => ({
			isNotFoundError,
		}))

		return import('../core/storage')
	}

	beforeEach(() => {
		jest.clearAllMocks()
		Object.values(nativeHandle).forEach((value) => {
			if (typeof value === 'function') {
				value.mockReset()
			}
		})
		normalizeOptions.mockClear()
		normalizeOptions.mockReturnValue({
			service: 'normalized',
			accessControl: 'secureEnclaveBiometry',
		})
		normalizePromptedReadOptions.mockClear()
		normalizePromptedReadOptions.mockReturnValue({
			service: 'normalized',
		})
		normalizeStorageScopeOptions.mockClear()
		normalizeStorageScopeOptions.mockReturnValue({
			service: 'normalized',
		})
		isNotFoundError.mockReset()
	})

	it('delegates setItem to the native layer', async () => {
		const { setItem } = await loadModule()

		nativeHandle.setItem.mockResolvedValue({ metadata: {} })

		await setItem('token', 'secret', { service: 'service' })

		expect(normalizeOptions).toHaveBeenCalledWith({ service: 'service' })
		expect(nativeHandle.setItem).toHaveBeenCalledWith({
			key: 'token',
			value: 'secret',
			service: 'normalized',
			accessControl: 'secureEnclaveBiometry',
		} as SensitiveInfoSetRequest)
	})

	it('returns null when a key is missing', async () => {
		const { getItem } = await loadModule()

		const error = new Error('Missing [E_NOT_FOUND] key')
		nativeHandle.getItem.mockRejectedValueOnce(error)
		isNotFoundError.mockReturnValueOnce(true)

		const result = await getItem('token', { service: 'service' })

		expect(result).toBeNull()
		expect(normalizePromptedReadOptions).toHaveBeenCalled()
	})

	it('rethrows unexpected errors during getItem', async () => {
		const { getItem } = await loadModule()

		const error = new Error('Boom')
		nativeHandle.getItem.mockRejectedValueOnce(error)
		isNotFoundError.mockReturnValueOnce(false)

		await expect(getItem('token')).rejects.toBe(error)
	})

	it('passes includeValue defaults to getItem', async () => {
		const { getItem } = await loadModule()

		nativeHandle.getItem.mockResolvedValueOnce({ key: 'token' })

		await getItem('token')

		expect(nativeHandle.getItem).toHaveBeenCalledWith({
			key: 'token',
			includeValue: true,
			service: 'normalized',
		} as SensitiveInfoGetRequest)
	})

	it('keeps metadata-only getItem calls silent', async () => {
		const { getItem } = await loadModule()

		nativeHandle.getItem.mockResolvedValueOnce({ key: 'token' })
		const prompt = { title: 'Authenticate' }

		await getItem('token', {
			service: 'service',
			includeValue: false,
			authenticationPrompt: prompt,
		})

		expect(normalizeStorageScopeOptions).toHaveBeenCalledWith({
			service: 'service',
			includeValue: false,
			authenticationPrompt: prompt,
		})
		expect(normalizePromptedReadOptions).not.toHaveBeenCalled()
		expect(nativeHandle.getItem).toHaveBeenCalledWith({
			key: 'token',
			includeValue: false,
			service: 'normalized',
		} as SensitiveInfoGetRequest)
	})

	it('surfaces keyVersion from native metadata', async () => {
		const { getItem } = await loadModule()

		nativeHandle.getItem.mockResolvedValueOnce({
			key: 'token',
			service: 'normalized',
			value: 'secret',
			metadata: {
				securityLevel: 'biometry',
				backend: 'keychain',
				accessControl: 'biometryAny',
				timestamp: 123,
				keyVersion: 3,
			},
		})

		const item = await getItem('token')

		expect(item?.metadata.keyVersion).toBe(3)
	})

	it('surfaces integrityTag from native metadata', async () => {
		const { getItem } = await loadModule()

		nativeHandle.getItem.mockResolvedValueOnce({
			key: 'token',
			service: 'normalized',
			value: 'secret',
			metadata: {
				securityLevel: 'biometry',
				backend: 'keychain',
				accessControl: 'biometryAny',
				timestamp: 123,
				keyVersion: 1,
				integrityTag: 'aGVsbG8=',
			},
		})

		const item = await getItem('token')

		expect(item?.metadata.integrityTag).toBe('aGVsbG8=')
	})

	it('propagates native integrity-violation errors', async () => {
		const { getItem } = await loadModule()

		nativeHandle.getItem.mockRejectedValueOnce(
			new Error(
				'[E_INTEGRITY_VIOLATION] Tampering detected for key "token" in service "auth".'
			)
		)

		await expect(getItem('token')).rejects.toThrow(/E_INTEGRITY_VIOLATION/)
	})

	it('delegates hasItem to the native layer', async () => {
		const { hasItem } = await loadModule()

		nativeHandle.hasItem.mockResolvedValueOnce(true)

		const result = await hasItem('token', { service: 'service' })

		expect(result).toBe(true)
		expect(nativeHandle.hasItem).toHaveBeenCalledWith({
			key: 'token',
			service: 'normalized',
		} as SensitiveInfoHasRequest)
	})

	it('delegates deleteItem to the native layer', async () => {
		const { deleteItem } = await loadModule()

		nativeHandle.deleteItem.mockResolvedValueOnce(true)

		const result = await deleteItem('token', { service: 'service' })

		expect(result).toBe(true)
		expect(nativeHandle.deleteItem).toHaveBeenCalledWith({
			key: 'token',
			service: 'normalized',
		} as SensitiveInfoDeleteRequest)
	})

	it('returns entries using getAllItems with includeValues default', async () => {
		const { getAllItems } = await loadModule()

		nativeHandle.getAllItems.mockResolvedValueOnce([])

		await getAllItems({ includeValues: true })

		expect(nativeHandle.getAllItems).toHaveBeenCalledWith({
			includeValues: true,
			service: 'normalized',
		} as SensitiveInfoEnumerateRequest)
	})

	it('keeps metadata-only enumeration silent', async () => {
		const { getAllItems } = await loadModule()

		nativeHandle.getAllItems.mockResolvedValueOnce([])
		const prompt = { title: 'Authenticate' }

		await getAllItems({
			service: 'service',
			includeValues: false,
			authenticationPrompt: prompt,
		})

		expect(normalizeStorageScopeOptions).toHaveBeenCalledWith({
			service: 'service',
			includeValues: false,
			authenticationPrompt: prompt,
		})
		expect(normalizePromptedReadOptions).not.toHaveBeenCalled()
		expect(nativeHandle.getAllItems).toHaveBeenCalledWith({
			includeValues: false,
			service: 'normalized',
		} as SensitiveInfoEnumerateRequest)
	})

	it('clears a service via native call', async () => {
		const { clearService } = await loadModule()

		nativeHandle.clearService.mockResolvedValueOnce(undefined)

		await clearService({ service: 'auth' })

		expect(nativeHandle.clearService).toHaveBeenCalledWith({
			service: 'normalized',
		})
	})

	it('forwards getSupportedSecurityLevels', async () => {
		const { getSupportedSecurityLevels } = await loadModule()

		nativeHandle.getSupportedSecurityLevels.mockResolvedValueOnce({
			secureEnclave: true,
			strongBox: true,
			biometry: true,
			biometryStatus: 'available',
			deviceCredential: false,
		})

		const result = await getSupportedSecurityLevels()

		expect(result).toEqual({
			secureEnclave: true,
			strongBox: true,
			biometry: true,
			biometryStatus: 'available',
			deviceCredential: false,
		})
		expect(nativeHandle.getSupportedSecurityLevels).toHaveBeenCalled()
	})

	it('exposes a namespace mirroring the helpers', async () => {
		const module = await loadModule()

		expect(module.SensitiveInfo.setItem).toBe(module.setItem)
		expect(module.SensitiveInfo.getItem).toBe(module.getItem)
		expect(module.SensitiveInfo.clearService).toBe(module.clearService)
		expect(module.SensitiveInfo.rotateKeys).toBe(module.rotateKeys)
		expect(module.SensitiveInfo.getKeyVersion).toBe(module.getKeyVersion)
	})

	it('rotates keys with sane defaults', async () => {
		const { rotateKeys } = await loadModule()

		nativeHandle.rotateKeys.mockResolvedValueOnce({
			previousVersion: 1,
			newVersion: 2,
			reEncryptedCount: 0,
		})

		const result = await rotateKeys({ service: 'auth' })

		expect(result).toEqual({
			previousVersion: 1,
			newVersion: 2,
			reEncryptedCount: 0,
		})
		expect(nativeHandle.rotateKeys).toHaveBeenCalledWith({
			reEncryptEagerly: false,
			service: 'normalized',
		})
	})

	it('rotates keys eagerly when requested', async () => {
		const { rotateKeys } = await loadModule()

		nativeHandle.rotateKeys.mockResolvedValueOnce({
			previousVersion: 2,
			newVersion: 3,
			reEncryptedCount: 7,
		})

		await rotateKeys({ reEncryptEagerly: true })

		expect(nativeHandle.rotateKeys).toHaveBeenCalledWith(
			expect.objectContaining({ reEncryptEagerly: true })
		)
	})

	it('wraps rotation failures as typed errors', async () => {
		const { rotateKeys } = await loadModule()

		nativeHandle.rotateKeys.mockRejectedValueOnce(
			new Error('[E_ROTATION_FAILED] kaboom')
		)

		await expect(rotateKeys()).rejects.toMatchObject({
			code: 'E_ROTATION_FAILED',
		})
	})

	it('reads the current key version', async () => {
		const { getKeyVersion } = await loadModule()

		nativeHandle.getKeyVersion.mockResolvedValueOnce(4)

		await expect(getKeyVersion({ service: 'auth' })).resolves.toBe(4)
		expect(nativeHandle.getKeyVersion).toHaveBeenCalledWith({
			service: 'normalized',
		})
	})

	it('wraps setItem errors with typed classification', async () => {
		const { setItem } = await loadModule()

		nativeHandle.setItem.mockRejectedValueOnce(
			new Error('[E_INTEGRITY_VIOLATION] bad')
		)

		await expect(setItem('k', 'v')).rejects.toMatchObject({
			code: 'E_INTEGRITY_VIOLATION',
		})
	})

	it('wraps hasItem errors with typed classification', async () => {
		const { hasItem } = await loadModule()

		nativeHandle.hasItem.mockRejectedValueOnce(
			new Error('[E_KEY_INVALIDATED] expired')
		)

		await expect(hasItem('k')).rejects.toMatchObject({
			code: 'E_KEY_INVALIDATED',
		})
	})

	it('wraps deleteItem errors with typed classification', async () => {
		const { deleteItem } = await loadModule()

		nativeHandle.deleteItem.mockRejectedValueOnce(new Error('boom'))

		await expect(deleteItem('k')).rejects.toThrow('boom')
	})

	it('wraps getAllItems errors', async () => {
		const { getAllItems } = await loadModule()

		nativeHandle.getAllItems.mockRejectedValueOnce(
			new Error('[E_AUTH_CANCELED]')
		)

		await expect(getAllItems()).rejects.toMatchObject({
			code: 'E_AUTH_CANCELED',
		})
	})

	it('wraps clearService errors', async () => {
		const { clearService } = await loadModule()

		nativeHandle.clearService.mockRejectedValueOnce(new Error('failed'))

		await expect(clearService()).rejects.toThrow('failed')
	})

	it('wraps getSupportedSecurityLevels errors', async () => {
		const { getSupportedSecurityLevels } = await loadModule()

		nativeHandle.getSupportedSecurityLevels.mockRejectedValueOnce(
			new Error('[E_ROTATION_FAILED]')
		)

		await expect(getSupportedSecurityLevels()).rejects.toMatchObject({
			code: 'E_ROTATION_FAILED',
		})
	})

	it('wraps getKeyVersion errors', async () => {
		const { getKeyVersion } = await loadModule()

		nativeHandle.getKeyVersion.mockRejectedValueOnce(new Error('nope'))

		await expect(getKeyVersion()).rejects.toThrow('nope')
	})
})
