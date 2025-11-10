# react-native-sensitive-info

[![npm version](https://img.shields.io/npm/v/react-native-sensitive-info)](https://www.npmjs.com/package/react-native-sensitive-info)
[![npm downloads](https://img.shields.io/npm/dm/react-native-sensitive-info)](https://www.npmjs.com/package/react-native-sensitive-info)
[![Coverage](https://img.shields.io/badge/coverage-92%25-brightgreen)](https://github.com/mcodex/react-native-sensitive-info)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Modern secure storage for React Native. Type-safe, hardware-backed encryption with biometric protection on iOS and Android.

- ⚡ **Nitro Modules** — 3.3× faster than v5's React Native bridge
- 🔒 **Hardware Security** — Secure Enclave (iOS) + StrongBox (Android) with automatic fallbacks
- 📱 **Hooks & Imperative** — Reactive hooks for UI, imperative API for custom control
- 🔑 **Key Rotation** — Automatic zero-downtime re-encryption with versioning
- ✅ **Fully Typed** — Type-safe error codes, branded types, complete TypeScript support
- 🧪 **Well Tested** — 132 tests, 90%+ core coverage

## Installation

```bash
yarn add react-native-sensitive-info@next react-native-nitro-modules
cd ios && pod install
```

## Quick Start

### React Hooks

```tsx
import { useSecureStorage } from 'react-native-sensitive-info'

function SecureComponent() {
  const { items, saveSecret, removeSecret } = useSecureStorage({ 
    service: 'auth' 
  })

  return (
    <>
      {items.map(item => (
        <Text key={item.key}>{item.key}</Text>
      ))}
      <Button onPress={() => saveSecret('key', 'value')} />
    </>
  )
}
```

### Imperative API

```tsx
import { setItem, getItem } from 'react-native-sensitive-info'

// Save a secret
await setItem('auth-token', 'secret-value', { service: 'auth' })

// Read it back
const item = await getItem('auth-token', { service: 'auth' })
console.log(item.value)
```

## Documentation

| Guide | Purpose |
| --- | --- |
| **[📖 API Reference](./docs/API.md)** | All methods, options, return types |
| **[⚛️ React Hooks](./docs/HOOKS.md)** | `useSecureStorage`, `useSecret`, patterns & examples |
| **[🎯 Advanced Usage](./docs/ADVANCED.md)** | Custom access control, batch operations, lifecycle patterns |
| **[🔑 Key Rotation](./docs/KEY_ROTATION.md)** | Automatic key versioning and re-encryption |
| **[❗ Error Handling](./docs/ERROR_HANDLING.md)** | Error codes, type-safe classification, debugging |
| **[🏗️ Architecture](./docs/ARCHITECTURE.md)** | System design, module layout, data flow |
| **[📈 Performance](./docs/PERFORMANCE.md)** | Benchmarks, optimization tips, scaling |
| **[🩺 Troubleshooting](./docs/TROUBLESHOOTING.md)** | FAQ, common issues, debugging guide |
| **[⚙️ Development](./docs/DEVELOPMENT.md)** | Setup, testing, contributing guide |

## Platform Support

| Platform | Min Version | Notes |
| --- | --- | --- |
| iOS | 13.0 | Secure Enclave + Keychain |
| macOS | 11.0 | Catalyst & native, system keychain |
| visionOS | 1.0 | Shared Secure Enclave policies |
| watchOS | 7.0 | Paired device + keychain sync |
| Android | API 23 | StrongBox (API 28+), automatic fallback |

## Setup

### iOS

1. Install pods:
   ```bash
   cd ios && pod install
   ```

2. Add Face ID usage description to `Info.plist`:
   ```xml
   <key>NSFaceIDUsageDescription</key>
   <string>Face ID is used to secure your secrets.</string>
   ```

### Android

Ensure permissions in `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
<uses-permission android:name="android.permission.USE_FINGERPRINT" />
```

### Expo

> [!WARNING]
> Expo Go doesn't support Nitro modules. Use `expo run:ios`/`expo run:android` or EAS builds.

1. Add plugin to `app.json`:
   ```json
   {
     "expo": {
       "plugins": ["react-native-sensitive-info"]
     }
   }
   ```

2. Run prebuild:
   ```bash
   npx expo prebuild --clean
   npx expo run:ios
   ```

## Core Features

### Type-Safe Error Handling

```typescript
import { SensitiveInfoError, ErrorCode } from 'react-native-sensitive-info'

try {
  await setItem('key', 'value')
} catch (error) {
  if (error instanceof SensitiveInfoError) {
    if (error.code === ErrorCode.AuthenticationCanceled) {
      // User dismissed biometric prompt
    } else if (error.code === ErrorCode.ItemNotFound) {
      // Item doesn't exist
    }
  }
}
```

See [Error Handling](./docs/ERROR_HANDLING.md) for all 18 error codes.

### Metadata Access

Every stored item includes metadata:
```typescript
const item = await getItem('token', { service: 'auth' })
console.log({
  securityLevel: item.metadata.securityLevel,    // 'secureEnclave'
  backend: item.metadata.backend,                // 'keychain'
  timestamp: item.metadata.timestamp,            // Unix timestamp
  accessControl: item.metadata.accessControl    // 'secureEnclaveBiometry'
})
```

### Automatic Security Negotiation

The library automatically chooses the strongest available security level:
- iOS: Secure Enclave → Biometry → Device Credential → Software
- Android: StrongBox + Class 3 Biometry → Keystore → EncryptedSharedPreferences

See [Access Control](./docs/ADVANCED.md#access-control--metadata) for custom policies.

### Key Rotation

```typescript
import { initializeKeyRotation, onRotationEvent } from 'react-native-sensitive-info'

// Enable automatic rotation every 30 days
await initializeKeyRotation({
  enabled: true,
  rotationIntervalMs: 30 * 24 * 60 * 60 * 1000,
  backgroundReEncryption: true
})

// Listen for events
onRotationEvent((event) => {
  if (event.type === 'rotation:completed') {
    console.log(`Re-encrypted ${event.itemsReEncrypted} items`)
  }
})
```

Full guide: [Key Rotation](./docs/KEY_ROTATION.md)

## API Methods

### Main Operations

| Method | Purpose |
| --- | --- |
| `setItem(key, value, options?)` | Save a secret |
| `getItem(key, options?)` | Read a secret + metadata |
| `hasItem(key, options?)` | Check if secret exists |
| `deleteItem(key, options?)` | Remove a secret |
| `getAllItems(options?)` | List all secrets in a service |
| `clearService(options?)` | Delete all secrets in a service |
| `getSupportedSecurityLevels()` | Query device capabilities |

### Configuration

Common options:
- `service` — Logical namespace (default: bundle ID)
- `accessControl` — Security policy (`secureEnclaveBiometry`, `biometryCurrentSet`, `devicePasscode`, `none`)
- `authenticationPrompt` — Prompt strings for biometric/passcode
- `iosSynchronizable` — Enable iCloud sync (iOS only)
- `keychainGroup` — Keychain sharing group (iOS only)

Full reference: [API Documentation](./docs/API.md)

## Example App

Interactive demo of all features:
```bash
cd example
yarn install
yarn ios    # or yarn android
```

Includes:
- ✅ All API examples
- ✅ Device capability detection
- ✅ Metadata inspection
- ✅ Key rotation demo
- ✅ Error handling patterns
- ✅ Performance profiler

## Performance

Nitro's hybrid architecture provides ~3.3× speed improvement:

| Operation | Time |
| --- | --- |
| `setItem` (biometric) | ~50ms (hardware dependent) |
| `getItem` (metadata) | ~5ms |
| `getAllItems` (25 items) | ~200ms |
| Bridge overhead reduction | 70% vs v5 |

See [Performance Guide](./docs/PERFORMANCE.md) for detailed benchmarks and optimization tips.

## Version Guide

| Version | Type | Recommend if | Min React Native |
| --- | --- | --- | --- |
| **6.x** | Nitro (new) | You want best performance & features | 0.76 |
| **5.6.x** | Classic bridge | You need maximum stability | 0.70 |

For migration: See [Troubleshooting FAQ](./docs/TROUBLESHOOTING.md#frequently-asked-questions).

## Development

```bash
# Install
yarn install

# Type check
yarn typecheck

# Run tests
yarn test

# Build
yarn build

# Development with watch
yarn build --watch
yarn test --watch
```

See [Development Guide](./docs/DEVELOPMENT.md) for local setup, contributing, and release process.

## Troubleshooting

**"Biometric never appears"** → Check device capabilities via `getSupportedSecurityLevels()`, or test on physical device

**"authentication failed"** → Expected on simulator without biometric. Test on device or use `accessControl: 'none'`

**"Undefined symbol on iOS"** → Run `cd ios && pod install`

**"Build fails on Android"** → Verify Android SDK and check Logcat: `adb logcat com.sensitiveinfo:V`

Full troubleshooting: [FAQ & Debugging](./docs/TROUBLESHOOTING.md)

## Contributing

PRs welcome! Please:
1. Open an issue for major changes
2. Run `yarn test` and `yarn typecheck` locally
3. Follow existing code style
4. Update tests and docs

See [Contributing Guide](./docs/DEVELOPMENT.md#contributing-guidelines).

## Sponsors

<!-- Insert sponsor links if applicable -->

## License

MIT © [Mateus Andrade](https://github.com/mateusandrade)
