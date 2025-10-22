# iOS Setup Guide

> Full native iOS support with Face ID, Touch ID, and Secure Enclave

## Overview

React Native Sensitive Info provides complete iOS support with biometric authentication and hardware-backed encryption.

## Requirements

| Component | Minimum | Recommended |
|-----------|---------|------------|
| **iOS** | 13.0 | 17.0+ |
| **Xcode** | 12.0 | 15.0+ |
| **Swift** | 5.5 | 5.9+ |
| **Node** | 16.0 | 18.0+ |
| **React Native** | 0.65.0 | 0.82.0+ |

## Hardware Support

### iPhone with Face ID
- ✅ Face ID biometric authentication
- ✅ Secure Enclave (iOS 16+)
- ✅ Hardware-backed security

### iPhone with Touch ID
- ✅ Touch ID biometric authentication
- ✅ Secure Enclave (iOS 16+)
- ✅ Hardware-backed security

### iPad
- ✅ Touch ID on iPad Air (5th gen+) and iPad Pro
- ✅ Face ID on newer models
- ✅ Secure Enclave support

## Installation

### Step 1: Install Package

```bash
npm install react-native-sensitive-info@5.6.0
# or
yarn add react-native-sensitive-info@5.6.0
```

### Step 2: Install CocoaPods Dependencies

```bash
cd ios
pod install
cd ..
```

## Configuration

### Xcode Project Setup

1. Open your project in Xcode:
   ```bash
   open ios/YourApp.xcworkspace
   ```

2. Select your iOS target in Xcode

3. Go to **Build Settings** and verify:
   - **Minimum Deployments** is set to 13.0 or later
   - **Swift Language Version** is 5.5+

4. Go to **Build Phases** > **Link Binary With Libraries** and ensure:
   - `Security.framework`
   - `LocalAuthentication.framework`
   - `UIKit.framework`

### Info.plist Configuration

Add Face ID usage description (required for App Store):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSFaceIDUsageDescription</key>
  <string>We use Face ID to securely authenticate you and protect your sensitive information.</string>
</dict>
</plist>
```

## Basic Usage

### Simple Storage

```typescript
import { SensitiveInfo } from 'react-native-sensitive-info';

// Store a value
await SensitiveInfo.setItem('auth-token', 'token-value', {
  keychainService: 'com.myapp.ios'
});

// Retrieve the value
const token = await SensitiveInfo.getItem('auth-token', {
  keychainService: 'com.myapp.ios'
});

console.log(`Token: ${token}`);
```

### With Biometric Authentication

```typescript
import { SensitiveInfo } from 'react-native-sensitive-info';

// Request Face ID or Touch ID
const secret = await SensitiveInfo.getItem('password', {
  keychainService: 'com.myapp.ios',
  accessControl: 'biometryOrDevicePasscode',
  prompt: {
    title: 'Unlock Your Account',
    subtitle: 'Authenticate with Face ID or Touch ID'
  }
});

if (secret) {
  console.log('✅ Successfully authenticated!');
}
```

### Detecting Available Biometry

```typescript
import { SensitiveInfo } from 'react-native-sensitive-info';

const capabilities = await SensitiveInfo.getSupportedSecurityLevels();

if (capabilities.biometry) {
  console.log(`✓ ${capabilities.biometryType} available`);
  // On iOS 16+, will show 'faceID' or 'touchID'
} else if (capabilities.deviceCredential) {
  console.log('✓ Device passcode available');
} else {
  console.log('✗ No biometric available');
}
```

## Advanced Usage

### Secure Enclave (iOS 16+)

On iOS 16 and later, use the Secure Enclave for maximum security:

```typescript
import { SensitiveInfo } from 'react-native-sensitive-info';

const result = await SensitiveInfo.setItem('critical-key', 'value', {
  keychainService: 'com.myapp.ios',
  accessControl: 'biometryCurrentSet', // Uses Secure Enclave on iOS 16+
  authenticationPrompt: {
    title: 'Verify Identity'
  }
});

console.log(`Security Level: ${result.metadata?.securityLevel}`);
// Output: "secureEnclave" (iOS 16+) or "keychain" (iOS 13-15)
```

### iCloud Keychain Sync

Secrets automatically sync to user's other devices via iCloud:

```typescript
// Store on iPhone
await SensitiveInfo.setItem('shared-secret', 'value', {
  keychainService: 'com.myapp.icloud'
});

