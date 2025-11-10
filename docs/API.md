# API Reference

Complete reference for all methods, options, and types.

## Methods

### `setItem(key, value, options?)`

Saves a secret to secure storage.

**Parameters:**
- `key` (string, required) — Storage key. Must be non-empty and alphanumeric + underscore
- `value` (string, required) — The secret value to store
- `options` (object, optional) — Configuration options (see below)

**Returns:**
```typescript
Promise<MutationResult> {
  metadata: {
    timestamp: number           // Unix seconds
    securityLevel: SecurityLevel // Hardware protection level
    backend: Backend             // Storage backend used
    accessControl: AccessControl // Security policy applied
  }
}
```

**Example:**
```typescript
const result = await setItem('auth-token', 'secret', {
  service: 'auth',
  accessControl: 'secureEnclaveBiometry'
})
console.log(result.metadata.securityLevel)  // 'secureEnclave'
```

---

### `getItem(key, options?)`

Retrieves a secret from storage.

**Parameters:**
- `key` (string, required) — Storage key
- `options` (object, optional) — Configuration options

**Returns:**
```typescript
Promise<SensitiveInfoItem | null> {
  key: string
  value?: string                           // Omitted if includeValue: false
  metadata: {
    timestamp: number
    securityLevel: SecurityLevel
    backend: Backend
    accessControl: AccessControl
  }
}
```

Returns `null` if key doesn't exist.

**Example:**
```typescript
// Get with decrypted value
const item = await getItem('auth-token', { service: 'auth' })
console.log(item?.value)

// Get metadata only (faster, no decryption)
const itemMeta = await getItem('auth-token', {
  service: 'auth',
  includeValue: false
})
```

---

### `hasItem(key, options?)`

Checks if a secret exists without retrieving it.

**Parameters:**
- `key` (string, required) — Storage key
- `options` (object, optional) — Configuration options

**Returns:**
```typescript
Promise<boolean>
```

**Example:**
```typescript
const exists = await hasItem('auth-token', { service: 'auth' })
if (!exists) {
  // Redirect to login
}
```

---

### `deleteItem(key, options?)`

Removes a secret from storage.

**Parameters:**
- `key` (string, required) — Storage key
- `options` (object, optional) — Configuration options

**Returns:**
```typescript
Promise<boolean>  // true if deleted, false if not found
```

**Example:**
```typescript
const deleted = await deleteItem('auth-token', { service: 'auth' })
if (deleted) {
  console.log('Secret removed')
}
```

---

### `getAllItems(options?)`

Lists all secrets in a service namespace.

**Parameters:**
- `options` (object, optional) — Configuration options

**Returns:**
```typescript
Promise<SensitiveInfoItem[]> {
  [
    {
      key: string
      value?: string                       // Omitted if includeValues: false
      metadata: { /* ... */ }
    }
  ]
}
```

**Example:**
```typescript
// Get all items with metadata only (fast)
const items = await getAllItems({ 
  service: 'auth',
  includeValues: false 
})

// Get all items with decrypted values
const fullItems = await getAllItems({ 
  service: 'auth',
  includeValues: true 
})
```

---

### `clearService(options?)`

Removes all secrets in a service namespace.

**Parameters:**
- `options` (object, optional) — Configuration options

**Returns:**
```typescript
Promise<void>
```

**Example:**
```typescript
await clearService({ service: 'auth' })
// All auth service secrets deleted
```

---

### `getSupportedSecurityLevels()`

Queries device security capabilities.

**Parameters:** None

**Returns:**
```typescript
Promise<SecurityAvailability> {
  secureEnclave: boolean           // iOS Secure Enclave available
  strongBox: boolean               // Android StrongBox available
  biometry: boolean                // Biometric authentication available
  biometryType: 'face' | 'fingerprint' | 'iris' | null
  deviceCredential: boolean        // Device passcode/PIN available
  timestamp: number                // When queried (Unix seconds)
}
```

