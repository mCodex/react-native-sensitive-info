/**
 * Unit tests for the Expo config plugin (`app.plugin.js`).
 *
 * `@expo/config-plugins` is not a dev dependency of this package (it would normally be supplied
 * transitively by the consuming Expo project), so we mock the with-* helpers and capture the
 * mod functions they receive. This is enough to verify the plugin shapes Info.plist, gradle
 * properties, Podfile properties, and AndroidManifest correctly — and that it is idempotent.
 */

type ModFn<T> = (config: { modResults: T }) => { modResults: T }

interface CapturedMods {
	infoPlist: ModFn<Record<string, unknown>>[]
	gradle: ModFn<Array<{ type: 'property'; name: string; value: string }>>[]
	podfile: ModFn<Record<string, unknown>>[]
	manifest: ModFn<{
		manifest: { 'uses-permission'?: Array<{ $: Record<string, string> }> }
	}>[]
}

const captured: CapturedMods = {
	infoPlist: [],
	gradle: [],
	podfile: [],
	manifest: [],
}

const addPermission = jest.fn(
	(
		manifest: {
			manifest: { 'uses-permission'?: Array<{ $: Record<string, string> }> }
		},
		permission: string
	) => {
		manifest.manifest['uses-permission'] ??= []
		const list = manifest.manifest['uses-permission']
		if (
			!list.some((entry) => entry.$ && entry.$['android:name'] === permission)
		) {
			list.push({ $: { 'android:name': permission } })
		}
	}
)

jest.mock(
	'@expo/config-plugins',
	() => ({
		AndroidConfig: { Permissions: { addPermission } },
		createRunOncePlugin: (plugin: unknown) => plugin,
		withInfoPlist: (config: unknown, mod: ModFn<Record<string, unknown>>) => {
			captured.infoPlist.push(mod)
			return config
		},
		withGradleProperties: (
			config: unknown,
			mod: ModFn<Array<{ type: 'property'; name: string; value: string }>>
		) => {
			captured.gradle.push(mod)
			return config
		},
		withPodfileProperties: (
			config: unknown,
			mod: ModFn<Record<string, unknown>>
		) => {
			captured.podfile.push(mod)
			return config
		},
		withAndroidManifest: (
			config: unknown,
			mod: ModFn<{
				manifest: {
					'uses-permission'?: Array<{ $: Record<string, string> }>
				}
			}>
		) => {
			captured.manifest.push(mod)
			return config
		},
	}),
	{ virtual: true }
)

const loadPlugin = () => {
	jest.resetModules()
	captured.infoPlist = []
	captured.gradle = []
	captured.podfile = []
	captured.manifest = []
	addPermission.mockClear()
	return require('../app.plugin.js') as (
		config: object,
		props?: {
			faceIDPermission?: string | null
			enableNewArchitecture?: boolean
		}
	) => object
}

describe('app.plugin', () => {
	it('writes default Face ID permission when missing', () => {
		const plugin = loadPlugin()
		plugin({})
		const plist: Record<string, unknown> = {}
		captured.infoPlist[0]?.({ modResults: plist })
		expect(plist.NSFaceIDUsageDescription).toBe(
			'Authenticate to access your secure data.'
		)
	})

	it('respects a user-supplied Face ID permission already present in Info.plist', () => {
		const plugin = loadPlugin()
		plugin({})
		const plist: Record<string, unknown> = {
			NSFaceIDUsageDescription: 'My custom prompt.',
		}
		captured.infoPlist[0]?.({ modResults: plist })
		expect(plist.NSFaceIDUsageDescription).toBe('My custom prompt.')
	})

	it('uses the provided faceIDPermission prop', () => {
		const plugin = loadPlugin()
		plugin({}, { faceIDPermission: 'Custom prop value.' })
		const plist: Record<string, unknown> = {}
		captured.infoPlist[0]?.({ modResults: plist })
		expect(plist.NSFaceIDUsageDescription).toBe('Custom prop value.')
	})

	it('skips the Info.plist modifier when faceIDPermission is null', () => {
		const plugin = loadPlugin()
		plugin({}, { faceIDPermission: null })
		expect(captured.infoPlist).toHaveLength(0)
	})

	it('adds USE_BIOMETRIC and legacy USE_FINGERPRINT permissions', () => {
		const plugin = loadPlugin()
		plugin({})
		const manifest = { manifest: {} } as {
			manifest: { 'uses-permission'?: Array<{ $: Record<string, string> }> }
		}
		captured.manifest[0]?.({ modResults: manifest })
		const list = manifest.manifest['uses-permission']
		expect(addPermission).toHaveBeenCalledWith(
			expect.anything(),
			'android.permission.USE_BIOMETRIC'
		)
		const fingerprint = list?.find(
			(entry) =>
				entry.$['android:name'] === 'android.permission.USE_FINGERPRINT'
		)
		expect(fingerprint?.$['android:maxSdkVersion']).toBe('28')
	})

	it('is idempotent across repeated runs (no duplicate uses-permission entries)', () => {
		const plugin = loadPlugin()
		const manifestState = {
			manifest: { 'uses-permission': [] },
		} as {
			manifest: { 'uses-permission': Array<{ $: Record<string, string> }> }
		}
		plugin({})
		captured.manifest[0]?.({ modResults: manifestState })
		// Run again with the same state.
		captured.manifest[0]?.({ modResults: manifestState })
		const fingerprintEntries = manifestState.manifest['uses-permission'].filter(
			(entry) =>
				entry.$['android:name'] === 'android.permission.USE_FINGERPRINT'
		)
		expect(fingerprintEntries).toHaveLength(1)
	})

	it('writes new arch flags by default', () => {
		const plugin = loadPlugin()
		plugin({})
		const gradle: Array<{ type: 'property'; name: string; value: string }> = []
		captured.gradle[0]?.({ modResults: gradle })
		const podfile: Record<string, unknown> = {}
		captured.podfile[0]?.({ modResults: podfile })
		expect(gradle).toEqual(
			expect.arrayContaining([
				{ type: 'property', name: 'newArchEnabled', value: 'true' },
				{ type: 'property', name: 'expo.jsEngine', value: 'hermes' },
			])
		)
		expect(podfile).toMatchObject({
			new_arch_enabled: 'true',
			RCT_NEW_ARCH_ENABLED: '1',
		})
	})

	it('skips new arch flags when enableNewArchitecture is false', () => {
		const plugin = loadPlugin()
		plugin({}, { enableNewArchitecture: false })
		expect(captured.gradle).toHaveLength(0)
		expect(captured.podfile).toHaveLength(0)
	})
})
