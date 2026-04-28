import type { ConfigPlugin } from '@expo/config-plugins'

/** Options accepted by the `react-native-sensitive-info` Expo config plugin. */
export interface SensitiveInfoPluginProps {
	/**
	 * Override for `NSFaceIDUsageDescription` injected into the iOS Info.plist.
	 *
	 * @defaultValue `"Authenticate to access your secure data."`
	 * @remarks Pass `null` to skip the modifier entirely (useful when another plugin owns the key).
	 *          A user-set value in the source Info.plist is always preserved.
	 */
	readonly faceIDPermission?: string | null
	/**
	 * When `false`, skips writing React Native New Architecture flags
	 * (`newArchEnabled`, `RCT_NEW_ARCH_ENABLED`).
	 *
	 * @defaultValue `true`
	 */
	readonly enableNewArchitecture?: boolean
}

declare const plugin: ConfigPlugin<SensitiveInfoPluginProps | undefined>
export default plugin
