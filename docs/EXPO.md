# Expo

## Compatibility matrix

| Library version | Expo SDK | React Native | Notes                                                  |
| --------------- | -------- | ------------ | ------------------------------------------------------ |
| `6.0.x` (GA)    | 52+      | 0.80–0.85    | Nitro Modules, New Architecture only. Current stable.  |
| `5.6.x`         | 49–51    | 0.71–0.74    | Legacy bridge build, maintenance mode (security only). |

`react-native-sensitive-info` ships native code, so it cannot run inside **Expo Go**. You need
either a **custom Dev Client** (`npx expo run:ios` / `npx expo run:android`) or an **EAS Build**.

When the native module is unavailable at runtime (typically Expo Go), every API throws a
`SensitiveInfoError` with a hint that points to the Dev Client / EAS workflow.

## Installation

```bash
npx expo install react-native-sensitive-info
```

Add the plugin to your `app.json` / `app.config.ts`:

```json
{
	"expo": {
		"plugins": [
			[
				"react-native-sensitive-info",
				{
					"faceIDPermission": "Authenticate to unlock your account.",
					"enableNewArchitecture": true
				}
			]
		]
	}
}
```

### Plugin options

| Prop                    | Type             | Default                                      | Effect                                                                                                                                                                                                                              |
| ----------------------- | ---------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `faceIDPermission`      | `string \| null` | `"Authenticate to access your secure data."` | When a string is provided, it is written to `NSFaceIDUsageDescription` if the key is missing; a pre-existing value in your Info.plist is always preserved. Pass `null` to skip the modifier entirely (e.g. another plugin owns the key). |
| `enableNewArchitecture` | `boolean`        | `true`                                       | Writes `newArchEnabled` (Android) and `RCT_NEW_ARCH_ENABLED` (iOS) flags.                                                                                                                                                          |

The plugin also adds the following Android permissions automatically:

- `android.permission.USE_BIOMETRIC` (API 28+)
- `android.permission.USE_FINGERPRINT` with `android:maxSdkVersion="28"` (legacy fallback)

## Generating the native projects

After adding the plugin:

```bash
npx expo prebuild --clean   # Regenerates ios/ and android/ with the plugin applied
npx expo run:ios            # or run:android
```

For EAS Build:

```bash
eas build --profile development --platform ios
```

## Troubleshooting

- **"native module is not available"** at runtime — you are running in Expo Go. Switch to a
  Dev Client.
- **Face ID prompt has no usage string** — confirm `NSFaceIDUsageDescription` is in the
  rendered `ios/<app>/Info.plist` after `prebuild`.
- **Biometric APIs return `software` security level on Android** — confirm the device is
  enrolled and that `USE_BIOMETRIC` was written to the rendered `AndroidManifest.xml`.
