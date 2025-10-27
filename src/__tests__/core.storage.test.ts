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

  const isNotFoundError = jest.fn()

  const loadModule = async () => {
    jest.resetModules()

    jest.doMock('../internal/native', () => ({
      __esModule: true,
      default: jest.fn(() => nativeHandle),
    }))

    jest.doMock('../internal/options', () => ({
      normalizeOptions,
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
    expect(normalizeOptions).toHaveBeenCalled()
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
      accessControl: 'secureEnclaveBiometry',
    } as SensitiveInfoGetRequest)
  })

  it('delegates hasItem to the native layer', async () => {
    const { hasItem } = await loadModule()

    nativeHandle.hasItem.mockResolvedValueOnce(true)

    const result = await hasItem('token', { service: 'service' })

    expect(result).toBe(true)
    expect(nativeHandle.hasItem).toHaveBeenCalledWith({
      key: 'token',
      service: 'normalized',
      accessControl: 'secureEnclaveBiometry',
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
      accessControl: 'secureEnclaveBiometry',
    } as SensitiveInfoDeleteRequest)
  })

  it('returns entries using getAllItems with includeValues default', async () => {
    const { getAllItems } = await loadModule()

    nativeHandle.getAllItems.mockResolvedValueOnce([])

    await getAllItems({ includeValues: true })

    expect(nativeHandle.getAllItems).toHaveBeenCalledWith({
      includeValues: true,
      service: 'normalized',
      accessControl: 'secureEnclaveBiometry',
    } as SensitiveInfoEnumerateRequest)
  })

  it('clears a service via native call', async () => {
    const { clearService } = await loadModule()

    nativeHandle.clearService.mockResolvedValueOnce(undefined)

    await clearService({ service: 'auth' })

    expect(nativeHandle.clearService).toHaveBeenCalledWith({
      service: 'normalized',
      accessControl: 'secureEnclaveBiometry',
    })
  })

  it('forwards getSupportedSecurityLevels', async () => {
    const { getSupportedSecurityLevels } = await loadModule()

    nativeHandle.getSupportedSecurityLevels.mockResolvedValueOnce({
      secureEnclave: true,
      strongBox: true,
      biometry: true,
      deviceCredential: false,
    })

    const result = await getSupportedSecurityLevels()

    expect(result).toEqual({
      secureEnclave: true,
      strongBox: true,
      biometry: true,
      deviceCredential: false,
    })
    expect(nativeHandle.getSupportedSecurityLevels).toHaveBeenCalled()
  })

  it('exposes a namespace mirroring the helpers', async () => {
    const module = await loadModule()

    expect(module.SensitiveInfo.setItem).toBe(module.setItem)
    expect(module.SensitiveInfo.getItem).toBe(module.getItem)
    expect(module.SensitiveInfo.clearService).toBe(module.clearService)
  })
})
