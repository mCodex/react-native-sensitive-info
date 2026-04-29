import { waitFor } from '@testing-library/dom'
import { act, renderHook } from '@testing-library/react'
import { getItem } from '../core/storage'
import { HookError } from '../hooks/types'
import { useSecretItem } from '../hooks/useSecretItem'
import { buildTestItem } from './__mocks__/fixtures'

jest.mock('../core/storage', () => ({
	...jest.requireActual('../core/storage'),
	getItem: jest.fn(),
}))

const mockedGetItem = getItem as jest.MockedFunction<typeof getItem>

describe('useSecretItem', () => {
	beforeEach(() => {
		mockedGetItem.mockReset()
	})

	it('returns the fetched item', async () => {
		mockedGetItem.mockResolvedValueOnce(buildTestItem({ value: 'value' }))

		const { result } = renderHook(
			({ opts }: { opts: Parameters<typeof useSecretItem>[1] }) =>
				useSecretItem('token', opts),
			{
				initialProps: { opts: { service: 'auth' } },
			}
		)

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.data?.value).toBe('value')
		expect(result.current.error).toBeNull()
		expect(mockedGetItem).toHaveBeenCalledWith('token', {
			service: 'auth',
			includeValue: true,
		})
	})

	it('keeps metadata-only reads silent when prompt options are provided', async () => {
		mockedGetItem.mockResolvedValueOnce(buildTestItem())

		renderHook(
			({ opts }: { opts: Parameters<typeof useSecretItem>[1] }) =>
				useSecretItem('token', opts),
			{
				initialProps: {
					opts: {
						service: 'auth',
						includeValue: false,
						accessControl: 'biometryCurrentSet',
						authenticationPrompt: { title: 'Unlock' },
					},
				},
			}
		)

		await waitFor(() => expect(mockedGetItem).toHaveBeenCalled())

		expect(mockedGetItem).toHaveBeenCalledWith('token', {
			service: 'auth',
			includeValue: false,
		})
	})

	it('skips fetching when requested', async () => {
		const { result } = renderHook(
			({ opts }: { opts: Parameters<typeof useSecretItem>[1] }) =>
				useSecretItem('token', opts),
			{
				initialProps: { opts: { skip: true } },
			}
		)

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.data).toBeNull()
		expect(result.current.error).toBeNull()
		expect(mockedGetItem).not.toHaveBeenCalled()
	})

	it('wraps failures in HookError', async () => {
		mockedGetItem.mockRejectedValueOnce(new Error('Native failure'))

		const { result } = renderHook(
			({ opts }: { opts: Parameters<typeof useSecretItem>[1] }) =>
				useSecretItem('token', opts),
			{
				initialProps: { opts: { service: 'auth' } },
			}
		)

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.data).toBeNull()
		expect(result.current.error).toBeInstanceOf(HookError)
		expect(result.current.error?.message).toContain('useSecretItem.fetch')
	})

	it('allows manual refetching', async () => {
		mockedGetItem
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(buildTestItem({ metadata: { timestamp: 2 } }))

		const { result } = renderHook(
			({ opts }: { opts: Parameters<typeof useSecretItem>[1] }) =>
				useSecretItem('token', opts),
			{
				initialProps: { opts: { service: 'auth', includeValue: false } },
			}
		)

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		expect(result.current.data).toBeNull()

		await act(async () => {
			await result.current.refetch()
		})

		await waitFor(() => expect(result.current.data).not.toBeNull())
		expect(mockedGetItem).toHaveBeenCalledTimes(2)
	})
})
