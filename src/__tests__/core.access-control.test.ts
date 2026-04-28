import {
	canUseAccessControl,
	canUseAccessControlSync,
} from '../core/access-control'
import { getSupportedSecurityLevels } from '../core/storage'
import type {
	AccessControl,
	BiometryStatus,
	SecurityAvailability,
} from '../sensitive-info.nitro'

jest.mock('../core/storage', () => ({
	...jest.requireActual('../core/storage'),
	getSupportedSecurityLevels: jest.fn(),
}))

const mockedGet = getSupportedSecurityLevels as jest.MockedFunction<
	typeof getSupportedSecurityLevels
>

const buildSnapshot = (
	overrides: Partial<SecurityAvailability> = {}
): SecurityAvailability => ({
	secureEnclave: true,
	strongBox: false,
	biometry: true,
	biometryStatus: 'available',
	deviceCredential: true,
	...overrides,
})

const ALL_STATUSES: readonly BiometryStatus[] = [
	'available',
	'notEnrolled',
	'notAvailable',
	'lockedOut',
	'unknown',
]

const ALL_POLICIES: readonly AccessControl[] = [
	'secureEnclaveBiometry',
	'biometryCurrentSet',
	'biometryAny',
	'devicePasscode',
	'none',
]

describe('biometryStatus invariant', () => {
	it.each(
		ALL_STATUSES
	)('biometry === (biometryStatus === "available") for status=%s', (status) => {
		const snapshot = buildSnapshot({
			biometryStatus: status,
			biometry: status === 'available',
		})
		expect(snapshot.biometry).toBe(snapshot.biometryStatus === 'available')
	})
})

describe('canUseAccessControlSync — policy × status mapping', () => {
	const cases: readonly [
		AccessControl,
		BiometryStatus,
		Partial<SecurityAvailability>,
		boolean,
	][] = [
		// secureEnclaveBiometry: requires (secureEnclave || strongBox) AND biometry available
		['secureEnclaveBiometry', 'available', { secureEnclave: true }, true],
		[
			'secureEnclaveBiometry',
			'available',
			{ secureEnclave: false, strongBox: true },
			true,
		],
		[
			'secureEnclaveBiometry',
			'available',
			{ secureEnclave: false, strongBox: false },
			false,
		],
		['secureEnclaveBiometry', 'notEnrolled', { secureEnclave: true }, false],
		['secureEnclaveBiometry', 'notAvailable', { secureEnclave: true }, false],
		['secureEnclaveBiometry', 'lockedOut', { secureEnclave: true }, false],
		['secureEnclaveBiometry', 'unknown', { secureEnclave: true }, false],

		// biometryCurrentSet: biometry available
		['biometryCurrentSet', 'available', {}, true],
		['biometryCurrentSet', 'notEnrolled', {}, false],
		['biometryCurrentSet', 'notAvailable', {}, false],
		['biometryCurrentSet', 'lockedOut', {}, false],
		['biometryCurrentSet', 'unknown', {}, false],

		// biometryAny: biometry available
		['biometryAny', 'available', {}, true],
		['biometryAny', 'notEnrolled', {}, false],
		['biometryAny', 'notAvailable', {}, false],
		['biometryAny', 'lockedOut', {}, false],
		['biometryAny', 'unknown', {}, false],

		// devicePasscode: deviceCredential
		['devicePasscode', 'available', { deviceCredential: true }, true],
		['devicePasscode', 'available', { deviceCredential: false }, false],
		['devicePasscode', 'notAvailable', { deviceCredential: true }, true],
		['devicePasscode', 'notAvailable', { deviceCredential: false }, false],

		// none: always true
		...ALL_STATUSES.map(
			(s) =>
				[
					'none',
					s,
					{ secureEnclave: false, strongBox: false, deviceCredential: false },
					true,
				] as [
					AccessControl,
					BiometryStatus,
					Partial<SecurityAvailability>,
					boolean,
				]
		),
	]

	it.each(
		cases
	)('%s + status=%s + overrides=%j -> %s', (policy, status, overrides, expected) => {
		const snapshot = buildSnapshot({
			...overrides,
			biometryStatus: status,
			biometry: status === 'available',
		})
		expect(canUseAccessControlSync(policy, snapshot)).toBe(expected)
	})

	it('covers every policy at least once', () => {
		const seen = new Set(cases.map(([p]) => p))
		for (const p of ALL_POLICIES) expect(seen).toContain(p)
	})
})

describe('canUseAccessControl — async wrapper', () => {
	beforeEach(() => mockedGet.mockReset())

	it('fetches the snapshot when not provided', async () => {
		mockedGet.mockResolvedValueOnce(
			buildSnapshot({ biometryStatus: 'available' })
		)
		await expect(canUseAccessControl('secureEnclaveBiometry')).resolves.toBe(
			true
		)
		expect(mockedGet).toHaveBeenCalledTimes(1)
	})

	it('skips the native call when a snapshot is provided', async () => {
		const snapshot = buildSnapshot({
			biometryStatus: 'notEnrolled',
			biometry: false,
		})
		await expect(
			canUseAccessControl('biometryCurrentSet', snapshot)
		).resolves.toBe(false)
		expect(mockedGet).not.toHaveBeenCalled()
	})
})
