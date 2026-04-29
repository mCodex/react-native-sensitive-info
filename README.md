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

> [!NOTE]
> **Choosing between 5.6.x and 6.x**
>
> - **Want the latest stable?** `6.x` is the current GA line. It runs on the Nitro hybrid core, auto-enforces Class 3/StrongBox biometrics, ships first-class hooks, and exposes rich metadata for every entry. Requires the Nitro toolchain (RN 0.80+, Node 18+, `react-native-nitro-modules`, New Architecture enabled).
> - **Need bridge stability?** `5.6.x` is the last pre-Nitro release on the legacy JS bridge. It still receives critical security fixes but no new features — pin to it only if you cannot enable the New Architecture yet.
> - **Staying back on 5.5.x?** You miss the Android 13 prompt fixes and the manual credential fallback restoration — migrate to `5.6.x` at minimum before planning the jump to 6.x.

## Table of contents

- [🚀 Highlights](#-highlights)
- [🧭 Platform support](#-platform-support)
- [⚙️ Installation](#-installation)
- [⚡️ Quick start](#-quick-start)
- [📚 API reference](#-api-reference)
- [🔐 Access control & metadata](#-access-control--metadata)
- [👁️ Biometrics](#️-biometrics)
- [❗ Error handling](#-error-handling)
- [🔁 Key rotation](#-key-rotation)
- [🛡️ Security model](#-security-model)
- [🌳 Tree-shaking](#-tree-shaking)
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
npm install react-native-sensitive-info react-native-nitro-modules

# or with yarn
yarn add react-native-sensitive-info react-native-nitro-modules

# or with pnpm
pnpm add react-native-sensitive-info react-native-nitro-modules
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

### 🧪 Expo setup

> [!WARNING]
> The Expo Go client does not ship native Nitro modules. Use a custom dev client (`expo run:*`) or an EAS build instead.

1. Add the plugin to your `app.json`/`app.config.js` so prebuild toggles the new architecture for both platforms:

  ```json
  {
    "expo": {
      "plugins": [
        "react-native-sensitive-info"
      ]
    }
  }
  ```

2. Regenerate the native projects after updating the config:

  ```bash
  npx expo prebuild --clean
  ```

3. Create a development client or production build that bundles the native module:

  ```bash
  npx expo run:android
  npx expo run:ios
  # or via EAS
  eas build --profile development --platform android
  ```

The plugin enables React Native's new architecture on both platforms, ensuring the `HybridSensitiveInfo` Nitro class is included during compilation.

> [!TIP]
> Use `includeValue: false` during reads when you only care about metadata—this keeps plaintext out of memory and speeds up list views.

## ⚛️ React Hooks API (Recommended)

For a modern, reactive approach with automatic memory management and loading states, use the dedicated hooks:

```tsx
import { Text, View, ActivityIndicator } from 'react-native'
import {
  useSecureStorage,
  useSecurityAvailability,
} from 'react-native-sensitive-info/hooks'

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
| `useKeyRotation()` | Rotate the master key for a service | `{ lastResult, error, isRotating, rotate, readVersion }` |

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

### 🧱 Hook architecture

Every hook in this package is a thin choreography layer over three internal primitives, so adding or auditing a hook stays a single-file change:

| Primitive | Responsibility |
| --- | --- |
| `useAsyncLifecycle` | Mount tracking + `AbortController` plumbing — _one job, no React state of its own_. |
| `useAsync` / `useAsyncQuery` | The shared "stable options → strip `skip` → memoize → fetch" recipe used by every read-only hook (`useHasSecret`, `useSecretItem`, `useSecret`, `useSecureStorage`, `useSecurityAvailability`). |
| `useMutation` | The imperative state machine (loading + error + auth-cancel handling) reused by every mutation-style hook (`useSecureOperation`, `useKeyRotation`, plus the `saveSecret`/`removeSecret`/`clearAll` helpers in `useSecureStorage`). |

Net effect: the data-fetching hooks are 25–35 lines each, mutations are ~10 lines, and the abort/cancel/error contract is identical across the surface — there is no place where a bug fix has to be repeated.

## ❗ Error handling

Every public hook returns failures as `HookError` instances. Besides `message`, each error carries:

- `operation` – the hook action that failed (for example, `useSecureStorage.saveSecret`).
- `cause` – the original native error for additional diagnostics.
- `hint` – a short suggestion shown in the example app and useful for toast copy.

Biometric or device-credential prompts cancelled by the user now surface as a friendly message (`Authentication prompt canceled by the user.`) and *do not* poison hook state. Imperative calls still reject with the raw error so you can decide how to react.

```tsx
import { Text } from 'react-native'
import { useSecureStorage } from 'react-native-sensitive-info/hooks'

function SecretsList() {
  const { items, error } = useSecureStorage({ service: 'auth', includeValues: true })

  if (error) {
    if (error.message.includes('Authentication prompt canceled')) {
      return <Text>The user dismissed biometric authentication.</Text>
    }

    return (
      <Text testID="secure-error">
        {error.message}
        {'\n'}Hint: {error.hint ?? 'Check your secure storage configuration.'}
      </Text>
    )
  }

  return items.length === 0 ? (
    <Text>No secrets stored yet.</Text>
  ) : (
    <Text>{items.map((item) => item.key).join(', ')}</Text>
  )
}
```

> [!TIP]
> When using the imperative API, look for the `[E_AUTH_CANCELED]` marker in the thrown error message to detect cancellations.

## 🔁 Key rotation

The library supports **versioned master keys** with lazy re-encryption. Each stored entry is tagged with the `keyVersion` that produced its ciphertext. Calling `rotateKeys()` bumps the active version; subsequent reads transparently re-encrypt entries that were stored under older versions.

```tsx
import { rotateKeys, getKeyVersion } from 'react-native-sensitive-info'

// Lazy rotation — new writes use v+1, reads upgrade older entries as they happen
await rotateKeys({ service: 'auth' })

// Eager rotation — walks every entry in the service and re-encrypts in one go
await rotateKeys({ service: 'auth', reEncryptEagerly: true })

// Inspect the currently active version for telemetry
const version = await getKeyVersion({ service: 'auth' })
```

Or with the hook:

```tsx
import { useKeyRotation } from 'react-native-sensitive-info/hooks'

function RotationButton() {
  const { rotate, isRotating, lastResult, error } = useKeyRotation({
    service: 'auth',
  })

  return (
    <Button
      title={isRotating ? 'Rotating…' : 'Rotate master key'}
      onPress={rotate}
      disabled={isRotating}
    />
  )
}
```

## 🛡️ Security model

| Concern | Android | iOS / Apple platforms |
| --- | --- | --- |
| Master key | Android Keystore (`AES/GCM`, StrongBox when available) | Secure Enclave-gated (P-256) + AES-GCM |
| Authentication | BiometricPrompt (Class 3 preferred), device credential fallback | LAContext / Face ID / Touch ID / Optic ID |
| At-rest integrity | AES-GCM tag **+** HMAC-SHA256 metadata tag (Keystore-bound) | AES-GCM tag **+** HMAC-SHA256 metadata tag (Keychain-stored, after-first-unlock) |
| Replay / swap defense | AES-GCM AAD bound to `service\|key\|v<version>` | Keychain `kSecAttrService` + `kSecAttrAccount` binding |
| Device-state gating | `setUnlockedDeviceRequired(true)` on every key (API 28+) | `kSecAttrAccessibleWhenUnlocked*` defaults |
| Plaintext lifetime | Buffers zeroized after encrypt/decrypt | `Data` buffers zeroized via `memset_s` |
| Key rotation | Versioned Keystore aliases, lazy re-encryption | Versioned Keychain metadata, lazy re-wrap (preserves original access control) |
| Error classification | Typed `SensitiveInfoError` subclasses via `/errors` subpath | Same |

> **Tamper detection:** every read recomputes the HMAC over the persisted `(service, key, version, accessControl, securityLevel, timestamp, ciphertext, iv)` tuple. A mismatch raises `IntegrityViolationError` (`E_INTEGRITY_VIOLATION`) **before** any biometric prompt fires, so spoofed entries can never trigger user authentication. Entries written by older library versions (no `integrityTag`) are accepted on first read and upgraded on the next write or rotation.

Typed errors can be imported from the `/errors` subpath for tree-shakeable error handling:

```tsx
import {
  isNotFoundError,
  isAuthenticationCanceledError,
  isIntegrityViolationError,
  isKeyInvalidatedError,
} from 'react-native-sensitive-info/errors'

try {
  await getItem('token', { service: 'auth' })
} catch (error) {
  if (isAuthenticationCanceledError(error)) return
  if (isKeyInvalidatedError(error)) {
    // The hardware key was invalidated (e.g. biometrics re-enrolled).
    // Delete the affected entry and ask the user to re-enter.
    await deleteItem('token', { service: 'auth' })
  }
  throw error
}
```

## 🌳 Tree-shaking

Every entry point is side-effect-free (`"sideEffects": false`) and split into focused subpaths:

| Import | Contents |
| --- | --- |
| `react-native-sensitive-info` | `setItem`, `getItem`, `hasItem`, `deleteItem`, `getAllItems`, `clearService`, `getSupportedSecurityLevels`, `rotateKeys`, `getKeyVersion`, type exports |
| `react-native-sensitive-info/hooks` | Every React hook (`useSecret`, `useSecureStorage`, `useKeyRotation`, …) |
| `react-native-sensitive-info/errors` | Typed error classes + `instanceof` predicates |

There is **no default export** — import only the helpers you use and modern bundlers (Metro, Webpack, Rollup, esbuild) will drop the rest.

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
- `accessControl` (default on writes: `secureEnclaveBiometry`) — preferred write policy; the native layer chooses the strongest supported fallback.
- `authenticationPrompt` — localized strings for biometric/device credential prompts. Forwarded for value reads/writes, ignored by silent probes such as `hasItem`, `getKeyVersion`, and metadata-only `getAllItems`.
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

Use `getSupportedSecurityLevels()` to tailor UX before prompting users. For example, disable Secure Enclave options on simulators. For richer enrollment-state detection (so you can distinguish *"hardware missing"* from *"user hasn't enrolled yet"*), see [👁️ Biometrics](#️-biometrics).

> [!TIP]
> Need to demo biometrics on a simulator? Use Xcode’s “Features → Face ID” and Android Studio’s “Fingerprints” toggles to simulate successful scans.

## 👁️ Biometrics

The library disambiguates **capability** from **enrollment** so you can render the right UX without false positives. `SecurityAvailability` exposes both a quick boolean (`biometry`) and a fine-grained `biometryStatus` enum:

| `biometryStatus` | Meaning | Recommended UX |
| --- | --- | --- |
| `'available'` | Hardware present, enrolled, currently usable. | Enable the biometric toggle. |
| `'notEnrolled'` | Hardware present but no fingerprint/face is registered. | Show a *“Set up Face ID / fingerprint”* CTA that deep-links to settings. |
| `'notAvailable'` | Missing or permanently disabled (no hardware, admin policy, passcode unset). | Hide the biometric toggle entirely. |
| `'lockedOut'` | Too many failed attempts; transiently locked. iOS only at probe time — Android surfaces lockout via `BiometricPrompt` failures. | Show *“Try again later”* and offer a `devicePasscode` fallback. |
| `'unknown'` | Probe could not classify the device. | Treat as `notAvailable` for gating; log for diagnostics. |

> Invariant: `biometry === (biometryStatus === 'available')`. Both fields come from the same native probe.

### Gate a toggle on a specific access-control policy

`canUseAccessControl(policy)` predicts whether a future `setItem` write with the requested policy will succeed on the current device. It maps the policy onto a [`SecurityAvailability`](#-access-control--metadata) snapshot — pure TS, no native call — but if you don't pass a snapshot it first fetches one via `getSupportedSecurityLevels()`. Pass the snapshot you already hold (e.g. from `useSecurityAvailability`) to skip that round-trip:

```ts
import { canUseAccessControl, setItem } from 'react-native-sensitive-info'

if (await canUseAccessControl('secureEnclaveBiometry')) {
  await setItem('session', token, { accessControl: 'secureEnclaveBiometry' })
} else {
  // Graceful fallback so the user can still sign in.
  await setItem('session', token, { accessControl: 'devicePasscode' })
}
```

If you already hold a snapshot from `useSecurityAvailability`, use the synchronous variant inside render:

```tsx
import { canUseAccessControlSync } from 'react-native-sensitive-info'
import { useSecurityAvailability } from 'react-native-sensitive-info/hooks'

const { data: caps } = useSecurityAvailability()
const canEnable = caps ? canUseAccessControlSync('secureEnclaveBiometry', caps) : false
```

### Auto-refresh when the user returns from system settings

Users commonly leave the app to enroll a fingerprint and come back. Opt into foreground auto-refresh so the toggle reflects the new state without a manual `refetch()`:

```tsx
const { data: caps } = useSecurityAvailability({ refreshOnForeground: true })

if (caps?.biometryStatus === 'notEnrolled') {
  return <SetupFaceIdCta onPress={() => Linking.openSettings()} />
}
```

The hook subscribes to `AppState` only when the option is enabled, debounces back-to-back `active` transitions (~500 ms), and unsubscribes on unmount.

### React to enrollment changes

`useBiometryStatusWatcher` is a transition-only callback (fires once per actual `BiometryStatus` change, never on every render):

```tsx
import { useBiometryStatusWatcher } from 'react-native-sensitive-info/hooks'

useBiometryStatusWatcher((next, previous) => {
  analytics.track('biometry_status_changed', { from: previous, to: next })
  if (previous === 'notEnrolled' && next === 'available') showToast('Face ID is ready.')
})
```

It lives in its own module, so apps that don’t need transition tracking don’t pay for it (`sideEffects: false` + named exports keep tree-shaking honest).

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
