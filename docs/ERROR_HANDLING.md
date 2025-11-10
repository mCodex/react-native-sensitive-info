# Error Handling

## Overview

Every public hook returns failures as `HookError` instances, carrying operation context and user-friendly hints alongside the original error.

Imperative API calls reject with detailed error objects that include:
- `message` — Human-readable error description
- `operation` — The hook action or API call that failed
- `cause` — The original native error for diagnostics
- `hint` — Short suggestion for user-facing toast messages

## Hook Error Structure

```tsx
interface HookError {
  message: string           // "Could not save secret"
  operation: string         // "useSecureStorage.saveSecret"
  cause?: Error            // Original native error
  hint?: string            // "The secure enclave is not available on simulators."
}
```

## Error Codes (TypeScript)

The library provides typed error codes for precise error classification:

```typescript
import { SensitiveInfoError, ErrorCode } from 'react-native-sensitive-info'

enum ErrorCode {
  // Item operations
  ItemNotFound = 'E_ITEM_NOT_FOUND',
  ItemAlreadyExists = 'E_ITEM_ALREADY_EXISTS',
  
  // Validation
  InvalidKey = 'E_INVALID_KEY',
  InvalidValue = 'E_INVALID_VALUE',
  InvalidService = 'E_INVALID_SERVICE',
  InvalidOptions = 'E_INVALID_OPTIONS',
  
  // Storage
  StorageCorrupted = 'E_STORAGE_CORRUPTED',
  StorageUnavailable = 'E_STORAGE_UNAVAILABLE',
  
  // Security
  SecurityUnavailable = 'E_SECURITY_UNAVAILABLE',
  BiometryUnavailable = 'E_BIOMETRY_UNAVAILABLE',
  
  // Authentication
  AuthenticationFailed = 'E_AUTH_FAILED',
  AuthenticationCanceled = 'E_AUTH_CANCELED',
  
  // Encryption
  EncryptionFailed = 'E_ENCRYPTION_FAILED',
  DecryptionFailed = 'E_DECRYPTION_FAILED',
  
  // Key rotation
  KeyRotationFailed = 'E_KEY_ROTATION_FAILED',
  
  // Internal
  Unknown = 'E_UNKNOWN'
}
```

## Using Error Codes

Check for specific error types:

```typescript
import { SensitiveInfoError, ErrorCode } from 'react-native-sensitive-info'

try {
  const item = await getItem('auth-token', { service: 'auth' })
} catch (error) {
  if (error instanceof SensitiveInfoError) {
    if (error.code === ErrorCode.AuthenticationCanceled) {
      // User dismissed the prompt—handle gracefully
      console.log('User declined authentication')
    } else if (error.code === ErrorCode.BiometryUnavailable) {
      // Fall back to device passcode
      console.log('Biometric unavailable, use passcode')
    } else {
      // Generic error handling
      console.error('Storage error:', error.message)
    }
  }
}
```

## Hook Error Handling

```tsx
import { Text } from 'react-native'
import { useSecureStorage } from 'react-native-sensitive-info'

function SecretsList() {
  const { items, error } = useSecureStorage({ 
    service: 'auth', 
    includeValues: true 
  })

  if (error) {
    // Error is already translated to user-friendly format
    return (
      <Text testID="secure-error">
        {error.message}
        {error.hint && (
          <>
            {'\n'}
            <Text style={{ fontSize: 12, color: '#999' }}>
              Hint: {error.hint}
            </Text>
          </>
        )}
      </Text>
    )
  }

  return items.length === 0 ? (
    <Text>No secrets stored yet.</Text>
  ) : (
    <Text>{items.map((item) => item.key).join(', ')}</Text>
  )
}
```

## Common Error Scenarios

### Authentication Canceled
When a user dismisses a biometric or device credential prompt:

```typescript
try {
  await setItem('secret', 'value', {
    accessControl: 'biometryCurrentSet',
    authenticationPrompt: {
      title: 'Authenticate to save'
    }
  })
} catch (error) {
  if (error instanceof SensitiveInfoError && 
      error.code === ErrorCode.AuthenticationCanceled) {
    // User dismissed—no need for error toast
    console.log(error.message)
  }
}
```

For hooks, cancellations surface as a user-friendly message and do NOT poison hook state:

```tsx
const { items, error } = useSecureStorage({ service: 'auth' })

if (error?.message.includes('Authentication prompt canceled')) {
  // Handle as cancellation, not an error
  return <Text>Authentication skipped by user</Text>
}
```

### Security Not Available
When the device lacks requested hardware (Secure Enclave, StrongBox, etc.):

```typescript
try {
  const availability = await getSupportedSecurityLevels()
  
  if (!availability.secureEnclave && !availability.strongBox) {
    // Fallback to software encryption
    await setItem('key', 'value', { 
      accessControl: 'none' 
    })
  }
} catch (error) {
  if (error instanceof SensitiveInfoError &&
      error.code === ErrorCode.SecurityUnavailable) {
    console.error('No secure storage available')
  }
}
```

### Validation Errors
When input does not meet constraints:

```typescript
try {
  // Keys must be non-empty alphanumeric
  await setItem('', 'value')
} catch (error) {
  if (error instanceof SensitiveInfoError && 
      error.code === ErrorCode.InvalidKey) {
    console.error('Key validation failed:', error.message)
  }
}
```

## Imperative vs Hook Error Behavior

| Scenario | Imperative API | Hooks |
| --- | --- | --- |
| User cancels biometric | Rejects with `AuthenticationCanceled` | Friendly message, state preserved |
| Item not found | Rejects with `ItemNotFound` | `data` is `null`, no error |
| Invalid input | Rejects with `InvalidKey` etc | Operation prevented, error shown |
| Security unavailable | Rejects with `SecurityUnavailable` | Operation prevented, error shown |

Choose imperative calls when you need detailed control, and hooks for reactive UI patterns.

## Type Safety

All errors are properly typed:

```typescript
import type { SensitiveInfoError } from 'react-native-sensitive-info'

function handleError(error: SensitiveInfoError) {
  switch (error.code) {
    case 'E_ITEM_NOT_FOUND':
      // Handle not found
      break
    case 'E_AUTH_CANCELED':
      // Handle cancellation
      break
    default:
      // Handle generic
      break
  }
}
```

## Debugging

Enable detailed logging on both platforms to trace error origins:

### iOS
```swift
// Enable Keychain debugging in Xcode
// Products → Scheme → Edit Scheme → Run → Environment Variables
// Add: `OS_LOG_DEFAULT=info` for system logging
```

### Android
```kotlin
// Enable Logcat filtering in Android Studio
// Logcat → Filter by package name: com.sensitiveinfo
```

### TypeScript
```typescript
// Catch and log all errors with context
try {
  // Your operation
} catch (error) {
  if (error instanceof SensitiveInfoError) {
    console.error({
      code: error.code,
      message: error.message,
      operation: error.operation,
      cause: error.cause
    })
  }
}
```

## Best Practices

1. **Always check error codes** — Use typed error codes instead of string matching
2. **Handle cancellation separately** — User dismissal is not a storage error
3. **Provide context hints** — Show the `error.hint` to guide users
4. **Log with operation context** — Include the operation name for debugging
5. **Test error paths** — Verify your error UI on all platforms and error types
6. **Use hooks for UI errors** — Hooks handle error translation automatically
7. **Use imperative for detailed control** — When you need granular handling
