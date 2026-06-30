# react-native-sensitive-info

[![npm version](https://img.shields.io/npm/v/react-native-sensitive-info)](https://www.npmjs.com/package/react-native-sensitive-info)
[![npm downloads](https://img.shields.io/npm/dm/react-native-sensitive-info)](https://www.npmjs.com/package/react-native-sensitive-info)
[![Coverage](https://img.shields.io/badge/coverage-92%25-brightgreen)](https://github.com/mcodex/react-native-sensitive-info)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Hardware-backed secure storage for React Native. Secrets are encrypted with AES-GCM, gated by biometrics or device credentials, and stored in the system Keychain (iOS) or Android Keystore behind a Promise-based API and React hooks.

> [!NOTE]
> **Upgrading from v5?** See [MIGRATION.md](./docs/MIGRATION.md). v6 requires the New Architecture (RN 0.76+) and `react-native-nitro-modules`. Windows support was removed.

## Table of contents

- [🧭 Platform support](#-platform-support)
- [⚙️ Installation](#️-installation)
- [⚡️ Quick start](#️-quick-start)
- [⚛️ React Hooks API](#️-react-hooks-api-recommended)
- [📚 API reference](#-api-reference)
- [🛡️ Security](#️-security)
- [🌳 Tree-shaking](#-tree-shaking)
- [🎮 Example app](#-example-app)
- [🛠️ Development](#️-development)
- [🩺 Troubleshooting](#-troubleshooting)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## 🧭 Platform support

| Platform | Minimum | Notes |
| --- | --- | --- |
| React Native | 0.76.0 | New Architecture + `react-native-nitro-modules` required. |
| iOS | 13.0 | Add `NSFaceIDUsageDescription` to `Info.plist` for biometrics. |
| macOS | 11.0 | Catalyst and native macOS via system keychain. |
| visionOS | 1.0 | Secure Enclave-backed; biometric UX adapts to visionOS. |
| watchOS | 7.0 | Paired-device auth; storage syncs through watchOS keychain. |
| Android | API 23 | StrongBox requires API 28+; falls back to strongest available authenticator. |

## ⚙️ Installation

```bash
npm install react-native-sensitive-info react-native-nitro-modules
# yarn add react-native-sensitive-info react-native-nitro-modules
# pnpm add react-native-sensitive-info react-native-nitro-modules
```

No manual linking required — Nitro handles autolinking.

### 🍏 iOS

Run `pod install`, then add to `Info.plist` if you use biometric prompts:

```xml
<key>NSFaceIDUsageDescription</key>
<string>Face ID is used to unlock secrets stored in the secure enclave.</string>
```

### 🤖 Android

Add to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
<uses-permission android:name="android.permission.USE_FINGERPRINT" />
```

### 🧪 Expo

> [!WARNING]
> Expo Go does not include native Nitro modules. Use a custom dev client or an EAS build.

Add the plugin to `app.json`, then run `npx expo prebuild --clean`:

```json
{
  "expo": {
    "plugins": ["react-native-sensitive-info"]
  }
}
```

For a full Expo walkthrough see [EXPO.md](./docs/EXPO.md).

## ⚡️ Quick start

```tsx
import { setItem, getItem, deleteItem } from 'react-native-sensitive-info'

// Write — uses the strongest available security policy by default
await setItem('session-token', 'abc123', { service: 'auth' })

// Read — returns value + metadata
const item = await getItem('session-token', { service: 'auth' })
console.log(item?.value)                  // 'abc123'
console.log(item?.metadata.securityLevel) // e.g. 'secureEnclave'

// Remove
await deleteItem('session-token', { service: 'auth' })
```

Building a component? The [hooks API](#️-react-hooks-api-recommended) handles loading states, cleanup, and error boundaries.

## ⚛️ React Hooks API (Recommended)

```tsx
import { Text, View, ActivityIndicator } from 'react-native'
import {
  useSecureStorage,
  useSecurityAvailability,
} from 'react-native-sensitive-info/hooks'

function SecretsView() {
  const { items, isLoading, error, saveSecret, removeSecret } =
    useSecureStorage({ service: 'myapp', includeValues: true })
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
      <Text>Biometry: {capabilities?.biometry ? 'available' : 'unavailable'}</Text>
    </View>
  )
}
```

| Hook | Use case |
| --- | --- |
| `useSecureStorage()` | List, add, and remove all secrets in a service. |
| `useSecret()` | Fetch a single secret with read/write mutations. |
| `useHasSecret()` | Lightweight existence check (no decryption). |
| `useSecurityAvailability()` | Query device capabilities (auto-cached). |
| `useKeyRotation()` | Rotate the master key for a service. |
| `useBiometryStatusWatcher()` | Subscribe to biometric enrollment-state transitions. |

All hooks auto-cancel in-flight requests on unmount. For advanced patterns and best practices see [HOOKS.md](./docs/HOOKS.md).

## 📚 API reference

| Method | Description |
| --- | --- |
| `setItem(key, value, options?)` | Write a secret using the strongest available security policy. |
| `getItem(key, options?)` | Read a secret and its metadata. Pass `includeValue: false` to skip the payload. |
| `hasItem(key, options?)` | Check whether a secret exists (no biometric prompt). |
| `deleteItem(key, options?)` | Remove a secret. Returns `true` if something was deleted. |
| `getAllItems(options?)` | List all secrets in a service. |
| `clearService(options?)` | Remove every secret in a service namespace. |
| `getSupportedSecurityLevels()` | Snapshot of device capabilities (biometrics, Secure Enclave, StrongBox, …). |
| `canUseAccessControl(policy)` | Check whether a given access-control policy is supported on this device. |
| `rotateKeys(options?)` | Bump the active key version; subsequent reads transparently re-encrypt older entries. |

**Common options:**

| Option | Default | Description |
| --- | --- | --- |
| `service` | bundle ID / `'default'` | Logical namespace for secrets. |
| `accessControl` | `'secureEnclaveBiometry'` | Preferred write policy; native layer picks the strongest supported fallback. |
| `authenticationPrompt` | — | Localized strings for biometric / device-credential prompts. |
| `iosSynchronizable` | `false` | Sync via iCloud Keychain. |
| `keychainGroup` | — | Custom Keychain access group. |

**Errors** are typed — import predicates from `react-native-sensitive-info/errors`:

```tsx
import {
  isAuthenticationCanceledError,
  isKeyInvalidatedError,
  isIntegrityViolationError,
} from 'react-native-sensitive-info/errors'
```

## 🛡️ Security

Every secret is encrypted with **AES-GCM** and bound to a hardware-protected key. Each entry carries an **HMAC-SHA256 integrity tag** recomputed on every read; a mismatch raises `IntegrityViolationError` before any biometric prompt fires.

For the full cryptographic model — key derivation, AAD binding, replay defense, and threat classification — see [THREAT_MODEL.md](./docs/THREAT_MODEL.md).

## 🌳 Tree-shaking

All entry points are side-effect-free (`"sideEffects": false`). Import only what you use:

| Subpath | Contents |
| --- | --- |
| `react-native-sensitive-info` | Core API (`setItem`, `getItem`, `hasItem`, `deleteItem`, `getAllItems`, `clearService`, `rotateKeys`, …) |
| `react-native-sensitive-info/hooks` | React hooks (`useSecureStorage`, `useSecret`, `useKeyRotation`, …) |
| `react-native-sensitive-info/errors` | Typed error classes and `instanceof` predicates |

## 🎮 Example app

```bash
cd example && yarn install

yarn ios      # iOS
yarn android  # Android
```

## 🛠️ Development

```bash
yarn install    # Install dependencies
yarn codegen    # Regenerate Nitro bindings
yarn typecheck  # Type-check sources
yarn build      # Build distributable packages
```

## 🩺 Troubleshooting

- **Biometric prompt never appears** — use `canUseAccessControl(policy)` to check before writing and fall back to `devicePasscode` if needed.
- **`authentication failed` on simulator** — Secure Enclave and StrongBox are unavailable on simulators. Validate biometric policies on physical hardware.
- **`E_AUTH_CANCELED` in error message** — the user dismissed the prompt. Handle gracefully; hook state is not poisoned by cancellations.
- **Undefined symbol on iOS** — re-run `pod install` after upgrading to v6.

## 🤝 Contributing

Contributions are welcome!

- 🐛 **Bugs** — Open an issue with a minimal reproduction. Security vulnerabilities should be reported privately — see [SECURITY.md](./SECURITY.md).
- 💡 **New features** — Open an issue first to align on scope before writing code.
- 🔀 **Pull requests** — Run `yarn test` and `yarn typecheck` before submitting. Keep changes focused and reference the relevant issue.

Please review [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) before contributing.

## 📄 License

MIT © [Mateus Andrade](https://github.com/mateusandrade)
