# react-native-sensitive-info 🔐

Modern, secure storage for React Native built on Keychain (iOS) and Android Keystore. This release focuses on security hardening, TurboModule support, and zero-touch migration from legacy data.

> [!TIP]
> Upgrading from `v5.x`? Install the new version and keep using the same API. Existing secrets are upgraded in-place the next time they are read—no manual migration required.

## ✨ Highlights

- 🚀 **TurboModule ready** with strong TypeScript types.
- 🛡️ **Security first**: random IV encryption on Android and hardened Keychain defaults on iOS.
- 🔒 **Biometric helpers** for Touch ID, Face ID, and Android Biometric Prompt.
- ♻️ **Invisible migration**: older entries are transparently re-encrypted the first time they are accessed.
- 📚 **OSS-friendly docs** with copy-paste examples and troubleshooting tips.

## 📦 Installation

```bash
yarn add react-native-sensitive-info
# or
npm install react-native-sensitive-info
```

> [!NOTE]
> React Native 0.71+ is recommended. For older versions ensure you follow the manual installation steps in [`CONTRIBUTING.md`](CONTRIBUTING.md).

### iOS

```bash
cd ios && pod install
```

- The module is Swift-based and ships with an Objective-C compatibility header—no extra bridging setup required.
- To share credentials across extensions enable **Keychain Sharing** in your target and reuse `keychainService`.

### Android

Autolinking covers everything. If you use ProGuard/R8, keep rules are bundled. The module stores encrypted payloads inside a dedicated `SharedPreferences` file (defaults to `shared_preferences`).

## 🚀 Quick start

```tsx
import {
	setItem,
	getItem,
	deleteItem,
	isSensorAvailable,
	type RNSensitiveInfoOptions,
} from 'react-native-sensitive-info';

const options: RNSensitiveInfoOptions = {
	keychainService: 'com.acme.auth',
	sharedPreferencesName: 'acme_secure_store',
	touchID: true,
	kSecUseOperationPrompt: 'Authenticate to unlock your session',
};

await setItem('refresh-token', 'secret-value', options);

const value = await getItem('refresh-token', options);

await deleteItem('refresh-token', options);

const sensor = await isSensorAvailable();
console.log('Biometry', sensor);
```

> [!IMPORTANT]
> Returning `false` from `isSensorAvailable` means the device *cannot* use biometrics right now (locked out or not enrolled). Handle this gracefully by falling back to device PIN/password flows.

## 🔍 API overview

| Function | Description |
| --- | --- |
| `setItem(key, value, options?)` | Stores a value. Updates reuse the stronger default accessibility automatically. |
| `getItem(key, options?)` | Reads a value. Triggers background migration when older data is detected. |
| `hasItem(key, options?)` | Boolean existence check. |
| `getAllItems(options?)` | Returns an immutable array of `{ key, value, service }`. |
| `deleteItem(key, options?)` | Removes an entry. |
| `isSensorAvailable()` | Resolves to `'Face ID'`, `'Touch ID'`, or `false`. Rejects when biometry is locked. |
| `hasEnrolledFingerprints()` | Convenience boolean for enrollment state. |
| `cancelFingerprintAuth()` | Cancels an in-flight biometric prompt (Android + iOS). |
| `setInvalidatedByBiometricEnrollment(flag)` | iOS only—control whether new biometric enrollments invalidate stored secrets. |

## ⚙️ Options reference

| Option | Platform | Default | Details |
| --- | --- | --- | --- |
| `keychainService` | iOS | `app` | Namespace for Keychain items. Use the same value across extensions that should share secrets. |
| `sharedPreferencesName` | Android | `shared_preferences` | Backing file name used by the Android module. |
| `touchID` | Both | `false` | Enables biometric-protected storage (Touch/Face ID or Android Biometric Prompt). |
| `kSecAttrAccessible` | iOS | `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` | Override the Keychain accessibility class when not using biometrics. |
| `kSecAccessControl` | iOS | `kSecAccessControlBiometryCurrentSet` | Custom access control flags when biometrics are enabled. |
| `kSecUseOperationPrompt` | iOS | `Authenticate to access sensitive information` | Text shown inside the biometric prompt. |
| `kLocalizedFallbackTitle` | iOS | `''` | Custom label for the fallback button when fallback is allowed. |
| `kSecAttrSynchronizable` | iOS | `kSecAttrSynchronizableAny` | Set to `false` to disable iCloud Keychain sync. |
| `showModal` | Android | `true` | When `true`, the Android BiometricPrompt UI is shown. When `false` the module emits events for custom UIs. |
| `strings` | Android | — | Localised copy for the Android prompt (header, hint, etc.). |

## 🧪 Testing tips

> [!TIP]
> Use the example app (`yarn example ios` / `yarn example android`) to exercise biometric flows. The Android mock prompt accepts any fingerprint in the emulator.

- For Jest tests, mock `react-native-sensitive-info` and assert against your business logic.
- Detox/E2E: prefer injecting test doubles instead of attempting to spoof biometrics.

## 🔐 Security & Migration notes

- Android now uses **AES-GCM with a per-value IV** generated by `SecureRandom`. Legacy payloads with fixed IVs are re-encrypted on access and written back automatically.
- iOS stores secrets with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` by default (higher security than the legacy `WhenUnlocked`). Older entries are upgraded seamlessly during reads.
- Calling `setItem` on an existing key also refreshes its accessibility to the new defaults, ensuring future fetches remain secure.

## ❓ FAQ

**Why does `hasItem` reject on iOS when protected data is unavailable?**  
This occurs during device boot before the user unlocks the device for the first time. Retry once `UIApplication.sharedApplication.protectedDataAvailable` becomes true.

**Can I migrate away from the Android SharedPreferences backend?**  
Yes—override `sharedPreferencesName`, read everything via `getAllItems`, write to your new storage, then `deleteItem` each entry.

## 🤝 Contributing

Pull requests are welcome! Please read

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## 📄 License

MIT © [mCodex](https://github.com/mCodex)
