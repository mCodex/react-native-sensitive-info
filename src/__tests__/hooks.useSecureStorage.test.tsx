import { waitFor } from '@testing-library/dom'
import { act, renderHook } from '@testing-library/react'
import { clearService, deleteItem, getAllItems, setItem } from '../core/storage'
import { HookError } from '../hooks/types'
import {
	type UseSecureStorageOptions,
	useSecureStorage,
} from '../hooks/useSecureStorage'
import { buildTestItem, buildTestMetadata } from './__mocks__/fixtures'

jest.mock('../core/storage', () => ({
	...jest.requireActual('../core/storage'),
	getAllItems: jest.fn(),
	setItem: jest.fn(),
	deleteItem: jest.fn(),
	clearService: jest.fn(),
}))

const mockedGetAllItems = getAllItems as jest.MockedFunction<typeof getAllItems>
const mockedSetItem = setItem as jest.MockedFunction<typeof setItem>
const mockedDeleteItem = deleteItem as jest.MockedFunction<typeof deleteItem>
const mockedClearService = clearService as jest.MockedFunction<
	typeof clearService
>

describe('useSecureStorage', () => {
	beforeEach(() => {
		mockedGetAllItems.mockReset()
		mockedSetItem.mockReset()
		mockedDeleteItem.mockReset()
		mockedClearService.mockReset()
	})

	const renderStorage = (options?: UseSecureStorageOptions) =>
		renderHook(
			({ opts }: { opts: UseSecureStorageOptions | undefined }) =>
				useSecureStorage(opts),
			{
				initialProps: { opts: options },
			}
		)

	it('loads items on mount', async () => {
		mockedGetAllItems.mockResolvedValueOnce([
			buildTestItem({ value: 'secret' }),
		])

		const { result } = renderStorage({ service: 'auth', includeValues: true })

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.items).toHaveLength(1)
		expect(result.current.items[0]?.value).toBe('secret')
		expect(result.current.error).toBeNull()
		expect(mockedGetAllItems).toHaveBeenCalledWith({
			service: 'auth',
			includeValues: true,
		})
	})

	it('keeps metadata listings silent when prompt options are provided', async () => {
		mockedGetAllItems.mockResolvedValueOnce([])

		renderStorage({
			service: 'auth',
			includeValues: false,
			accessControl: 'biometryCurrentSet',
			authenticationPrompt: { title: 'Unlock' },
		})

		await waitFor(() => expect(mockedGetAllItems).toHaveBeenCalled())

		expect(mockedGetAllItems).toHaveBeenCalledWith({ service: 'auth' })
	})

	it('skips fetching when instructed', async () => {
		const { result } = renderStorage({ skip: true })

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.items).toEqual([])
		expect(result.current.error).toBeNull()
		expect(mockedGetAllItems).not.toHaveBeenCalled()
	})

	it('stores HookError when fetching fails', async () => {
		mockedGetAllItems.mockRejectedValueOnce(new Error('native failure'))

		const { result } = renderStorage({ service: 'auth' })

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.items).toEqual([])
		expect(result.current.error).toBeInstanceOf(HookError)
	})

	it('exposes a refresh helper', async () => {
		mockedGetAllItems
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([buildTestItem({ key: 'next' })])

		const { result } = renderStorage({ service: 'auth' })

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		expect(result.current.items).toEqual([])

		await act(async () => {
			await result.current.refreshItems()
		})

		await waitFor(() => expect(result.current.items).toHaveLength(1))
		expect(mockedGetAllItems).toHaveBeenCalledTimes(2)
	})

	it('saves items and refreshes the list', async () => {
		mockedGetAllItems.mockResolvedValue([])
		mockedSetItem.mockResolvedValueOnce({ metadata: buildTestMetadata() })

		const { result } = renderStorage({ service: 'auth', includeValues: true })

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		await act(async () => {
			const outcome = await result.current.saveSecret('token', 'secret')
			expect(outcome).toEqual({ success: true })
		})

		expect(mockedSetItem).toHaveBeenCalledWith('token', 'secret', {
			service: 'auth',
		})
		expect(mockedGetAllItems).toHaveBeenCalledTimes(2)
	})

	it('surfaces errors from saveSecret', async () => {
		mockedGetAllItems.mockResolvedValue([])
		mockedSetItem.mockRejectedValueOnce(new Error('set failed'))

		const { result } = renderStorage({ service: 'auth' })

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		await act(async () => {
			const outcome = await result.current.saveSecret('token', 'secret')
			expect(outcome.success).toBe(false)
			expect(outcome.error).toBeInstanceOf(HookError)
		})

		expect(result.current.error).toBeInstanceOf(HookError)
	})

	it('removes items locally when delete succeeds', async () => {
		mockedGetAllItems.mockResolvedValueOnce([
			buildTestItem({ key: 'token', value: 'secret' }),
		])
		mockedDeleteItem.mockResolvedValueOnce(true)

		const { result } = renderStorage({ service: 'auth' })

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		expect(result.current.items).toHaveLength(1)

		await act(async () => {
			const outcome = await result.current.removeSecret('token')
			expect(outcome).toEqual({ success: true })
		})

		expect(result.current.items).toEqual([])
		expect(mockedDeleteItem).toHaveBeenCalledWith('token', { service: 'auth' })
	})

	it('gracefully handles delete failures', async () => {
		mockedGetAllItems.mockResolvedValueOnce([])
		mockedDeleteItem.mockRejectedValueOnce(new Error('delete failed'))

		const { result } = renderStorage({ service: 'auth' })

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		await act(async () => {
			const outcome = await result.current.removeSecret('token')
			expect(outcome.success).toBe(false)
			expect(outcome.error).toBeInstanceOf(HookError)
		})

		expect(result.current.error).toBeInstanceOf(HookError)
	})

	it('clears the service and resets local state', async () => {
		mockedGetAllItems.mockResolvedValueOnce([
			buildTestItem({ key: 'token', value: 'secret' }),
		])
		mockedClearService.mockResolvedValueOnce()

		const { result } = renderStorage({ service: 'auth' })

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		await act(async () => {
			const outcome = await result.current.clearAll()
			expect(outcome).toEqual({ success: true })
		})

		expect(result.current.items).toEqual([])
		expect(result.current.error).toBeNull()
		expect(mockedClearService).toHaveBeenCalledWith({ service: 'auth' })
	})

	it('records errors from clearAll', async () => {
		mockedGetAllItems.mockResolvedValueOnce([])
		mockedClearService.mockRejectedValueOnce(new Error('clear failed'))

		const { result } = renderStorage({ service: 'auth' })

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		await act(async () => {
			const outcome = await result.current.clearAll()
			expect(outcome.success).toBe(false)
			expect(outcome.error).toBeInstanceOf(HookError)
		})

		expect(result.current.error).toBeInstanceOf(HookError)
	})
})
