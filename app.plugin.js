/**
 * Expo config plugin for react-native-sensitive-info.
 *
 * Configures:
 *   - New Architecture flags for both platforms
 *   - `NSFaceIDUsageDescription` in iOS Info.plist (so Face ID prompts include a usage string)
 *   - `USE_BIOMETRIC` and (legacy) `USE_FINGERPRINT` permissions in AndroidManifest.xml
 *
 * @typedef {object} SensitiveInfoPluginProps
 * @property {string | null} [faceIDPermission] - Override for `NSFaceIDUsageDescription`.
 *     Defaults to `"Authenticate to access your secure data."`. Pass `null` to skip the modifier
 *     entirely (useful when another plugin owns the key).
 * @property {boolean} [enableNewArchitecture] - When `false`, skips RN New Arch flags.
 *     Defaults to `true`.
 *
 * @param {import('@expo/config-plugins').ExpoConfig} config
 * @param {SensitiveInfoPluginProps} [props]
 */
const {
	AndroidConfig,
	createRunOncePlugin,
	withAndroidManifest,
	withGradleProperties,
	withInfoPlist,
	withPodfileProperties,
} = require('@expo/config-plugins')

const pkg = require('./package.json')

const DEFAULT_FACE_ID_PERMISSION = 'Authenticate to access your secure data.'

function ensureGradleProperty(gradleProperties, name, value) {
	const property = gradleProperties.find((item) => item.name === name)
	if (property) {
		property.value = value
	} else {
		gradleProperties.push({ type: 'property', name, value })
	}
}

function withAndroidNewArchitecture(config) {
	return withGradleProperties(config, (modConfig) => {
		ensureGradleProperty(modConfig.modResults, 'newArchEnabled', 'true')
		ensureGradleProperty(modConfig.modResults, 'expo.jsEngine', 'hermes')
		return modConfig
	})
}

function withIosNewArchitecture(config) {
	return withPodfileProperties(config, (modConfig) => {
		modConfig.modResults.new_arch_enabled = 'true'
		modConfig.modResults.RCT_NEW_ARCH_ENABLED = '1'
		return modConfig
	})
}

function withFaceIDUsageDescription(config, faceIDPermission) {
	if (faceIDPermission === null) return config
	return withInfoPlist(config, (modConfig) => {
		// Respect any user-set value (including empty strings); only fill when truly missing.
		if (modConfig.modResults.NSFaceIDUsageDescription == null) {
			modConfig.modResults.NSFaceIDUsageDescription =
				faceIDPermission ?? DEFAULT_FACE_ID_PERMISSION
		}
		return modConfig
	})
}

function withBiometricPermissions(config) {
	return withAndroidManifest(config, (modConfig) => {
		const manifest = modConfig.modResults
		// USE_BIOMETRIC for API 28+. addUsesPermission is idempotent.
		AndroidConfig.Permissions.addPermission(
			manifest,
			'android.permission.USE_BIOMETRIC'
		)

		// USE_FINGERPRINT for API ≤ 28. Manually upsert so we can pin maxSdkVersion=28.
		manifest.manifest['uses-permission'] ??= []
		const list = manifest.manifest['uses-permission']
		const existing = list.find(
			(entry) =>
				entry.$ &&
				entry.$['android:name'] === 'android.permission.USE_FINGERPRINT'
		)
		if (existing) {
			existing.$['android:maxSdkVersion'] = '28'
		} else {
			list.push({
				$: {
					'android:name': 'android.permission.USE_FINGERPRINT',
					'android:maxSdkVersion': '28',
				},
			})
		}
		return modConfig
	})
}

function withSensitiveInfoExpo(config, props = {}) {
	const enableNewArchitecture = props.enableNewArchitecture !== false
	if (enableNewArchitecture) {
		config = withAndroidNewArchitecture(config)
		config = withIosNewArchitecture(config)
	}
	config = withFaceIDUsageDescription(config, props.faceIDPermission)
	config = withBiometricPermissions(config)
	return config
}

module.exports = createRunOncePlugin(
	withSensitiveInfoExpo,
	pkg.name,
	pkg.version
)
