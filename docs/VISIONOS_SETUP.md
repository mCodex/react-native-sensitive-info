# visionOS Setup Guide

> ✨ **NEW in v5.6.0**: Full native visionOS support with Optic ID biometric authentication

## Overview

React Native Sensitive Info now provides complete Apple Vision Pro support, enabling you to build spatial applications with secure credential storage and Optic ID biometric authentication.

## Requirements

| Component | Minimum | Recommended |
|-----------|---------|------------|
| **visionOS** | 1.0 | 2.0+ |
| **Xcode** | 15.0 | 15.3+ |
| **Swift** | 5.5 | 5.9+ |
| **Node** | 16.0 | 18.0+ |
| **React Native** | 0.65.0 | 0.82.0+ |
| **Device** | Vision Pro | Simulator (in Xcode 15+) |

## Hardware Support

### Apple Vision Pro
- ✅ Optic ID biometric authentication
- ✅ Secure Enclave hardware encryption (all versions)
- ✅ Full hardware-backed security
- ✅ RealityKit integration ready

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

2. Select your visionOS target in Xcode

3. Go to **Build Settings** and verify:
   - **Minimum Deployments** is set to 1.0 or later
   - **Swift Language Version** is 5.5+
   - **Supported Destinations** includes visionOS

4. Go to **Build Phases** > **Link Binary With Libraries** and ensure:
   - `Security.framework`
   - `LocalAuthentication.framework`
   - `RealityKit.framework`

### Info.plist Configuration

visionOS apps typically don't require special Keychain permissions, but ensure your app's privacy description is present:

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
  keychainService: 'com.myapp.visionos'
});

// Retrieve the value
const apiKey = await SensitiveInfo.getItem('api-key', {
  keychainService: 'com.myapp.visionos'
});

console.log(`API Key: ${apiKey}`);
```

### With Optic ID Biometric Authentication

On Apple Vision Pro, Optic ID is always available and provides the strongest security:

```typescript
import { SensitiveInfo } from 'react-native-sensitive-info';

// Request Optic ID authentication
const secret = await SensitiveInfo.getItem('user-token', {
  keychainService: 'com.myapp.visionos',
  accessControl: 'biometryCurrentSet',
  prompt: {
    title: 'Look at Device to Unlock',
    subtitle: 'Authenticate with Optic ID'
  }
});

if (secret) {
  console.log('✅ Successfully authenticated with Optic ID!');
  // Use the secret
} else {
  console.log('❌ Authentication failed or was canceled');
}
```

### Detecting Hardware Capabilities

On visionOS, Secure Enclave and biometric are always available:

```typescript
import { SensitiveInfo } from 'react-native-sensitive-info';

const capabilities = await SensitiveInfo.getSupportedSecurityLevels();

console.log(`Secure Enclave: ${capabilities.secureEnclave}`); // ✅ Always true
console.log(`Biometric: ${capabilities.biometry}`);           // ✅ Always true (Optic ID)
console.log(`Biometry Type: ${capabilities.biometryType}`);   // 'opticID'
```

## Advanced Usage

### Always Using Secure Enclave

Secure Enclave is available on all visionOS versions (unlike iOS which requires iOS 16+):

```typescript
// Secure Enclave is always available on visionOS
const result = await SensitiveInfo.setItem('critical-key', 'value', {
  keychainService: 'com.myapp.visionos',
  accessControl: 'biometryCurrentSet', // Uses Secure Enclave
  authenticationPrompt: {
    title: 'Secure Enclave Protected'
  }
});

console.log(`Security Level: ${result.metadata?.securityLevel}`);
// Output: "secureEnclave" (always available)
```

### Spatial UI Integration

```typescript
import { SensitiveInfo } from 'react-native-sensitive-info';
import { useState } from 'react';

