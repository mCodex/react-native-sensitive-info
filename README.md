# React Native Sensitive Info

> 🔐 **Securely store sensitive information** on React Native with automatic encryption, biometric authentication, and hardware-backed key storage.

[![npm version](https://img.shields.io/npm/v/react-native-sensitive-info.svg?style=flat-square)](https://www.npmjs.com/package/react-native-sensitive-info)
[![downloads](https://img.shields.io/npm/dm/react-native-sensitive-info.svg?style=flat-square)](https://www.npmjs.com/package/react-native-sensitive-info)
[![license](https://img.shields.io/npm/l/react-native-sensitive-info.svg?style=flat-square)](LICENSE)

**v5.6.0** - Production Ready | iOS 13+ | Android 7+ | macOS 10.15+ | visionOS 1.0+ | watchOS 6+

---

## ⚠️ Version Information

> [!TIP]
> **v6.0.0 (Nitro Preview)**
> 
> - 🚀 Adds full Nitro Module and Nitro View compatibility
> - 🧪 Currently stabilizing on the `master` branch
> - ⏳ Preview quality while documentation and samples are updated

> [!IMPORTANT] 
> **v5.6.0 (Current)**
> 
> - ✅ New Architecture ready (RN 0.73+)
> - ✅ Universal Android authentication (API 24+)
> - ✅ Biometric + device credential support
> - ✅ AES-256-GCM hardware-backed encryption
> - 📦 Distributed as a TurboModule

> [!NOTE]
> **v5.5.x and older**
> 
> - ✅ Old Architecture only
> - 🛠 Bug fixes only, no new features
> - ⬇️ Install when you cannot move to RN New Architecture yet

**Install the right build for your project:**
```bash
# React Native 0.73+ (New Architecture)
npm install react-native-sensitive-info@5.6.0

# React Native <0.73 (Old Architecture)
npm install react-native-sensitive-info@5.5.x
```

---

## 🌟 Features

| Feature | iOS | Android | macOS | visionOS | watchOS |
|---------|-----|---------|-------|----------|---------|
| **Secure Storage** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **AES-256 Encryption** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Hardware-Backed Keys** | ✅ | ✅ API 24+ | ✅ | ✅ | ✅ |
| **Biometric Auth** | ✅ Face/Touch ID | ✅ Fingerprint & device credential | ✅ Touch ID | ✅ Optic ID | ❌ Passcode only |
| **Automatic Migration** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Zero Dependencies** | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 📋 What This Library Does

```
App Code
  ↓
SensitiveInfo.setItem(key, value)
  ↓
AES-256-GCM Encryption (random IV per operation)
  ↓
Hardware-Backed Key Storage
├─ iOS: Keychain + Secure Enclave (iOS 16+)
├─ Android: AndroidKeyStore (StrongBox when available)
└─ Optional: Biometric authentication required
  ↓
Encrypted data stored securely
```

**Real-world use cases**:
- Authentication tokens
- API keys
- User credentials
- PII (personally identifiable information)
- Payment information
- OAuth refresh tokens

---

## 🤖 Android Authentication Matrix

| Android Version | API Level | Prompt Strategy | Storage Backend |
|-----------------|-----------|-----------------|-----------------|
| Android 14 - 10 | 34 - 29   | Keystore-gated biometric/device credential prompt shown when decrypting | AndroidKeyStore (hardware-backed, StrongBox when available) |
| Android 9 - 7   | 28 - 24   | Manual prompt displayed before key use; library waits for user confirmation | AndroidKeyStore (hardware-backed) |

> [!TIP]
> Supply localized `authenticationPrompt` copy even on Android 10+ so users see consistent messaging across API levels.

> [!CAUTION]
> Android 7-9 throws `E_AUTHENTICATION_REQUIRED` if you skip the prompt configuration because the OS does not present a system dialog automatically.

---

## 🚀 Installation

```bash
npm install react-native-sensitive-info@5.6.0
# or
yarn add react-native-sensitive-info@5.6.0
```

### Link Native Modules

```bash
npx react-native link react-native-sensitive-info
```

### Android Setup

Add permissions to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
<uses-permission android:name="android.permission.USE_FINGERPRINT" />
```

> [!NOTE]
> Android 7-9 rely on a manual authentication dialog. Provide `authenticationPrompt` strings whenever you request biometric/device credential protection so the library can display localized UI ahead of decrypting secrets.

### iOS Setup

Add to `Info.plist`:

```xml
<key>NSFaceIDUsageDescription</key>
<string>We need Face ID to protect your authentication token</string>
```

---

## 💡 Basic Usage

### Store (with automatic encryption)

```typescript
import { SensitiveInfo } from 'react-native-sensitive-info';

// Store with biometric protection
await SensitiveInfo.setItem('auth-token', 'jwt-token-xyz', {
  keychainService: 'myapp',
  accessControl: 'biometryOrDevicePasscode',
  authenticationPrompt: {
    title: 'Authenticate',
    subtitle: 'Please authenticate to protect your token',
    description: 'Your token is encrypted and requires biometric verification'
  }
});

// User sees biometric prompt (Face ID/Touch ID/Fingerprint)
// After authentication, value is stored encrypted
```

### Retrieve (automatic decryption + biometric if needed)

```typescript
// Retrieve decrypted value
const result = await SensitiveInfo.getItem('auth-token', {
  keychainService: 'myapp'
});

console.log(result.value);        // 'jwt-token-xyz'
console.log(result.metadata);     // { securityLevel: 'strongBox', backend: 'androidKeystore', timestamp: 1700000000 }

// If biometric-protected: OS shows prompt automatically
// User authenticates → value is decrypted and returned
```

### Other Operations

```typescript
// Check if exists
const exists = await SensitiveInfo.hasItem('auth-token', {
  keychainService: 'myapp'
});

// Get all keys in service
const keys = await SensitiveInfo.getAllItems({
  keychainService: 'myapp'
});
// Returns: ['auth-token', 'refresh-token', ...]

// Delete specific item
await SensitiveInfo.deleteItem('auth-token', {
  keychainService: 'myapp'
});

// Clear entire service
await SensitiveInfo.clearService({
  keychainService: 'myapp'
});
```

---

## 🔒 Security Details

### Encryption

- **Algorithm**: AES-256-GCM
- **Key Size**: 256-bit
- **IV**: 12-byte random (per operation, NIST SP 800-38D compliant)
- **Authentication Tag**: GCM tag (prevents tampering)

### Key Storage

| Platform | Storage | Hardware-Backed | Notes |
|----------|---------|-----------------|-------|
| iOS 16+ | Keychain + Secure Enclave | ✅ Yes | Isolated, tamper-resistant |
| iOS 13-15 | Keychain only | ✅ Yes | Device passcode/biometric |
| Android 14-10 | AndroidKeyStore + StrongBox | ✅ Yes | System prompt wraps keystore auth |
| Android 9-7 | AndroidKeyStore | ✅ Yes | Manual prompt required before key use |
| macOS 13+ | Keychain + Secure Enclave | ✅ Yes | Touch ID support |
| visionOS | Keychain + Secure Enclave | ✅ Yes | Optic ID support |
| watchOS | Keychain | ✅ Partial | Shared with paired iPhone |

### Biometric Protection

When enabled, biometric authentication is required to access encrypted data:

- User attempts to retrieve protected value
- OS shows biometric prompt (Face ID, Touch ID, Fingerprint, Optic ID)
- User authenticates with biometric or device credential
- On success: Key is unlocked, value is decrypted
- On failure/cancellation: Access denied, exception thrown

> [!NOTE]
> On Android 7-9 the library displays its own dialog before touching the keystore. On Android 10+ the OS handles the biometric/device credential UI directly.

**Protection against**:
- ✅ Screen reading (encryption)
- ✅ Device theft (biometric + device passcode)
- ✅ Man-in-the-middle attacks (hardware-backed keys)
- ✅ Credential brute force (device OS limits)

---

## 📚 API Reference

### `setItem(key, value, options?)`

Stores an encrypted value with optional biometric protection.

```typescript
interface SetOptions {
  keychainService?: string;          // Service namespace (app package by default)
  accessControl?: string;             // 'biometryOrDevicePasscode' | 'devicePasscode' | 'none'
  authenticationPrompt?: {
    title: string;                    // Required: "Authenticate" (mandatory on Android 7-9)
    subtitle?: string;                // "Scan your fingerprint"
    description?: string;             // "Required to protect this data" (shown in manual dialog)
  };
}

interface SetResult {
  metadata: {
    securityLevel: string;            // 'biometry' | 'deviceCredential' | 'software'
    accessControl: string;            // Policy applied
    backend: string;                  // 'keychain' | 'preferences'
    timestamp: number;                // UNIX timestamp
  };
}
```

### `getItem(key, options?)`

Retrieves and decrypts a stored value.

```typescript
interface GetOptions {
  keychainService?: string;           // Service namespace
}

interface GetResult {
  value: string;                      // Decrypted value
  metadata: {
    securityLevel: string;
    accessControl: string;
    backend: string;
    timestamp: number;
  };
}

// Returns: GetResult | null (null if not found)
```

### `hasItem(key, options?)`

Checks if a value exists in storage.

```typescript
const exists = await SensitiveInfo.hasItem('key', { keychainService: 'myapp' });
// Returns: boolean
```

### `getAllItems(options?)`

Lists all keys in a service namespace.

```typescript
const keys = await SensitiveInfo.getAllItems({ keychainService: 'myapp' });
// Returns: string[] (array of key names)
```

### `deleteItem(key, options?)`

Deletes a specific value and its encryption key.

```typescript
await SensitiveInfo.deleteItem('key', { keychainService: 'myapp' });
```

### `clearService(options?)`

Deletes all values in a service namespace.

```typescript
await SensitiveInfo.clearService({ keychainService: 'myapp' });
```

---

## ⚠️ Error Handling

### Common Error Codes

```typescript
try {
  await SensitiveInfo.setItem('token', 'value', { 
    authenticationPrompt: { title: 'Authenticate' } 
  });
} catch (error) {
  switch (error.code) {
    case 'E_BIOMETRIC_NOT_AVAILABLE':
      // Device doesn't support biometric - use password instead
      showPasswordPrompt();
      break;
    
    case 'E_BIOMETRIC_LOCKOUT':
      // Too many failed attempts - try again later
      console.log('Locked out for ~30 seconds');
      break;
    
    case 'E_USER_CANCELLED':
      // User dismissed the biometric prompt - normal behavior
      console.log('User cancelled');
      break;
    
    case 'E_NOT_FOUND':
      // (getItem only) Value doesn't exist
      console.log('Not stored yet');
      break;
    
    case 'E_ENCRYPTION_FAILED':
      // Encryption operation failed
      showError('Failed to store secure data');
      break;
  }
}
```

---

## 🧪 Testing

### Enable Biometric in Emulator

```bash
# Android Emulator - Simulate fingerprint
adb shell cmd finger simulate 1

# iOS Simulator - Tap biometric in menu or press ⌘U
```

### Test Both Paths

```typescript
// Test with biometric
await testWithBiometric();

// Test without biometric (disable in settings)
await testWithoutBiometric();

// Test error cases
await testBiometricCancellation();
await testBiometricTimeout();
```

> [!TIP]
> Run your suite on both an Android 13+ emulator **and** an Android 8/9 emulator to validate the automatic keystore dialog and the manual pre-auth dialog paths.

---

## 📖 Platform-Specific Notes

### iOS / visionOS / watchOS

- **iCloud Keychain**: Data can sync across devices (optional)
- **Secure Enclave**: Available iOS 16+, visionOS 1.0+, macOS 13+
- **Biometric**: Requires prompt text (title, subtitle)
- **Permissions**: Add NSFaceIDUsageDescription to Info.plist

### Android

- **Authentication Flow**: API 29+ (Android 10+) relies on keystore-gated OS dialogs, while API 24-28 (Android 7-9) shows a library-provided dialog before key use.
- **StrongBox**: Hardware-backed keys automatically prefer StrongBox where present (Android 9+).
- **Activity Hook**: Ensure `ActivityContextHolder.setActivity(this)` runs in `MainActivity.onCreate` so prompts attach to the foreground activity.
- **Permissions**: Declare `USE_BIOMETRIC` and `USE_FINGERPRINT` in `AndroidManifest.xml`.

### macOS

- **Touch ID**: Apple Silicon (M1+) only
- **Secure Enclave**: macOS 13+
- **Intel Support**: No Touch ID, uses passcode fallback

---

## 🔄 Migration from v5.5.x

Good news! v5.6.0 is **100% backward compatible** and **fully automatic**:

```typescript
// v5.5.0 code works unchanged in v5.6.0
const token = await SensitiveInfo.getItem('auth-token');

// Behind the scenes:
// 1. Detects old fixed-IV encryption
// 2. Decrypts with old algorithm
// 3. Re-encrypts with random IV (secure!)
// 4. Updates storage transparently
// Users see no difference ✨
```

**No code changes required** - just upgrade and everything works better!

---

## 🎓 Best Practices

### ✅ DO

```typescript
// ✅ Use service namespaces to organize secrets
await SensitiveInfo.setItem('auth-token', token, {
  keychainService: 'authentication'
});
await SensitiveInfo.setItem('api-key', key, {
  keychainService: 'api'
});

// ✅ Always provide biometric prompts with clear messages
await SensitiveInfo.setItem('sensitive-data', data, {
  authenticationPrompt: {
    title: 'Secure Your Account',
    description: 'Biometric verification required'
  }
});

// ✅ Handle errors gracefully
try {
  const result = await SensitiveInfo.getItem('token');
  if (!result) {
    // Item not found - redirect to login
  }
} catch (e) {
  if (e.code === 'E_BIOMETRIC_LOCKOUT') {
    // Guide user through unlock process
  }
}
```

### ❌ DON'T

```typescript
// ❌ Don't hardcode service names - use constants
const SERVICE = 'myapp-auth';  // ← Define once, reuse everywhere

// ❌ Don't skip error handling for biometric
await SensitiveInfo.setItem('key', 'value', { 
  authenticationPrompt: { title: 'Auth' }
  // ← Must catch errors

// ❌ Don't store passwords in plain text
const password = 'user-password';  // ← DON'T DO THIS
// Instead: Use OAuth tokens, never store passwords locally

// ❌ Don't log sensitive values
console.log(token);  // ← Never log decrypted values
```

---

## 🐛 Troubleshooting

### "Activity is not available" (Android)

**Cause**: BiometricAuthenticator can't access Activity
**Solution**: Ensure `ActivityContextHolder.setActivity(this)` is called in MainActivity

```kotlin
// In MainActivity.kt
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    ActivityContextHolder.setActivity(this)
}
```

### "Biometric not available on device"

**Cause**: Device lacks fingerprint sensor or biometric not enrolled
**Solution**: Fall back to password authentication

```typescript
try {
  await setItemWithBiometric();
} catch (e) {
  if (e.code === 'E_BIOMETRIC_NOT_AVAILABLE') {
    await setItemWithPassword();  // Fallback
  }
}
```

### `E_AUTHENTICATION_REQUIRED` on Android 7-9

**Cause**: `authenticationPrompt` text is missing, so the manual dialog cannot be rendered before hitting the keystore.
**Solution**: Provide at least a `title` (and ideally description) when storing or reading biometric-protected secrets.

### "Key has been invalidated"

**Cause**: Biometric enrollment changed (finger added/removed)
**Solution**: Delete old key, recreate on next store

```typescript
try {
  const value = await SensitiveInfo.getItem('token');
} catch (e) {
  if (e.code === 'E_KEY_INVALIDATED') {
    await SensitiveInfo.deleteItem('token');
    // User must re-authenticate to create new key
  }
}
```

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/mCodex/react-native-sensitive-info/issues)
- **Discussions**: [GitHub Discussions](https://github.com/mCodex/react-native-sensitive-info/discussions)
- **Documentation**: See inline KDoc comments in source code

---

## 📄 License

MIT © [mCodex](https://github.com/mCodex)

---

## 🙏 Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

**Built with ❤️ for React Native**