**Example:**
```typescript
const caps = await getSupportedSecurityLevels()

if (caps.secureEnclave) {
  console.log('Secure Enclave available')
} else if (caps.strongBox) {
  console.log('StrongBox available')
} else {
  console.log('Software encryption only')
}
```

---

## Options (Shared)

Configuration object passed to most methods:

```typescript
interface StorageOptions {
  service?: string                   // Logical namespace (default: bundle ID)
  accessControl?: AccessControl      // Security policy (default: 'secureEnclaveBiometry')
  authenticationPrompt?: {
    title?: string                   // Biometric prompt title
    subtitle?: string                // Biometric prompt subtitle
    description?: string             // Biometric prompt description
    negativeButtonText?: string      // Cancel button text (Android)
    cancel?: string                  // Cancel button text (iOS)
    fallback?: string                // Fallback button text
    disableDeviceCredentialFallback?: boolean  // Disable device passcode fallback
  }
  iosSynchronizable?: boolean        // Enable iCloud sync (iOS only)
  keychainGroup?: string             // Keychain sharing group (iOS only)
  includeValue?: boolean             // Include decrypted value in response
  includeValues?: boolean            // Include values in getAllItems results
}
```

### `service`
Logical namespace for grouping secrets. Queries and operations are scoped to the service.

```typescript
// Different services are isolated
await setItem('token', 'auth-value', { service: 'auth' })
await setItem('token', 'payment-value', { service: 'payments' })

// Each has its own 'token' key
const auth = await getItem('token', { service: 'auth' })
const payment = await getItem('token', { service: 'payments' })
```

Default: Your app's bundle identifier

### `accessControl`
Security policy applied to the secret. Device automatically chooses strongest available fallback.

**Values:**
- `'secureEnclaveBiometry'` — Require Secure Enclave + biometric (iOS only)
- `'biometryCurrentSet'` — Require current enrolled biometrics
- `'biometryAny'` — Allow any enrolled biometric (less secure)
- `'devicePasscode'` — Require device passcode/PIN
- `'none'` — No access control (software encryption only)

```typescript
// Best security
await setItem('secret', value, { accessControl: 'secureEnclaveBiometry' })

// Fallback to passcode if unavailable
await setItem('secret', value, { accessControl: 'biometryCurrentSet' })

// No biometric requirement
await setItem('secret', value, { accessControl: 'none' })
```

### `authenticationPrompt`
Customize biometric/passcode prompt strings.

```typescript
await setItem('secret', value, {
  authenticationPrompt: {
    title: 'Unlock secrets',
    description: 'Authenticate to save',
    cancel: 'Cancel'
  }
})
```

iOS shows title + description. Android shows title + negativeButtonText.

### `iosSynchronizable`
Enable automatic iCloud Keychain sync (iOS only).

```typescript
await setItem('icloud-secret', value, {
  iosSynchronizable: true  // Syncs to user's other Apple devices
})
```

Requires iCloud entitlement and user sync enabled.

### `keychainGroup`
Share secrets between apps using Keychain group (iOS only).

```typescript
await setItem('shared', value, {
  keychainGroup: 'group.com.mycompany.shared'
})

// Other app with same entitlement can read:
const item = await getItem('shared', {
  keychainGroup: 'group.com.mycompany.shared'
})
```

Requires provisioning profiles with matching Keychain group entitlement.

### `includeValue` / `includeValues`
Control whether decrypted values are returned.

```typescript
// Fast: metadata only (~5ms)
const item = await getItem('key', { includeValue: false })
// item.value is undefined

// Slower: includes decryption (~30ms)
const item = await getItem('key', { includeValue: true })
// item.value is 'decrypted-value'
```

Use `includeValue: false` for list views to improve performance.

---

## Types

