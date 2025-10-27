# react-native-sensitive-info

[![npm version](https://img.shields.io/npm/v/react-native-sensitive-info)](https://www.npmjs.com/package/react-native-sensitive-info)
[![npm downloads](https://img.shields.io/npm/dm/react-native-sensitive-info)](https://www.npmjs.com/package/react-native-sensitive-info)
[![Coverage](https://img.shields.io/badge/coverage-92%25-brightgreen)](https://github.com/mcodex/react-native-sensitive-info)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Modern secure storage for React Native, powered by Nitro Modules. Version 6 ships a new headless API surface, stronger security defaults, and a fully revamped example app.

> [!TIP]
> Need the TL;DR? Jump to [🚀 Highlights](#-highlights) and [⚙️ Installation](#-installation) to get productive in under five minutes.

> [!WARNING]
> Version 6 drops Windows support. The module now targets Android plus the Apple platforms (iOS, macOS, visionOS, watchOS).

> [!IMPORTANT]
> This README tracks the in-progress v6 work on `master`. For the stable legacy release, switch to the `v5.x` branch.

> [!NOTE]
> **Choosing between 5.6.0 and 6.x**
>
> - **Need bridge stability?** `5.6.0` is the last pre-Nitro release with the latest biometric fixes, docs, and Android namespace cleanups. It’s drop-in for any `5.5.x` app already running on React Native’s Fabric architecture, but you keep the legacy JS bridge overhead—Paper is no longer supported.
> - **Ready for Nitro speed?** `6.x` swaps in the Nitro hybrid core, auto-enforces Class 3/StrongBox biometrics, and ships the refreshed sample app plus richer metadata. Upgrade when you can adopt the Nitro toolchain (RN 0.76+, Node 18+, `react-native-nitro-modules`).
> - **Staying back on 5.5.x?** You remain on the legacy (Paper) architecture and miss the Android 13 prompt fixes, the manual credential fallback restoration, and the new docs—migrate to `5.6.0` at minimum before planning the Nitro jump.

## Table of contents

- [🚀 Highlights](#-highlights)
- [🧭 Platform support](#-platform-support)
- [⚙️ Installation](#-installation)
- [⚡️ Quick start](#-quick-start)
- [📚 API reference](#-api-reference)
- [🔐 Access control & metadata](#-access-control--metadata)
- [🧪 Simulators and emulators](#-simulators-and-emulators)
- [📈 Performance benchmarks](#-performance-benchmarks)
- [🎮 Example application](#-example-application)
- [🛠️ Development](#-development)
- [🩺 Troubleshooting](#-troubleshooting)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## 🚀 Highlights

- Headless Nitro hybrid object with a simple Promise-based API (`setItem`, `getItem`, `hasItem`, `getAllItems`, `clearService`).
- Automatic security negotiation: locks onto Secure Enclave (iOS) or Class 3 / StrongBox biometrics (Android) with graceful fallbacks when hardware is limited.
- Unified metadata reporting (security level, backend, access control, timestamp) for every stored secret.
- Friendly example app showcasing prompts, metadata inspection, and per-platform capability detection.
- First-class TypeScript definitions and tree-shakeable distribution via `react-native-builder-bob`.

> [!NOTE]
> All APIs are fully typed. Hover over any option in your editor to explore the metadata surface without leaving VS Code.

## 🧭 Platform support

| Platform | Minimum OS | Notes |
| --- | --- | --- |
| React Native | 0.76.0 | Requires `react-native-nitro-modules` for Nitro hybrid core. |
| iOS | 13.0 | Requires Face ID usage string when biometrics are enabled. |
| macOS | 11.0 (Big Sur) | Supports Catalyst and native macOS builds backed by the system keychain. |
| visionOS | 1.0 | Uses the shared Secure Enclave policies; prompts adapt to the visionOS biometric UX. |
| watchOS | 7.0 | Relies on paired-device authentication; storage syncs through the watchOS keychain. |
| Android | API 23 (Marshmallow) | StrongBox detection requires API 28+; biometrics fall back to device credential when unavailable. |
| Windows | ❌ | Removed in v6. Earlier versions may still work but are no longer maintained. |

## ⚙️ Installation

```bash
# with npm
npm install react-native-sensitive-info@next react-native-nitro-modules

# or with yarn
yarn add react-native-sensitive-info@next react-native-nitro-modules

# or with pnpm
pnpm add react-native-sensitive-info@next react-native-nitro-modules
```

No manual linking is required. Nitro handles platform registration via autolinking.

### 🍏 iOS setup

- Install pods from the root of your project:

	```bash
	cd ios && pod install
	```

- Add a Face ID usage description to your app’s `Info.plist` if you intend to use biometric prompts (already present in the example app):

	```xml
	<key>NSFaceIDUsageDescription</key>
	<string>Face ID is used to unlock secrets stored in the secure enclave.</string>
	```

### 🤖 Android setup

- Ensure the following permissions are present in your `AndroidManifest.xml`:

	```xml
	<uses-permission android:name="android.permission.USE_BIOMETRIC" />
	<uses-permission android:name="android.permission.USE_FINGERPRINT" />
	```

- If you rely on hardware-backed keystores, verify the device/emulator supports the biometrics you request.

> [!TIP]
> Use `includeValue: false` during reads when you only care about metadata—this keeps plaintext out of memory and speeds up list views.

## ⚛️ React Hooks API (Recommended)

For a modern, reactive approach with automatic memory management and loading states, use the dedicated hooks:

```tsx
import { Text, View, ActivityIndicator } from 'react-native'
import {
  useSecureStorage,
  useSecurityAvailability,
} from 'react-native-sensitive-info'

// Use hooks directly in any component - no provider needed!
function YourComponent() {
  // Fetch and manage all secrets in a service (with CRUD)
  const {
    items,
    isLoading,
    error,
    saveSecret,
    removeSecret,
  } = useSecureStorage({ service: 'myapp', includeValues: true })

  // Query device security capabilities (cached automatically)
  const { data: capabilities } = useSecurityAvailability()

  if (isLoading) return <ActivityIndicator />
  if (error) return <Text>Error: {error.message}</Text>

  return (
    <View>
      {items.map(item => (
        <Text key={item.key}>
          {item.key}: {item.value} ({item.metadata.securityLevel})
        </Text>
      ))}
      <Text>
        Biometry available: {capabilities?.biometry ? 'Yes' : 'No'}
      </Text>
    </View>
  )
}
```

### Key hooks

| Hook | Use Case | Returns |
| --- | --- | --- |
| `useSecureStorage()` | Manage all secrets in a service (list, add, remove) | `{ items, isLoading, error, saveSecret, removeSecret, clearAll, refreshItems }` |
| `useSecretItem()` | Fetch a single secret | `{ data, isLoading, error, refetch }` |
| `useSecret()` | Single secret + mutations | `{ data, isLoading, error, saveSecret, deleteSecret, refetch }` |
| `useHasSecret()` | Check if secret exists (lightweight) | `{ data (boolean), isLoading, error, refetch }` |
| `useSecurityAvailability()` | Query device capabilities (cached) | `{ data, isLoading, error, refetch }` |

### Best practices

- **Memory leak prevention** — All hooks automatically cancel requests and clean up resources on unmount.
- **Conditional fetching** — Use `skip: true` to prevent unnecessary operations:

  ```tsx
  const { data } = useSecretItem('token', { skip: !isAuthenticated })
  ```

- **Optimize list views** — Fetch metadata only to avoid decryption overhead:

  ```tsx
  const { items } = useSecureStorage({ includeValues: false })
  ```

- **Share capabilities** — Query independently and results are cached automatically:

  ```tsx
  // Each component queries independently (results cached automatically)
  const { data: capabilities1 } = useSecurityAvailability()
  const { data: capabilities2 } = useSecurityAvailability()
  // Same cached result, no duplicate native calls
  ```

For comprehensive examples and advanced patterns, see [`HOOKS.md`](./HOOKS.md).

## Imperative API

```tsx
import React, { useEffect } from 'react'
import { SensitiveInfo, setItem, getItem } from 'react-native-sensitive-info'

export function SecureTokenExample() {
	useEffect(() => {
		async function bootstrap() {
			await setItem('session-token', 'super-secret', {
				service: 'auth',
				accessControl: 'secureEnclaveBiometry',
				authenticationPrompt: {
					title: 'Authenticate to unlock your session',
					cancel: 'Cancel',
				},
			})

			const item = await getItem('session-token', {
				service: 'auth',
				includeValue: false,
			})

			console.log('Stored metadata', item?.metadata)
		}

		void bootstrap()
	}, [])

	return null
}

// Optionally access the singleton hybrid object directly
void SensitiveInfo.clearService({ service: 'auth' })
```

All functions live at the top level export and return Promises.

| Method | Signature | Description |
| --- | --- | --- |
| `setItem` | `(key, value, options?) => Promise<MutationResult>` | Writes a secret using the strongest available security policy. |
| `getItem` | `(key, options?) => Promise<SensitiveInfoItem \\| null>` | Reads a secret and metadata. Pass `includeValue: false` to skip payloads. |
| `hasItem` | `(key, options?) => Promise<boolean>` | Checks whether a secret exists for the given key. |
| `deleteItem` | `(key, options?) => Promise<boolean>` | Removes a secret. Returns `true` if something was deleted. |
| `getAllItems` | `(options?) => Promise<SensitiveInfoItem[]>` | Enumerates all secrets scoped to a service. Use `includeValues` to return decrypted payloads. |
| `clearService` | `(options?) => Promise<void>` | Removes every secret within a service namespace. |
| `getSupportedSecurityLevels` | `() => Promise<SecurityAvailability>` | Returns a snapshot of platform capabilities (secure enclave, biometrics, etc.). |

### 🧩 Options shared by all operations

- `service` (default: bundle identifier or `default`) — logical namespace for secrets.
- `accessControl` (default: `secureEnclaveBiometry`) — preferred policy; the native layer chooses the strongest supported fallback.
- `authenticationPrompt` — localized strings for biometric/device credential prompts.
- `iosSynchronizable` — enable iCloud Keychain sync.
- `keychainGroup` — custom Keychain access group.

Android automatically enforces Class 3 biometrics whenever the hardware supports them, falling back to the strongest available authenticator on older devices.

See `src/sensitive-info.nitro.ts` for full TypeScript definitions.

## 🔐 Access control & metadata

`MutationResult` and `SensitiveInfoItem.metadata` surface how a value was stored:

- **Security levels** — `secureEnclave`, `strongBox`, `biometry`, `deviceCredential`, `software`.
- **Backends** — `keychain`, `androidKeystore`, `encryptedSharedPreferences`.
- **Access policies** — `secureEnclaveBiometry`, `biometryCurrentSet`, `biometryAny`, `devicePasscode`, `none`.
- **Timestamp** — UNIX seconds when the entry was last written.

Use `getSupportedSecurityLevels()` to tailor UX before prompting users. For example, disable Secure Enclave options on simulators.

> [!TIP]
> Need to demo biometrics on a simulator? Use Xcode’s “Features → Face ID” and Android Studio’s “Fingerprints” toggles to simulate successful scans.

## 🧪 Simulators and emulators

- iOS simulators do not offer Secure Enclave hardware. Biometric prompts usually fall back to a passcode dialog.
- Android emulators rarely provide StrongBox. Depending on the system image, biometric APIs may be stubbed.
- The example app displays these limitations prominently under “Simulators & emulators”.

> [!IMPORTANT]
> Simulators are great for flows, but only physical hardware validates secure hardware policies such as StrongBox and Secure Enclave. Run your final regression tests on devices before shipping.

Always validate security behavior on the physical devices you ship to customers.

## 🎮 Example application

Explore the full feature set with the bundled example app. It showcases capability detection, metadata inspection, and error surface normalization for every API call.

- The access-control selector now projects live device capabilities, greying out policies that require unavailable hardware and auto-picking the strongest viable guard.
- Android Class 3 biometrics are applied automatically—no more manual toggle—while older devices fall back to the most secure authenticator they expose.

> [!TIP]
> Prefer Expo? The same Nitro module works inside bare Expo projects—just install via `expo install` and run the commands below from `example/`.

## 📈 Performance benchmarks

The Nitro rewrite in v6 removes the classic React Native bridge bottleneck that previous releases (v5 and earlier) relied on.

| Operation (10k iterations) | v5 classic bridge | v6 Nitro hybrid | Improvement |
| --- | --- | --- | --- |
| `setItem` (string payload, metadata write) | 812 ms | 247 ms | 3.3× faster |
| `getItem` (with value) | 768 ms | 231 ms | 3.3× faster |
| `hasItem` | 544 ms | 158 ms | 3.4× faster |
| `getAllItems` (25 entries, metadata only) | 612 ms | 204 ms | 3.0× faster |

**Benchmark setup**
- Hardware: iPhone 15 Pro (iOS 18.0) for iOS numbers; Pixel 8 (Android 15, Tensor G3) for Android numbers.
- Method: repeated each operation 10,000 times in release mode, averaged across three runs, measured using the example app’s built-in instrumentation harness.
- Notes: Results focus on bridge overhead; actual wall-clock time may be dominated by secure hardware latency for certain access controls.

On both platforms, Nitro’s C++/Swift/Kotlin hybrid path keeps the secure storage calls close to their native implementations, cutting marshalling overhead and reducing GC pressure compared to the legacy JS module façade.

An interactive demo lives under `example`. It showcases every API surface, metadata inspection, and capability refresh.

```bash
cd example
yarn install

# iOS
yarn ios

# Android
yarn android
```

The example includes required permissions and the `NSFaceIDUsageDescription` string out of the box (see `example/android/app/src/main/AndroidManifest.xml` and `example/ios/SensitiveInfoExample/Info.plist`).

> [!TIP]
> Run `yarn codegen --watch` in one terminal and your platform build in another to regenerate bindings automatically during native development.

## 🛠️ Development

```bash
# Install dependencies
yarn install

# Regenerate Nitro bindings and build outputs
yarn codegen

# Type-check TypeScript sources
yarn typecheck

# Build the distributable packages
yarn build
```

The project uses Nitrogen for code generation and `react-native-builder-bob` for packaging CommonJS/ESM bundles.

## 🩺 Troubleshooting

- **Biometric prompt never appears** — verify the device supports the requested access control. Fallback to `devicePasscode` where appropriate.
- **`authentication failed` errors on simulator** — expected when Secure Enclave or biometrics are not available. Test on hardware.
- **Undefined symbol on iOS** — ensure `pod install` was run after upgrading to v6.
- **Windows build errors** — Windows is no longer supported. Pin to v5 if you must target that platform.

## 🤝 Contributing

PRs and issue reports are welcome. Please open an issue before introducing breaking API changes so we can discuss the best upgrade path.

## 📄 License

MIT © [Mateus Andrade](https://github.com/mateusandrade)
