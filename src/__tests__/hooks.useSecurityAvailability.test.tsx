import { waitFor } from '@testing-library/dom'
import { act, renderHook } from '@testing-library/react'
import { AppState } from 'react-native'
import { getSupportedSecurityLevels } from '../core/storage'
import { HookError } from '../hooks/types'
import { useSecurityAvailability } from '../hooks/useSecurityAvailability'

jest.mock('../core/storage', () => ({
	...jest.requireActual('../core/storage'),
	getSupportedSecurityLevels: jest.fn(),
}))

const mockedGetSupportedSecurityLevels =
	getSupportedSecurityLevels as jest.MockedFunction<
		typeof getSupportedSecurityLevels
	>

describe('useSecurityAvailability', () => {
	beforeEach(() => {
		mockedGetSupportedSecurityLevels.mockReset()
		;(AppState as unknown as { __reset: () => void }).__reset()
	})

	it('loads and caches the security capabilities', async () => {
		mockedGetSupportedSecurityLevels.mockResolvedValueOnce({
			secureEnclave: true,
			strongBox: false,
			biometry: true,
			biometryStatus: 'available',
			deviceCredential: true,
		})

		const { result } = renderHook(() => useSecurityAvailability())

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.data).toEqual({
			secureEnclave: true,
			strongBox: false,
			biometry: true,
			biometryStatus: 'available',
			deviceCredential: true,
		})
		expect(result.current.error).toBeNull()
		expect(mockedGetSupportedSecurityLevels).toHaveBeenCalledTimes(1)
	})

	it('wraps native errors as HookError', async () => {
		mockedGetSupportedSecurityLevels.mockRejectedValueOnce(
			new Error('native failure')
		)

		const { result } = renderHook(() => useSecurityAvailability())

		await waitFor(() => expect(result.current.isLoading).toBe(false))

		expect(result.current.data).toBeNull()
		expect(result.current.error).toBeInstanceOf(HookError)
		expect(result.current.error?.message).toContain(
			'useSecurityAvailability.fetch'
		)
	})

	it('refetch forces a fresh request even when cached', async () => {
		mockedGetSupportedSecurityLevels
			.mockResolvedValueOnce({
				secureEnclave: true,
				strongBox: false,
				biometry: true,
				biometryStatus: 'available',
				deviceCredential: true,
			})
			.mockResolvedValueOnce({
				secureEnclave: false,
				strongBox: true,
				biometry: true,
				biometryStatus: 'available',
				deviceCredential: true,
			})

		const { result } = renderHook(() => useSecurityAvailability())

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		expect(result.current.data?.strongBox).toBe(false)

		await act(async () => {
			await result.current.refetch()
		})

		await waitFor(() => expect(result.current.data?.strongBox).toBe(true))
		expect(mockedGetSupportedSecurityLevels).toHaveBeenCalledTimes(2)
	})

	describe('refreshOnForeground', () => {
		const appState = AppState as unknown as {
			__emit: (status: string) => void
			__listenerCount: () => number
		}

		const baseSnapshot = {
			secureEnclave: true,
			strongBox: false,
			biometry: false,
			biometryStatus: 'notEnrolled' as const,
			deviceCredential: true,
		}

		it('does not subscribe to AppState by default', async () => {
			mockedGetSupportedSecurityLevels.mockResolvedValue(baseSnapshot)
			const { unmount } = renderHook(() => useSecurityAvailability())
			await waitFor(() =>
				expect(mockedGetSupportedSecurityLevels).toHaveBeenCalled()
			)
			expect(appState.__listenerCount()).toBe(0)
			unmount()
		})

		it('refetches when the app returns to active', async () => {
			mockedGetSupportedSecurityLevels
				.mockResolvedValueOnce(baseSnapshot)
				.mockResolvedValueOnce({
					...baseSnapshot,
					biometry: true,
					biometryStatus: 'available',
				})

			const { result } = renderHook(() =>
				useSecurityAvailability({ refreshOnForeground: true })
			)

			await waitFor(() =>
				expect(result.current.data?.biometryStatus).toBe('notEnrolled')
			)
			expect(appState.__listenerCount()).toBe(1)

			await act(async () => {
				appState.__emit('background')
				appState.__emit('active')
			})

			await waitFor(() =>
				expect(result.current.data?.biometryStatus).toBe('available')
			)
			expect(mockedGetSupportedSecurityLevels).toHaveBeenCalledTimes(2)
		})

		it('debounces back-to-back active transitions', async () => {
			mockedGetSupportedSecurityLevels.mockResolvedValue(baseSnapshot)

			renderHook(() => useSecurityAvailability({ refreshOnForeground: true }))
			await waitFor(() =>
				expect(mockedGetSupportedSecurityLevels).toHaveBeenCalledTimes(1)
			)

			await act(async () => {
				appState.__emit('active')
				appState.__emit('active')
				appState.__emit('active')
			})

			// Initial fetch + at most one debounced refetch.
			expect(
				mockedGetSupportedSecurityLevels.mock.calls.length
			).toBeLessThanOrEqual(2)
		})

		it('removes the AppState subscription on unmount', async () => {
			mockedGetSupportedSecurityLevels.mockResolvedValue(baseSnapshot)
			const { unmount } = renderHook(() =>
				useSecurityAvailability({ refreshOnForeground: true })
			)
			await waitFor(() => expect(appState.__listenerCount()).toBe(1))
			unmount()
			expect(appState.__listenerCount()).toBe(0)
		})
	})
})