### `SecurityLevel`
Hardware protection level of stored secret:
```typescript
type SecurityLevel = 
  | 'secureEnclave'      // iOS Secure Enclave
  | 'strongBox'          // Android StrongBox
  | 'biometry'           // Biometric-protected
  | 'deviceCredential'   // Device credential protected
  | 'software'           // Software encryption only
```

### `Backend`
Storage backend used:
```typescript
type Backend = 
  | 'keychain'                      // iOS Keychain
  | 'androidKeystore'               // Android Keystore
  | 'encryptedSharedPreferences'    // Android EncryptedSharedPreferences
```

### `AccessControl`
Security policy for storage:
```typescript
type AccessControl = 
  | 'secureEnclaveBiometry'  // Secure Enclave + biometric
  | 'biometryCurrentSet'     // Current biometric enrollment
  | 'biometryAny'            // Any biometric enrolled
  | 'devicePasscode'         // Device passcode
  | 'none'                   // Software encryption
```

### `SensitiveInfoItem`
Retrieved secret with metadata:
```typescript
interface SensitiveInfoItem {
  key: string
  value?: string           // Undefined if includeValue: false
  metadata: ItemMetadata
}

interface ItemMetadata {
  timestamp: number        // Unix seconds when stored
  securityLevel: SecurityLevel
  backend: Backend
  accessControl: AccessControl
}
```

### `MutationResult`
Result of write operation:
```typescript
interface MutationResult {
  metadata: ItemMetadata
}
```

### `SecurityAvailability`
Device capability snapshot:
```typescript
interface SecurityAvailability {
  secureEnclave: boolean
  strongBox: boolean
  biometry: boolean
  biometryType?: 'face' | 'fingerprint' | 'iris'
  deviceCredential: boolean
  timestamp: number
}
```

---

## Error Handling

All methods throw `SensitiveInfoError` on failure:

```typescript
import { SensitiveInfoError, ErrorCode } from 'react-native-sensitive-info'

try {
  await setItem('key', 'value')
} catch (error) {
  if (error instanceof SensitiveInfoError) {
    console.error(error.code)      // ErrorCode
    console.error(error.message)   // Human-readable message
    console.error(error.cause)     // Original native error
  }
}
```

See [Error Handling Guide](./ERROR_HANDLING.md) for all error codes and handling patterns.

---

## React Hooks

For reactive access with lifecycle management, see:
- **[React Hooks Guide](./HOOKS.md)** — Complete reference with examples

Quick reference:
| Hook | Purpose |
| --- | --- |
| `useSecureStorage()` | Manage all secrets in service |
| `useSecretItem()` | Single secret |
| `useSecret()` | Single secret with mutations |
| `useHasSecret()` | Lightweight existence check |
| `useSecurityAvailability()` | Device capabilities |

---

## Configuration

### Validation Rules

- **Key**: Non-empty, alphanumeric + underscore, max 255 characters
- **Value**: Non-empty string, max storage backend limit (typically 4KB)
- **Service**: Non-empty alphanumeric + underscore

Violations throw `SensitiveInfoError` with `ErrorCode.InvalidKey` etc.

### Defaults

```typescript
{
  service: Bundle identifier,
  accessControl: 'secureEnclaveBiometry',
  authenticationPrompt: {
    title: 'Authentication required',
    cancel: 'Cancel'
  },
  includeValue: true,
  iosSynchronizable: false,
  keychainGroup: undefined
}
```

---

## Performance Tips

- Use `includeValue: false` for metadata-only queries
- Batch operations with `getAllItems()` instead of loops
- Cache `getSupportedSecurityLevels()` results
- Reduce biometric operations when possible
- See [Performance Guide](./PERFORMANCE.md) for full optimization tips

---

## Version Support

Minimum versions:
- React Native: 0.76.0
- iOS: 13.0
- Android: API 23 (Marshmallow)
- macOS: 11.0 (Big Sur)
- visionOS: 1.0
- watchOS: 7.0
