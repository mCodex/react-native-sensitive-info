# watchOS Setup Guide

> ✨ **NEW in v5.6.0**: Full native watchOS support with Keychain synchronization

## Overview

React Native Sensitive Info now provides complete Apple Watch support, enabling you to build watchOS applications with secure credential storage. Note that watchOS has unique characteristics - primarily device passcode protection and shared Keychain with the paired iPhone.

## Requirements

| Component | Minimum | Recommended |
|-----------|---------|------------|
| **watchOS** | 6.0 | 10.0+ |
| **Xcode** | 12.0 | 15.3+ |
| **Swift** | 5.5 | 5.9+ |
| **Node** | 16.0 | 18.0+ |
| **React Native** | 0.65.0 | 0.82.0+ |
| **Pairing** | Paired iPhone | Same Apple ID |

## Hardware Support

### Apple Watch
- ✅ Device passcode protection
- ✅ Shared Keychain with paired iPhone
- ❌ No biometric authentication (no Face ID, Touch ID, Optic ID)
- ⚠️ Limited to watch being unlocked and worn

## Key Limitations

### Biometric Authentication

⚠️ **watchOS does NOT support biometric authentication**:
- No fingerprint scanner
- No face recognition
- No gesture-based unlock

Instead, watchOS uses:
- **Device Passcode**: User must unlock their watch
- **Shared Keychain**: Syncs with paired iPhone's Keychain

### User Experience

- Authentication prompts are not applicable on watchOS
- Watch must be **unlocked and worn on wrist**
- Battery drain is a consideration for frequent access

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

2. Select your watchOS target in Xcode

3. Go to **Build Settings** and verify:
   - **Minimum Deployments** is set to 6.0 or later
   - **Swift Language Version** is 5.5+

4. Go to **Build Phases** > **Link Binary With Libraries** and ensure:
   - `Security.framework`
   - `LocalAuthentication.framework` (for graceful degradation)
   - `WatchKit.framework`

### Info.plist Configuration

Most watchOS apps don't require special permissions:

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

// Store a value (uses device passcode protection)
await SensitiveInfo.setItem('watch-data', 'value', {
  keychainService: 'com.myapp.watch'
});

// Retrieve the value
const data = await SensitiveInfo.getItem('watch-data', {
  keychainService: 'com.myapp.watch'
});

console.log(`Watch Data: ${data}`);
```

### Platform Awareness

```typescript
import { SensitiveInfo } from 'react-native-sensitive-info';

// Check if running on watchOS
const capabilities = await SensitiveInfo.getSupportedSecurityLevels();

if (!capabilities.biometry) {
  console.log('Running on watchOS - no biometric available');
  console.log('Using device passcode protection');
}

// Store without biometric requirement
await SensitiveInfo.setItem('simple-key', 'value', {
  keychainService: 'com.myapp.watch',
  accessControl: 'devicePasscode' // watchOS limitation
});
```

## Advanced Usage

### Shared Keychain with Paired iPhone

When a watch is paired with an iPhone, they share a Keychain:

```typescript
import { SensitiveInfo } from 'react-native-sensitive-info';

// On iPhone: Store a secret
await SensitiveInfo.setItem('shared-data', 'value', {
  keychainService: 'com.myapp.ecosystem'
});

// On Apple Watch: Retrieve (synced from iPhone)
const sharedData = await SensitiveInfo.getItem('shared-data', {
  keychainService: 'com.myapp.ecosystem'
});

// ✅ Returns the same value stored on iPhone!
```

### Synchronized Secrets Pattern

```typescript
import { SensitiveInfo } from 'react-native-sensitive-info';

export class SyncedSecretManager {
  private service = 'com.myapp.ecosystem';

  // iPhone app stores
  async storeSessionToken(token: string) {
    await SensitiveInfo.setItem('session-token', token, {
      keychainService: this.service
    });
    console.log('✓ Token stored and syncing to watch...');
  }