// Automatically accessible on user's iPad, Mac, etc.!
```

## React Hooks Integration

### Custom Hook for iOS Storage

```typescript
import { useCallback, useState } from 'react';
import { SensitiveInfo } from 'react-native-sensitive-info';

interface UseIOSStorageOptions {
  service: string;
  requireBiometry?: boolean;
}

export function useIOSStorage(options: UseIOSStorageOptions) {
  const { service, requireBiometry = false } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const store = useCallback(
    async (key: string, value: string) => {
      setLoading(true);
      setError(null);

      try {
        const capabilities = await SensitiveInfo.getSupportedSecurityLevels();

        const accessControl = requireBiometry && capabilities.biometry
          ? 'biometryOrDevicePasscode'
          : 'devicePasscode';

        await SensitiveInfo.setItem(key, value, {
          keychainService: service,
          accessControl,
          authenticationPrompt: requireBiometry
            ? {
                title: 'Authenticate',
                subtitle: 'Verify your identity'
              }
            : undefined
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [service, requireBiometry]
  );

  const retrieve = useCallback(
    async (key: string) => {
      setLoading(true);
      setError(null);

      try {
        return await SensitiveInfo.getItem(key, {
          keychainService: service,
          prompt: requireBiometry
            ? {
                title: 'Unlock',
                subtitle: 'Authenticate to access this value'
              }
            : undefined
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [service, requireBiometry]
  );

  const remove = useCallback(
    async (key: string) => {
      setLoading(true);
      setError(null);

      try {
        await SensitiveInfo.deleteItem(key, {
          keychainService: service
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [service]
  );

  return { store, retrieve, remove, loading, error };
}
```

## Troubleshooting

### Issue: "Native module not linked"

**Solution**:
```bash
npx react-native link react-native-sensitive-info
cd ios && pod install && cd ..
```

### Issue: "Face ID not working"

**Possible causes**:
- Face ID hardware not available on device
- Face ID not enrolled by user
- App doesn't have Face ID permission in Info.plist

**Solution**:
```typescript
const capabilities = await SensitiveInfo.getSupportedSecurityLevels();

if (!capabilities.biometry) {
  console.log('Face ID not available on this device');
  // Fall back to device passcode
}
```

### Issue: "Keychain items not syncing"

Verify iCloud Keychain is enabled:
1. Go to **Settings** > **[Your Name]** > **iCloud**
2. Ensure **Keychain** is toggled ON
3. Ensure same Apple ID is used on all devices

## Performance Considerations

### iOS-Specific Tips

1. **Biometric Timeout**: Face ID/Touch ID authentication times out after ~30 seconds
2. **First Access**: Keychain search may take 5-10ms initially
3. **iCloud Sync**: Changes may take 5-30 seconds to propagate

### Optimization Pattern

```typescript
// ✅ Cache frequently accessed values
let cachedToken: string | null = null;

async function getToken() {
  if (cachedToken) return cachedToken;
  
  cachedToken = await SensitiveInfo.getItem('token', {
    keychainService: 'com.myapp.ios'
  });
  
  return cachedToken;
}

// Clear cache on logout
function logout() {
  cachedToken = null;
  SensitiveInfo.deleteItem('token', {
    keychainService: 'com.myapp.ios'
  });
}
```

## Building for Distribution

### TestFlight & App Store

1. Ensure **NSFaceIDUsageDescription** is in Info.plist
2. Test on actual iOS devices before submission
3. Verify biometric works with your app
4. Submit for App Store review

```bash
# Build for distribution
npm run build:ios

# Archive
xcodebuild -workspace ios/YourApp.xcworkspace -scheme YourApp -configuration Release -archivePath archive.xcarchive archive

# Export for TestFlight
xcodebuild -exportArchive -archivePath archive.xcarchive -exportOptionsPlist export.plist -exportPath ./export
```

## Related Resources

- [Apple Keychain Services Documentation](https://developer.apple.com/documentation/security/keychain)
- [LocalAuthentication Framework](https://developer.apple.com/documentation/localauthentication)
- [Secure Enclave Programming Guide](https://developer.apple.com/documentation/security/secure_enclave)

---

**Made with ❤️ for iOS developers**

Need help? [Open an issue on GitHub](https://github.com/mCodex/react-native-sensitive-info/issues)
