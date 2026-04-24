import { act, renderHook } from '@testing-library/react'
import { getKeyVersion, rotateKeys } from '../core/storage'
import { useKeyRotation } from '../hooks/useKeyRotation'

jest.mock('../core/storage', () => ({
	...jest.requireActual('../core/storage'),
	rotateKeys: jest.fn(),
	getKeyVersion: jest.fn(),
}))

const mockedRotateKeys = rotateKeys as jest.MockedFunction<typeof rotateKeys>
const mockedGetKeyVersion = getKeyVersion as jest.MockedFunction<
	typeof getKeyVersion
>

describe('useKeyRotation', () => {
	beforeEach(() => {
		mockedRotateKeys.mockReset()
		mockedGetKeyVersion.mockReset()
	})

	it('rotates keys and updates lastResult', async () => {
		mockedRotateKeys.mockResolvedValueOnce({
			previousVersion: 1,
			newVersion: 2,
			reEncryptedCount: 3,
		})

		const { result } = renderHook(() =>
			useKeyRotation({ service: 'auth', reEncryptEagerly: true })
		)

		expect(result.current.lastResult).toBeNull()
		expect(result.current.isRotating).toBe(false)

		await act(async () => {
			const ack = await result.current.rotate()
			expect(ack.success).toBe(true)
		})

		expect(mockedRotateKeys).toHaveBeenCalledWith(
			expect.objectContaining({ service: 'auth', reEncryptEagerly: true })
		)
		expect(result.current.lastResult).toEqual({
			previousVersion: 1,
			newVersion: 2,
			reEncryptedCount: 3,
		})
		expect(result.current.error).toBeNull()
	})

	it('defaults reEncryptEagerly to false', async () => {
		mockedRotateKeys.mockResolvedValueOnce({
			previousVersion: 1,
			newVersion: 2,
			reEncryptedCount: 0,
		})

		const { result } = renderHook(() => useKeyRotation())

		await act(async () => {
			await result.current.rotate()
		})

		expect(mockedRotateKeys).toHaveBeenCalledWith(
			expect.objectContaining({ reEncryptEagerly: false })
		)
	})

	it('captures rotation failures as HookError', async () => {
		mockedRotateKeys.mockRejectedValueOnce(new Error('kaboom'))

		const { result } = renderHook(() => useKeyRotation())

		await act(async () => {
			const ack = await result.current.rotate()
			expect(ack.success).toBe(false)
		})

		expect(result.current.error).not.toBeNull()
		expect(result.current.error?.message).toContain('useKeyRotation.rotate')
		expect(result.current.isRotating).toBe(false)
	})

	it('readVersion returns the current version', async () => {
		mockedGetKeyVersion.mockResolvedValueOnce(7)

		const { result } = renderHook(() => useKeyRotation({ service: 'auth' }))

		let value: number | null = null
		await act(async () => {
			value = await result.current.readVersion()
		})

		expect(value).toBe(7)
		expect(mockedGetKeyVersion).toHaveBeenCalledWith(
			expect.objectContaining({ service: 'auth' })
		)
	})

	it('readVersion captures failures and returns null', async () => {
		mockedGetKeyVersion.mockRejectedValueOnce(new Error('down'))

		const { result } = renderHook(() => useKeyRotation())

		let value: number | null = 0
		await act(async () => {
			value = await result.current.readVersion()
		})

		expect(value).toBeNull()
		expect(result.current.error?.message).toContain(
			'useKeyRotation.readVersion'
		)
	})
})