  // Watch app retrieves
  async getSessionToken() {
    const token = await SensitiveInfo.getItem('session-token', {
      keychainService: this.service
    });
    
    if (token) {
      console.log('✓ Retrieved synced token from iPhone');
    } else {
      console.log('⚠ Token not yet synced from iPhone');
    }
    
    return token;
  }

  // Sync configuration across devices
  async syncConfiguration(config: Record<string, string>) {
    for (const [key, value] of Object.entries(config)) {
      await SensitiveInfo.setItem(key, value, {
        keychainService: this.service
      });
    }
    console.log('✓ Configuration synced');
  }

  // Watch reads all synced config
  async readSyncedConfiguration() {
    const keys = await SensitiveInfo.getAllItems({
      keychainService: this.service
    });

    const config: Record<string, string> = {};

    for (const key of keys) {
      const value = await SensitiveInfo.getItem(key, {
        keychainService: this.service
      });
      if (value) config[key] = value;
    }

    return config;
  }
}

// Usage
const manager = new SyncedSecretManager();

// iPhone: Store
await manager.storeSessionToken('token123');

// Watch: Retrieve (after sync)
const token = await manager.getSessionToken(); // Returns 'token123'
```

## React Hooks Integration

### Custom Hook for watchOS Storage

```typescript
import { useCallback, useState } from 'react';
import { SensitiveInfo } from 'react-native-sensitive-info';

interface UseWatchOSStorageOptions {
  service: string;
}

