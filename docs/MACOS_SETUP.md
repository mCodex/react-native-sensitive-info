# macOS Setup Guide

> ✨ **NEW in v5.6.0**: Full native macOS support with Touch ID and Secure Enclave

## Overview

React Native Sensitive Info now provides complete macOS support, allowing you to build desktop applications with secure credential storage and biometric authentication.

## Requirements

| Component | Minimum | Recommended |
|-----------|---------|------------|
| **macOS** | 10.15 (Catalina) | 12.0+ (Monterey+) |
| **Xcode** | 12.0 | 14.0+ |
| **Swift** | 5.5 | 5.9+ |
| **Node** | 16.0 | 18.0+ |
| **React Native** | 0.65.0 | 0.82.0+ |

## Hardware Support

### Apple Silicon (M1, M2, M3, M4)
- ✅ Touch ID biometric authentication
- ✅ Secure Enclave hardware encryption
- ✅ Full hardware-backed security

### Intel Macs
- ✅ Keychain storage (software-based)
- ⚠️ No Touch ID (no biometric)
- ⚠️ Device passcode fallback

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

2. Select your macOS target in Xcode

3. Go to **Build Settings** and verify:
   - **Minimum Deployments** is set to 10.15 or later
   - **Swift Language Version** is 5.5+

4. Go to **Build Phases** > **Link Binary With Libraries** and ensure these are linked:
   - `Security.framework`
   - `LocalAuthentication.framework`
   - `AppKit.framework`

### Info.plist (if needed for future expansion)

Most macOS apps don't need special permissions for Keychain access, but your app's sandboxing entitlements may require:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- Your other settings -->
</dict>
</plist>
```

## Basic Usage

### Simple Storage

```typescript
import { SensitiveInfo } from 'react-native-sensitive-info';

// Store a value
await SensitiveInfo.setItem('api-key', 'secret-key-value', {
  keychainService: 'com.myapp.macos'
});

// Retrieve the value
const apiKey = await SensitiveInfo.getItem('api-key', {
  keychainService: 'com.myapp.macos'
});

console.log(`API Key: ${apiKey}`);
```

### With Biometric Authentication

On Apple Silicon Macs (M1+), you can require Touch ID:

```typescript
import { SensitiveInfo } from 'react-native-sensitive-info';

// Request Touch ID authentication (M1+ only)
const secret = await SensitiveInfo.getItem('user-token', {
  keychainService: 'com.myapp.macos',
  accessControl: 'biometryOrDevicePasscode',
  prompt: {
    title: 'Unlock Your Account',
    subtitle: 'Authenticate with Touch ID to access your token'
  }
});

if (secret) {
  console.log('✅ Successfully authenticated!');
  // Use the secret
} else {
  console.log('❌ Authentication failed or was canceled');
}
```

### Detecting Hardware Capabilities

```typescript
import { SensitiveInfo } from 'react-native-sensitive-info';

const capabilities = await SensitiveInfo.getSupportedSecurityLevels();

if (capabilities.biometry) {
  console.log('✓ Touch ID available (Apple Silicon Mac)');
} else if (capabilities.deviceCredential) {
  console.log('✓ Device passcode available (Intel Mac)');
} else {
  console.log('✗ No biometric available');
}
```

## Advanced Usage

### Secure Enclave Support

On macOS 13+, sensitive data is stored in the Secure Enclave:

```typescript
// Force Secure Enclave storage (macOS 13+)
const result = await SensitiveInfo.setItem('critical-key', 'value', {
  keychainService: 'com.myapp.macos',
  accessControl: 'biometryCurrentSet', // Most restrictive
  authenticationPrompt: {
    title: 'Verify Identity'
  }
});

console.log(`Security Level: ${result.metadata?.securityLevel}`);
// Output: "secureEnclave" (macOS 13+) or "keychain" (macOS 10.15-12)
```

### iCloud Keychain Synchronization

When a user has iCloud Keychain enabled, secrets automatically sync across all their devices:

```typescript
// Store on Mac
await SensitiveInfo.setItem('shared-secret', 'value', {
  keychainService: 'com.myapp.icloud'
});

// Automatically accessible on iPhone, iPad, and other Macs!
// (from your app on those devices)
```

**Note**: This uses Apple's iCloud Keychain infrastructure automatically. No configuration needed.

### Cross-Platform App Pattern

```typescript
import { SensitiveInfo } from 'react-native-sensitive-info';

export async function storeCredentials(username: string, password: string) {
  const service = 'com.myapp.multi-platform';
  
  try {
    // Detect best available security
    const capabilities = await SensitiveInfo.getSupportedSecurityLevels();
    
    const accessControl = capabilities.secureEnclave 
      ? 'biometryCurrentSet'        // macOS 13+ (Secure Enclave)
      : 'biometryOrDevicePasscode'; // macOS 10.15-12 or Intel
    
    // Store credentials
    await SensitiveInfo.setItem(`${username}-password`, password, {
      keychainService: service,
      accessControl,
      authenticationPrompt: {
        title: `Authenticate to Save Credentials`
      }
    });
    
    console.log('✓ Credentials saved securely');
    
  } catch (error) {
    console.error('✗ Failed to save credentials:', error);
  }
}

