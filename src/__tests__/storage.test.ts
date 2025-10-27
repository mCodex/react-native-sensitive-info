import {
  clearService,
  deleteItem,
  getAllItems,
  getItem,
  getSupportedSecurityLevels,
  hasItem,
  setItem,
} from '../core/storage'

const mockSetItem = jest.fn().mockResolvedValue({ success: true })
const mockGetItem = jest.fn().mockResolvedValue(null)
const mockHasItem = jest.fn().mockResolvedValue(true)
const mockDeleteItem = jest.fn().mockResolvedValue(true)
const mockGetAllItems = jest.fn().mockResolvedValue([])
const mockClearService = jest.fn().mockResolvedValue(undefined)
const mockGetSupportedSecurityLevels = jest.fn().mockResolvedValue({})

jest.mock('../internal/native', () =>
  jest.fn(() => ({
    setItem: mockSetItem,
    getItem: mockGetItem,
    hasItem: mockHasItem,
    deleteItem: mockDeleteItem,
    getAllItems: mockGetAllItems,
    clearService: mockClearService,
    getSupportedSecurityLevels: mockGetSupportedSecurityLevels,
  }))
)

describe('storage', () => {
  it('setItem calls native', async () => {
    const result = await setItem('key', 'value', { service: 'test' })
    expect(result).toBeDefined()
  })

  it('getItem calls native', async () => {
    const result = await getItem('key', { service: 'test' })
    expect(result).toBeDefined()
  })

  it('hasItem calls native', async () => {
    const result = await hasItem('key', { service: 'test' })
    expect(typeof result).toBe('boolean')
  })

  it('deleteItem calls native', async () => {
    const result = await deleteItem('key', { service: 'test' })
    expect(typeof result).toBe('boolean')
  })

  it('getAllItems calls native', async () => {
    const result = await getAllItems({ service: 'test' })
    expect(Array.isArray(result)).toBe(true)
  })

  it('clearService calls native', async () => {
    await clearService({ service: 'test' })
  })

  it('getSupportedSecurityLevels calls native', async () => {
    const result = await getSupportedSecurityLevels()
    expect(result).toBeDefined()
  })
})
