# Expo

`react-native-sensitive-info` contains native code. Use it in an Expo development or production
build on iOS or Android, with `react-native-nitro-modules` installed. It does not run in Expo Go
unless Expo Go itself bundles this native module. There is no web or Windows JavaScript fallback.
macOS is declared in the podspec but is not covered by the current validation matrix.

The example app remains a bare React Native app. Its RN 0.88.1 / Nitro 0.37.1 iOS and Android
builds pass locally. Expo SDK 58.0.21 publishes a React Native 0.88.1 / React 19.3.0 mapping,
which is a matching candidate for an Expo consumer. A full Expo prebuild/EAS consumer build has
not been run, so no Expo SDK compatibility range is claimed yet.

## Install

Install both packages, then create a development build. Expo Go is not sufficient for a native
Nitro module.

```bash
npx expo install react-native-sensitive-info
npm install react-native-nitro-modules
```

Add the config plugin to `app.json` or `app.config.ts`:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-sensitive-info",
        {
          "faceIDPermission": "Authenticate to unlock your account."
        }
      ]
    ]
  }
}
```

The plugin adds the iOS Face ID usage string only when the app has not set one. On Android it
adds `USE_BIOMETRIC` and the legacy `USE_FINGERPRINT` permission. It enables the New Architecture
by default, as Nitro requires it, and leaves the app's JavaScript engine setting unchanged. Set
`enableNewArchitecture: false` only when the app configures the required architecture flags
elsewhere.

After changing native dependencies or plugin options, regenerate native projects when that is
how the app manages them, then rebuild the development client:

```bash
npx expo prebuild
npx expo run:ios
# or
npx expo run:android
```

Do not run `prebuild --clean` in a project with hand-maintained native files unless those changes
are backed up or the project is disposable. EAS development and production builds use the same
native setup; a JavaScript reload alone cannot add a native module to an already-built app.

## Option reference

| Option | Type | Default | Behavior |
| --- | --- | --- | --- |
| `faceIDPermission` | `string \| null` | `Authenticate to access your secure data.` | Fills `NSFaceIDUsageDescription` only when it is missing. `null` skips the modifier. |
| `enableNewArchitecture` | `boolean` | `true` | Writes the Android and iOS New Architecture flags. Set `false` only if another app config owns them. |

The plugin validates these option types and can be applied repeatedly without duplicating its
Android permissions. A project with committed `ios/` or `android/` directories should apply the
equivalent settings through its existing native ownership workflow.

## Runtime and support limits

- **Expo Go:** unsupported because the native Nitro implementation is not bundled there. Verify
  import-time and call-time errors against the exact Expo Go version before documenting a
  particular failure message.
- **Web, Windows, and macOS:** unsupported by this package. There is no plaintext storage
  fallback.
- **SDK compatibility:** use the React Native and React versions bundled with the chosen Expo
  SDK. The candidate SDK 58 mapping is not a substitute for a prebuild and native consumer build.
- **Bare React Native:** keep the Nitro dependency and New Architecture enabled, add the iOS
  Face ID usage string when needed, and rebuild after native dependency changes.