export async function loadCredentials(username: string) {
  const service = 'com.myapp.multi-platform';
  
  try {
    const password = await SensitiveInfo.getItem(
      `${username}-password`,
      {
        keychainService: service,
        prompt: {
          title: 'Unlock Credentials',
          subtitle: `Authenticate to access ${username}'s password`
        }
      }
    );
    
    return password;
    
  } catch (error) {
    console.error('✗ Failed to load credentials:', error);
    return null;
  }
}
```

## React Hooks Integration

### Custom Hook for macOS Storage

```typescript
import { useCallback, useState } from 'react';
import { SensitiveInfo } from 'react-native-sensitive-info';

interface UseMacOSStorageOptions {
  service: string;
  requireAuth?: boolean;
}

export function useMacOSStorage(options: UseMacOSStorageOptions) {
  const { service, requireAuth = false } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const store = useCallback(
    async (key: string, value: string) => {
      setLoading(true);
      setError(null);

      try {
        const capabilities = await SensitiveInfo.getSupportedSecurityLevels();

        const accessControl = requireAuth && capabilities.biometry
          ? 'biometryOrDevicePasscode'
          : 'devicePasscode';

        await SensitiveInfo.setItem(key, value, {
          keychainService: service,
          accessControl,
          authenticationPrompt: requireAuth
            ? {
                title: 'Save to Keychain',
                subtitle: 'Authenticate to save this value'
              }
            : undefined
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [service, requireAuth]
  );

  const retrieve = useCallback(
    async (key: string) => {
      setLoading(true);
      setError(null);

      try {
        return await SensitiveInfo.getItem(key, {
          keychainService: service,
          prompt: requireAuth
            ? {
                title: 'Unlock Keychain',
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
    [service, requireAuth]
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

// Usage in component
export function MyMacOSComponent() {
  const storage = useMacOSStorage({
    service: 'com.myapp.macos',
    requireAuth: true
  });

  const handleSave = async () => {
    await storage.store('my-key', 'my-value');
  };

  const handleLoad = async () => {
    const value = await storage.retrieve('my-key');
    console.log('Value:', value);
  };

  return (
    <div>
      {storage.loading && <p>Loading...</p>}
      {storage.error && <p style={{ color: 'red' }}>{storage.error.message}</p>}
      <button onClick={handleSave}>Save</button>
      <button onClick={handleLoad}>Load</button>
    </div>
  );
}
```

## Troubleshooting

### Issue: "Native module not linked"

**Solution**:
```bash
npx react-native link react-native-sensitive-info
cd ios && pod install && cd ..
```

### Issue: "Touch ID not working on Intel Mac"

**Expected Behavior**: Touch ID is only available on Apple Silicon (M1+). Intel Macs will use device passcode.

```typescript
const capabilities = await SensitiveInfo.getSupportedSecurityLevels();

if (!capabilities.biometry) {
  console.log('Running on Intel Mac - biometric not available');
  console.log('Using device passcode for authentication');
}
```

### Issue: "Keychain items not syncing across devices"

**Solution**: Verify iCloud Keychain is enabled:
1. Open **System Preferences** > **iCloud**
2. Ensure **Keychain** is checked
3. Ensure the same Apple ID is used on all devices
4. Wait a few moments for sync to complete

### Issue: "Permission denied" errors

**Solution**: Check Keychain Access permissions:
1. Open **Keychain Access** (Applications > Utilities)
2. Search for your app's keychain items
3. Double-click the item
4. Go to the **Access Control** tab
5. Ensure your app is in the allowed list

## Performance Considerations

### macOS-Specific Tips

1. **Touch ID Timeout**: Touch ID authentication times out after ~30 seconds of user inactivity
2. **Keychain Latency**: First access is slightly slower due to Keychain search (~5-10ms)
3. **iCloud Sync Delay**: Synced items may take 5-30 seconds to propagate

### Optimization Pattern

```typescript
// ✅ Good: Cache after initial fetch
let cachedToken: string | null = null;

async function getToken() {
  if (cachedToken) return cachedToken;
  
  cachedToken = await SensitiveInfo.getItem('token', {
    keychainService: 'com.myapp.macos'
  });
  
  return cachedToken;
}

// On logout
function logout() {
  cachedToken = null; // Clear cache
  SensitiveInfo.deleteItem('token', {
    keychainService: 'com.myapp.macos'
  });
}
```

## Building for Distribution

### Signing & Notarization

When building for distribution, ensure:

1. **Code Signing**: Your app is signed with a valid developer certificate
2. **Provisioning**: Keychain services are enabled in entitlements
3. **Notarization**: Submit for Apple notarization (required for macOS 10.15+)

```bash
# Build for distribution
npm run build:macos

# Sign (requires developer certificate)
codesign -s "Developer ID Application" dist/app.app

# Notarize
xcrun altool --notarize-app --file dist/app.zip --primary-bundle-id com.myapp.macos
```

## Related Resources

- [Apple Keychain Services Documentation](https://developer.apple.com/documentation/security/keychain)
- [LocalAuthentication Framework](https://developer.apple.com/documentation/localauthentication)
- [Secure Enclave Programming Guide](https://developer.apple.com/documentation/security/secure_enclave)
- [macOS App Sandboxing](https://developer.apple.com/library/archive/documentation/Security/Conceptual/AppSandboxDesignGuide/AppSandboxInDepth/AppSandboxInDepth.html)

---

**Made with ❤️ for macOS developers**

Need help? [Open an issue on GitHub](https://github.com/mCodex/react-native-sensitive-info/issues)