export function SpatialSecureComponent() {
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpticIDAuth = async () => {
    try {
      const token = await SensitiveInfo.getItem('spatial-token', {
        keychainService: 'com.myapp.visionos',
        prompt: {
          title: 'Authenticate Spatial App',
          subtitle: 'Look at your Vision Pro to verify'
        }
      });

      if (token) {
        setAuthenticated(true);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div>
      {!authenticated && (
        <button onClick={handleOpticIDAuth}>
          Authenticate with Optic ID
        </button>
      )}
      {authenticated && (
        <div>✅ Authenticated - Spatial Content Available</div>
      )}
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
    </div>
  );
}
```

### Cross-Device Synchronization

Store secrets that sync across all user's Apple devices:

```typescript
import { SensitiveInfo } from 'react-native-sensitive-info';

// Store on Vision Pro
await SensitiveInfo.setItem('shared-session', 'token123', {
  keychainService: 'com.myapp.ecosystem'
});

// Automatically accessible on user's iPhone, iPad, and Mac!
// (from your app on those devices - requires same Apple ID)
```

## React Hooks Integration

### Custom Hook for visionOS Storage

```typescript
import { useCallback, useState } from 'react';
import { SensitiveInfo } from 'react-native-sensitive-info';

interface UseVisionOSStorageOptions {
  service: string;
  requireOpticID?: boolean;
}

export function useVisionOSStorage(options: UseVisionOSStorageOptions) {
  const { service, requireOpticID = false } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const store = useCallback(
    async (key: string, value: string) => {
      setLoading(true);
      setError(null);

      try {
        // visionOS always has Secure Enclave + Optic ID
        const accessControl = requireOpticID
          ? 'biometryCurrentSet'        // Optic ID + Secure Enclave
          : 'biometryOrDevicePasscode'; // Optic ID or passcode

        await SensitiveInfo.setItem(key, value, {
          keychainService: service,
          accessControl,
          authenticationPrompt: requireOpticID
            ? {
                title: 'Save to Secure Storage',
                subtitle: 'Look at your device to confirm'
              }
            : undefined
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [service, requireOpticID]
  );

  const retrieve = useCallback(
    async (key: string) => {
      setLoading(true);
      setError(null);

      try {
        return await SensitiveInfo.getItem(key, {
          keychainService: service,
          prompt: requireOpticID
            ? {
                title: 'Unlock Content',
                subtitle: 'Look at your device to verify'
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
    [service, requireOpticID]
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

// Usage in spatial component
export function MyVisionOSComponent() {
  const storage = useVisionOSStorage({
    service: 'com.myapp.visionos',
    requireOpticID: true
  });

  const handleSave = async () => {
    await storage.store('spatial-data', 'value');
  };

  const handleLoad = async () => {
    const value = await storage.retrieve('spatial-data');
    console.log('Spatial Data:', value);
  };

  return (
    <div>
      {storage.loading && <p>Processing...</p>}
      {storage.error && (
        <p style={{ color: 'red' }}>Error: {storage.error.message}</p>
      )}
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

### Issue: "Optic ID not responding"

**Solution**: Optic ID requires the user to be wearing the Vision Pro and looking at it:
1. Ensure the device is properly positioned
2. Ensure adequate lighting
3. Wait 1-2 seconds for calibration
4. Try again

### Issue: "Authentication canceled by user"

This is normal when user dismisses the authentication prompt:

```typescript
try {
  const secret = await SensitiveInfo.getItem('key', {
    keychainService: 'com.myapp.visionos',
    prompt: { title: 'Authenticate' }
  });
} catch (error) {
  if (error.code === 'E_AUTH_CANCELED') {
    console.log('User canceled authentication');
  } else if (error.code === 'E_AUTH_FAILED') {
    console.log('Optic ID failed - try again');
  }
}
```

## Performance Considerations

### visionOS-Specific Tips

1. **Optic ID Latency**: Optic ID authentication typically completes in 1-3 seconds
2. **Keychain Access**: First access is ~5-10ms, subsequent accesses are faster
3. **Network**: Don't store API responses (they can change) - store tokens instead

### Optimization Pattern

```typescript
// ✅ Good: Cache token after authentication
let cachedSession: string | null = null;

async function getSession() {
  if (cachedSession) return cachedSession;
  
  cachedSession = await SensitiveInfo.getItem('session', {
    keychainService: 'com.myapp.visionos',
    prompt: { title: 'Verify Identity' }
  });
  
  return cachedSession;
}

// On logout or session expiry
function clearSession() {
  cachedSession = null;
  SensitiveInfo.deleteItem('session', {
    keychainService: 'com.myapp.visionos'
  });
}
```

## Simulator Testing

### Running on visionOS Simulator

1. In Xcode, select the visionOS simulator as the build destination
2. Build and run your app normally:

```bash
npx react-native run-ios --simulator="Apple Vision Pro"
```

### Testing Optic ID in Simulator

In the simulator, Optic ID authentication is simulated:
- First authentication attempt: Success
- Subsequent attempts: May vary based on simulator state
- Press the digital crown or swipe up to simulate user interaction

## Building for Distribution

### TestFlight & App Store

When preparing for TestFlight or App Store release:

1. **Code Signing**: Sign with valid visionOS certificate
2. **Provisioning Profile**: Use appropriate visionOS profile
3. **Entitlements**: Ensure Keychain entitlements are enabled
4. **Testing**: Test on actual Vision Pro device before submission

```bash
# Build for distribution
npm run build:visionos

# Archive
xcodebuild -workspace ios/YourApp.xcworkspace -scheme YourApp -configuration Release -archivePath archive.xcarchive archive

# Export to TestFlight or App Store
xcodebuild -exportArchive -archivePath archive.xcarchive -exportOptionsPlist export.plist -exportPath ./export
```

## Related Resources

- [Apple Keychain Services Documentation](https://developer.apple.com/documentation/security/keychain)
- [Optic ID Authentication](https://developer.apple.com/documentation/localauthentication)
- [visionOS Development Guide](https://developer.apple.com/visionos/)
- [Secure Enclave on visionOS](https://developer.apple.com/documentation/security/secure_enclave)
- [RealityKit Documentation](https://developer.apple.com/documentation/realitykit)

---

**Made with ❤️ for spatial computing developers**

Need help? [Open an issue on GitHub](https://github.com/mCodex/react-native-sensitive-info/issues)
