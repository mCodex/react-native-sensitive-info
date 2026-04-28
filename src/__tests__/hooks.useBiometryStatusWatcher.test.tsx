import { waitFor } from '@testing-library/dom'
import { act, renderHook } from '@testing-library/react'
import { AppState } from 'react-native'
import { getSupportedSecurityLevels } from '../core/storage'
import { useBiometryStatusWatcher } from '../hooks/useBiometryStatusWatcher'
import type { BiometryStatus } from '../sensitive-info.nitro'

jest.mock('../core/storage', () => ({
	...jest.requireActual('../core/storage'),
	getSupportedSecurityLevels: jest.fn(),
}))

const mockedGet = getSupportedSecurityLevels as jest.MockedFunction<
	typeof getSupportedSecurityLevels
>

const appState = AppState as unknown as {
	__emit: (status: string) => void
	__reset: () => void
}

const buildSnapshot = (status: BiometryStatus) => ({
	secureEnclave: true,
	strongBox: false,
	biometry: status === 'available',
	biometryStatus: status,
	deviceCredential: true,
})

describe('useBiometryStatusWatcher', () => {
	beforeEach(() => {
		mockedGet.mockReset()
		appState.__reset()
	})

	it('fires onChange once on initial detection with previous=null', async () => {
		mockedGet.mockResolvedValue(buildSnapshot('available'))
		const onChange = jest.fn()

		renderHook(() => useBiometryStatusWatcher(onChange))

		await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
		expect(onChange).toHaveBeenCalledWith('available', null)
	})

	it('fires only on actual transitions, not on every refetch', async () => {
		mockedGet
			.mockResolvedValueOnce(buildSnapshot('notEnrolled'))
			.mockResolvedValueOnce(buildSnapshot('notEnrolled')) // same status -> no fire
			.mockResolvedValueOnce(buildSnapshot('available'))

		const onChange = jest.fn()
		renderHook(() => useBiometryStatusWatcher(onChange))

		await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
		expect(onChange).toHaveBeenLastCalledWith('notEnrolled', null)

		// Foreground refresh keeping the same status: should NOT fire.
		await act(async () => {
			appState.__emit('background')
			appState.__emit('active')
		})
		await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2))
		expect(onChange).toHaveBeenCalledTimes(1)

		// Foreground refresh that flips status: should fire with previous=notEnrolled.
		// Skip past the 500 ms debounce by advancing the clock instead of sleeping
		// — the debounce uses `Date.now()`, not a queued timer, so a `Date.now`
		// spy is enough and keeps the test deterministic.
		const realNow = Date.now
		const nowSpy = jest
			.spyOn(Date, 'now')
			.mockImplementation(() => realNow() + 1_000)
		try {
			await act(async () => {
				appState.__emit('background')
				appState.__emit('active')
			})

			await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
			expect(onChange).toHaveBeenLastCalledWith('available', 'notEnrolled')
		} finally {
			nowSpy.mockRestore()
		}
	})
})
