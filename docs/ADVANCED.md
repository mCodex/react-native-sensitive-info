# Advanced Usage

## Access Control & Metadata

`MutationResult` and `SensitiveInfoItem.metadata` surface how a value was stored:

### Security Levels

- `secureEnclave` — Hardware-backed on iOS (Secure Enclave)
- `strongBox` — Hardware-backed on Android (StrongBox)
- `biometry` — Biometric-protected (Face ID, fingerprint)
- `deviceCredential` — Device passcode/PIN protected
- `software` — Software encryption only (fallback)

### Backends

- `keychain` — iOS Keychain
- `androidKeystore` — Android KeyStore
- `encryptedSharedPreferences` — Android EncryptedSharedPreferences

### Access Policies

- `secureEnclaveBiometry` — Require biometric on Secure Enclave
- `biometryCurrentSet` — Require current enrolled biometrics
- `biometryAny` — Allow any enrolled biometric
- `devicePasscode` — Require device passcode
- `none` — No access control

### Example: Inspecting Metadata

```tsx
import { setItem, getItem } from 'react-native-sensitive-info'

// Write a value
const writeResult = await setItem('secret', 'value', {
  accessControl: 'secureEnclaveBiometry'
})

console.log({
  securityLevel: writeResult.metadata.securityLevel,    // 'secureEnclave'
  backend: writeResult.metadata.backend,                // 'keychain'
  timestamp: writeResult.metadata.timestamp,            // 1699564800
  accessControl: writeResult.metadata.accessControl    // 'secureEnclaveBiometry'
})

// Read and check metadata
const item = await getItem('secret', { includeValue: true })
console.log(`Stored on: ${new Date(item.metadata.timestamp * 1000)}`)
console.log(`Security: ${item.metadata.securityLevel}`)
```

## Device Capability Detection

Use `getSupportedSecurityLevels()` to tailor UX before prompting users:

```tsx
import { getSupportedSecurityLevels } from 'react-native-sensitive-info'

const capabilities = await getSupportedSecurityLevels()

if (capabilities.secureEnclave) {
  // Show Secure Enclave options
} else if (capabilities.strongBox) {
  // Show StrongBox options
} else if (capabilities.biometry) {
  // Show biometric options
} else {
  // Fallback to device passcode
}
```

## Simulator & Emulator Behavior

- **iOS simulators** don't have Secure Enclave. Biometric prompts fall back to passcode dialog.
- **Android emulators** rarely provide StrongBox. Biometric APIs may be stubbed.
- The example app displays these limitations prominently.

> [!IMPORTANT]
> Always test security policies on physical devices before shipping.

## Custom Access Control Selection

```tsx
import { 
  getItem, 
  getSupportedSecurityLevels,
  type AccessControl 
} from 'react-native-sensitive-info'

async function selectBestAccessControl(): Promise<AccessControl> {
  const caps = await getSupportedSecurityLevels()
  
  if (caps.secureEnclave) return 'secureEnclaveBiometry'
  if (caps.strongBox) return 'biometryCurrentSet'
  if (caps.biometry) return 'biometryCurrentSet'
  if (caps.deviceCredential) return 'devicePasscode'
  return 'none'
}

// Use the best available
const accessControl = await selectBestAccessControl()
await setItem('secret', 'value', { accessControl })
```

## Service-Based Organization

Organize secrets by service namespace:

```tsx
// Authentication service
await setItem('auth-token', token, { service: 'auth' })
await setItem('refresh-token', refreshToken, { service: 'auth' })

// Payment service
await setItem('payment-token', paymentToken, { service: 'payments' })

// List all auth secrets
const authSecrets = await getAllItems({ service: 'auth' })

// Clear payment secrets
await clearService({ service: 'payments' })
```

## Cross-App Keychain Sharing (iOS)

Share secrets between apps using Keychain groups:

```tsx
// In App A
await setItem('shared-secret', value, {
  keychainGroup: 'group.com.mycompany.shared'
})

// In App B (same Keychain group entitlement)
const item = await getItem('shared-secret', {
  keychainGroup: 'group.com.mycompany.shared'
})
```

Requires provisioning profiles with the matching Keychain group entitlement.

## iCloud Keychain Sync (iOS)

Enable automatic sync across user's Apple devices:

```tsx
await setItem('icloud-synced-secret', value, {
  iosSynchronizable: true,
  service: 'my-app'
})

// Automatically syncs to other user's devices
// And available when user signs into another device
```

## Conditional Storage

Store different data based on device capabilities:

```tsx
async function storeSecurely(key: string, value: string) {
  const caps = await getSupportedSecurityLevels()
  
  // Choose access control based on capabilities
  const accessControl = caps.secureEnclave ? 
    'secureEnclaveBiometry' : 
    'devicePasscode'
  
  await setItem(key, value, { accessControl })
}
```

## Error Recovery Patterns

### Retry with Fallback

```tsx
async function getItemWithFallback(key: string) {
  try {
    // Try reading with biometric
    return await getItem(key, { 
      accessControl: 'biometryCurrentSet' 
    })
  } catch (error) {
    // Fall back to passcode
    return await getItem(key, { 
      accessControl: 'devicePasscode' 
    })
  }
}
```

### Graceful Degradation

```tsx
async function getMaybeSecret(key: string) {
  try {
    const caps = await getSupportedSecurityLevels()
    
    if (!caps.biometry) {
      // Skip biometric if unavailable (e.g., simulator)
      return await getItem(key, { accessControl: 'none' })
    }
    
    return await getItem(key, { accessControl: 'biometryCurrentSet' })
  } catch {
    // Return mock data in development/testing
    return { key, value: 'mock-value' }
  }
}
```

## Bulk Operations

### Import Multiple Items

```tsx
async function importSecrets(secrets: Record<string, string>) {
  const results = []
  
  for (const [key, value] of Object.entries(secrets)) {
    try {
      const result = await setItem(key, value, {
        service: 'import'
      })
      results.push({ key, success: true, result })
    } catch (error) {
      results.push({ key, success: false, error })
    }
  }
  
  return results
}
```

### Export All Secrets

```tsx
async function exportSecrets(service: string) {
  const items = await getAllItems({ 
    service,
    includeValues: true 
  })
  
  return Object.fromEntries(
    items.map(item => [item.key, item.value])
  )
}
```

### Batch Deletion

```tsx
async function deleteSecrets(keys: string[], service: string) {
  for (const key of keys) {
    try {
      await deleteItem(key, { service })
    } catch (error) {
      console.error(`Failed to delete ${key}:`, error)
    }
  }
}
```

## Lifecycle Patterns

### App Launch

```tsx
async function initializeSecureStorage() {
  try {
    // Check if essential secrets exist
    const hasToken = await hasItem('auth-token', { service: 'auth' })
    
    if (!hasToken) {
      // Redirect to login
      return 'login'
    }
    
    // Try to read without prompting
    const token = await getItem('auth-token', {
      service: 'auth',
      accessControl: 'none'
    })
    
    return 'authenticated'
  } catch {
    return 'login'
  }
}
```

### App Backgrounding

```tsx
// Clean up sensitive data from memory
async function handleAppBackground() {
  // No action needed—native layer handles memory cleanup
  // JS secrets are garbage collected automatically
}
```

## Testing Strategies

### Mock Storage in Tests

```tsx
jest.mock('react-native-sensitive-info', () => ({
  setItem: jest.fn().mockResolvedValue({}),
  getItem: jest.fn().mockResolvedValue({ 
    value: 'test-value',
    metadata: { timestamp: 0 }
  }),
  hasItem: jest.fn().mockResolvedValue(true),
  deleteItem: jest.fn().mockResolvedValue(true),
  getAllItems: jest.fn().mockResolvedValue([])
}))
```

### Simulate Biometric Cancellation

```tsx
// On iOS simulator
// Xcode → Features → Face ID → Matching Face → Enrolled
// Xcode → Features → Face ID → Matching Face → Alternate Appearance
// Or use hardware keyboard: Cmd+Ctrl+Z to cancel

// On Android emulator
// Android Studio → Extended Controls → Fingerprints → toggle Enrolled
// Use emulator console: auth fingerprint <fingerprint_id>
```

## Performance Optimization

### Lazy Load Secrets

```tsx
async function* loadSecretsLazy(service: string) {
  const items = await getAllItems({ 
    service,
    includeValues: false  // Fast metadata query
  })
  
  for (const item of items) {
    const full = await getItem(item.key, { includeValue: true })
    yield full
  }
}
```

### Batch with Progress

```tsx
async function importWithProgress(
  secrets: Record<string, string>,
  onProgress: (current: number, total: number) => void
) {
  const entries = Object.entries(secrets)
  
  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i]
    await setItem(key, value)
    onProgress(i + 1, entries.length)
  }
}
```

## Common Patterns

See [HOOKS.md](./HOOKS.md) for comprehensive React hook patterns and advanced usage examples.