export function useWatchOSStorage(options: UseWatchOSStorageOptions) {
  const { service } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const store = useCallback(
    async (key: string, value: string) => {
      setLoading(true);
      setError(null);

      try {
        await SensitiveInfo.setItem(key, value, {
          keychainService: service,
          accessControl: 'devicePasscode' // watchOS only supports this
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [service]
  );

  const retrieve = useCallback(
    async (key: string) => {
      setLoading(true);
      setError(null);

      try {
        // Note: watchOS ignores prompt parameter (no biometric available)
        return await SensitiveInfo.getItem(key, {
          keychainService: service
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [service]
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

  const listAll = useCallback(
    async () => {
      setLoading(true);
      setError(null);

      try {
        return await SensitiveInfo.getAllItems({
          keychainService: service
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return [];
      } finally {
        setLoading(false);
      }
    },
    [service]
  );

  return { store, retrieve, remove, listAll, loading, error };
}

// Usage in watchOS component
export function MyWatchComponent() {
  const storage = useWatchOSStorage({
    service: 'com.myapp.watch'
  });

  const [items, setItems] = useState<string[]>([]);

  const handleLoad = async () => {
    const allItems = await storage.listAll();
    setItems(allItems);
  };

  return (
    <div>
      {storage.loading && <p>Loading...</p>}
      {storage.error && (
        <p style={{ color: 'red' }}>Error: {storage.error.message}</p>
      )}
      <button onClick={handleLoad}>Load Items</button>
      <ul>
        {items.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
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

### Issue: "Data not syncing from iPhone to watch"

**Causes & Solutions**:
1. **Watch not paired**: Ensure watch is properly paired to iPhone
2. **Not same Apple ID**: Verify both devices use the same Apple ID
3. **Keychain not enabled**: Check iPhone Settings > iCloud > Keychain is ON
4. **Network connection**: Ensure watch has Bluetooth connection to iPhone
5. **Sync delay**: Allow 5-30 seconds for data to propagate

```typescript
// Retry pattern for synced data
async function getDataWithRetry(key: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const data = await SensitiveInfo.getItem(key, {
        keychainService: 'com.myapp.ecosystem'
      });
      
      if (data) return data;
      
      // Wait before retry (data might still be syncing)
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return null;
}
```

### Issue: "Frequent authentication prompts"

**Note**: watchOS doesn't prompt for biometric, but if stored items are accessed:
- Watch must be unlocked
- User is already authenticated via device passcode
- No additional prompts will appear

### Issue: "Watch keeps asking to unlock"

This is expected behavior:
1. Watch locks after 15 minutes of inactivity (configurable)
2. User must unlock with passcode
3. Keychain items are then accessible

**Solution**: Consider caching data on watch after initial fetch:

```typescript
// Cache data on watch to avoid frequent Keychain access
let cachedConfig: Record<string, string> | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getConfigCached() {
  const now = Date.now();
  
  if (cachedConfig && (now - cacheTime) < CACHE_TTL) {
    return cachedConfig; // Return cached data
  }

  // Fetch fresh data (watch might need to be unlocked)
  cachedConfig = await fetchConfigFromKeychain();
  cacheTime = now;
  
  return cachedConfig;
}
```

## Performance Considerations

### watchOS-Specific Tips

1. **Battery Drain**: Frequent Keychain access impacts battery life
2. **Sync Latency**: Synced items take 5-30 seconds to propagate
3. **Storage Capacity**: Watch has limited storage (typically 16GB or 32GB)
4. **Network Dependency**: Watch relies on iPhone or WiFi for sync

### Optimization Pattern

```typescript
// ✅ Good: Minimize frequent access
const config = await getConfigCached(); // Use cache
const token = config['token'];

// ❌ Bad: Frequent Keychain access
setInterval(() => {
  SensitiveInfo.getItem('token', { keychainService: 'app' }); // Battery drain!
}, 5000);

// ✅ Better: Sync once and cache
async function initializeWatch() {
  // Sync all needed data once
  const config = await manager.readSyncedConfiguration();
  
  // Store in memory
  sessionStorage.setItem('config', JSON.stringify(config));
  
  // Use memory cache for duration of watch session
}
```

## Simulator Testing

### Running on watchOS Simulator

1. In Xcode, select the watchOS simulator as the build destination
2. Build and run your app:

```bash
npx react-native run-ios --simulator="Apple Watch Series 9"
```

### Testing Keychain Sync in Simulator

In the simulator, you can simulate iPhone-watch pairing:
- Store data using iPhone simulator
- Switch to watch simulator
- Data should be available (simulated sync)

## Building for Distribution

### TestFlight & App Store

When preparing for TestFlight or App Store release:

1. **Code Signing**: Sign with valid watchOS certificate
2. **Provisioning Profile**: Use appropriate watchOS profile
3. **Pairing**: Test on actual paired watch and iPhone before submission
4. **Sync Testing**: Verify Keychain sync works with actual devices

```bash
# Build for distribution
npm run build:watchos

# Archive
xcodebuild -workspace ios/YourApp.xcworkspace -scheme YourApp-Watch -configuration Release -archivePath archive.xcarchive archive

# Export for TestFlight
xcodebuild -exportArchive -archivePath archive.xcarchive -exportOptionsPlist export.plist -exportPath ./export
```

## Best Practices for watchOS Apps

### 1. Embrace Shared Keychain
```typescript
// Store on iPhone, access on watch
// Minimizes duplicate storage
```

### 2. Minimize Keychain Access
```typescript
// Cache frequently accessed data
// Reduces battery drain
```

### 3. Handle Sync Delays
```typescript
// Implement retry logic
// Show loading indicators during sync
```

### 4. Keep Storage Minimal
```typescript
// Store only essential secrets
// Not entire API responses
```

## Related Resources

- [watchOS Development Guide](https://developer.apple.com/watchos/)
- [Apple Keychain Services Documentation](https://developer.apple.com/documentation/security/keychain)
- [LocalAuthentication Framework](https://developer.apple.com/documentation/localauthentication)
- [WatchKit Documentation](https://developer.apple.com/documentation/watchkit)
- [Paired Watch Communication](https://developer.apple.com/documentation/watchconnectivity)

---

**Made with ❤️ for watchOS developers**

Need help? [Open an issue on GitHub](https://github.com/mCodex/react-native-sensitive-info/issues)
