# react-native-sensitive-info 🔐

Modern, secure storage for React Native built on Keychain (iOS) and Android Keystore. This release focuses on security hardening, TurboModule support, and zero-touch migration from legacy data.

> [!TIP]
> Upgrading from `v5.5.0`? Install the new version and keep using the same API. Existing secrets are upgraded in-place the next time they are read—no manual migration required.

> [!WARNING]
> Looking for the Nitro module build? The actively developed release now lives on the `master` branch and ships Nitro by default. The `v5.x` line (this branch) stays on the legacy architecture and only receives critical bug fixes.

## ✨ Highlights

- 🚀 **TurboModule ready** with strong TypeScript types.
- 🛡️ **Security first**: random IV encryption on Android and hardened Keychain defaults on iOS.
- 🔒 **Biometric helpers** for Touch ID, Face ID, and Android Biometric Prompt.
- ♻️ **Invisible migration**: older entries are transparently re-encrypted the first time they are accessed.
- 📚 **OSS-friendly docs** with copy-paste examples and troubleshooting tips.

> [!IMPORTANT]
> **What changed from the old v5.5.x releases?**
> - **Hardened security defaults: AES-GCM with per-item IVs on Android and stricter Keychain accessibility, closing the fixed-IV weakness from pre-5.x.**
> - Better runtime characteristics: biometric helpers use the platform APIs correctly and the module is TurboModule-ready, cutting bridge overhead on the new architecture.
> - Stronger TypeScript surface: every option is typed, including biometric prompt strings and synchronizable flags, preventing silent misconfiguration.
> - Zero-touch migration: existing secrets are upgraded in place as they are read—no manual scripts or downtime windows needed.
> - Expanded platform support: macOS/tvOS targets ship in the podspec and the example app demonstrates every feature with the correct permissions in place.

## 📦 Installation

```bash
yarn add react-native-sensitive-info
# or
npm install react-native-sensitive-info
```

> [!NOTE]
> React Native 0.71+ is recommended.

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

> [!CAUTION]
> Simulators and emulators only emulate biometric sensors. In the iOS simulator open **Hardware → Face ID** (or Touch ID) to enrol and trigger prompts. Android emulators must have a fingerprint/biometric enrolled in Settings and you can emulate a scan with `adb emu finger touch 1`. Always verify flows on a physical device before shipping.

## 🎯 Example app

- A complete playground showcasing every API ships in `example`. Run it with `yarn example ios` or `yarn example android` and use the on-screen controls to create, read, list, and delete secrets while toggling biometric protection.
- The UI also displays hardware requirements and explains how to trigger Face ID / Biometric Prompt inside simulators and emulators.

## 📱 Platform permissions

- **Android**: Add the biometric permissions to your manifest so Android 9 and below expose fingerprint support.

	```xml
	<uses-permission android:name="android.permission.USE_BIOMETRIC" />
	<uses-permission android:name="android.permission.USE_FINGERPRINT" />
	```

- **iOS**: Declare why you access biometrics in your `Info.plist`.

	```xml
	<key>NSFaceIDUsageDescription</key>
	<string>Authenticate the user before revealing sensitive information.</string>
	```

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
