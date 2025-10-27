# React Hooks for react-native-sensitive-info

This document covers the React hooks API for `react-native-sensitive-info`, designed with modern React best practices including automatic cleanup, memory leak prevention, and performance optimization.

## Table of Contents

- [Quick Start](#quick-start)
- [Core Hooks](#core-hooks)
- [Best Practices](#best-practices)
- [Performance Considerations](#performance-considerations)
- [Error Handling](#error-handling)
- [Migration Guide](#migration-guide)
- [Examples](#examples)

## Quick Start

### Installation

```bash
npm install react-native-sensitive-info
# or
yarn add react-native-sensitive-info
```

### Basic Usage

```tsx
import { useSecretItem, useSecureStorage } from 'react-native-sensitive-info/hooks'

function MyComponent() {
  // Read a single secret
  const { data, isLoading, error } = useSecretItem('apiToken')
  
  // Manage all secrets in a service
  const { items, saveSecret, removeSecret } = useSecureStorage({
    service: 'myapp'
  })

  if (isLoading) return <Text>Loading...</Text>
  if (error) return <Text>Error: {error.message}</Text>

  return <Text>{data?.value}</Text>
}
```

## Core Hooks

### `useSecretItem`

Fetches and manages a single secure storage item with automatic loading and error states.

#### API

```typescript
function useSecretItem(
  key: string,
  options?: SensitiveInfoOptions & { 
    includeValue?: boolean
    skip?: boolean
  }
): AsyncState<SensitiveInfoItem> & { 
  refetch: () => Promise<void>
}

interface AsyncState<TData> {
  data: TData | null
  error: HookError | null
  isLoading: boolean
  isPending: boolean
}
```

#### Features

- ✅ Automatic request cancellation on unmount
- ✅ Memory leak prevention via cleanup
- ✅ Conditional loading with `skip` parameter
- ✅ Manual refetch support
- ✅ Type-safe error handling

#### Example

```tsx
function TokenViewer() {
  const { data, isLoading, error, refetch } = useSecretItem('refreshToken', {
    service: 'auth',
    accessControl: 'secureEnclaveBiometry',
    authenticationPrompt: {
      title: 'Authenticate',
      description: 'Required to access your token'
    }
  })

  if (isLoading) return <ActivityIndicator />
  if (error) return <Text>Failed to load token: {error.message}</Text>
  if (!data) return <Text>No token found</Text>

  return (
    <View>
      <Text>{data.value}</Text>
      <Button title="Refresh" onPress={refetch} />
    </View>
  )
}
```

---

### `useSecret`

A convenience hook that combines reading and writing a single secret. Includes save and delete operations.

#### API

```typescript
function useSecret(
  key: string,
  options?: SensitiveInfoOptions & { includeValue?: boolean }
): AsyncState<SensitiveInfoItem> & {
  saveSecret: (value: string) => Promise<{ success: boolean; error?: HookError }>
  deleteSecret: () => Promise<{ success: boolean; error?: HookError }>
  refetch: () => Promise<void>
}
```

#### Features

- ✅ Read and write in a single hook
- ✅ Automatic state synchronization after mutations
- ✅ Optimized for single secret management

#### Example

```tsx
function AuthTokenManager() {
  const {
    data: token,
    isLoading,
    saveSecret,
    deleteSecret,
    refetch
  } = useSecret('authToken', { service: 'myapp' })

  const handleLogout = async () => {
    const { success, error } = await deleteSecret()
    if (success) {
      navigateTo('Login')
    } else {
      showError(error?.message)
    }
  }

  const handleRefreshToken = async (newToken: string) => {
    const { success } = await saveSecret(newToken)
    if (success) {
      showNotification('Token updated')
      await refetch()
    }
  }

  return (
    <View>
      {token && <Text>Token exists: {token.metadata.securityLevel}</Text>}
      <Button title="Update Token" onPress={() => handleRefreshToken('new')} />
      <Button title="Logout" onPress={handleLogout} />
    </View>
  )
}
```

---

### `useHasSecret`

Lightweight hook for checking if a secret exists without fetching its value.

#### API

```typescript
function useHasSecret(
  key: string,
  options?: SensitiveInfoOptions & { skip?: boolean }
): AsyncState<boolean> & { 
  refetch: () => Promise<void>
}
```

#### Features

- ✅ Efficient existence checks
- ✅ Minimal performance overhead
- ✅ No decryption needed

#### Example

```tsx
function ConditionalContent() {
  const { data: tokenExists, isLoading } = useHasSecret('apiToken')

  if (isLoading) return <Text>Checking...</Text>

  return tokenExists ? <AuthenticatedContent /> : <LoginForm />
}
```

---

### `useSecureStorage`

Manages all secrets in a service with full CRUD operations and automatic state synchronization.

#### API

```typescript
function useSecureStorage(
  options?: SensitiveInfoOptions & { 
    includeValues?: boolean
    skip?: boolean
  }
): {
  items: SensitiveInfoItem[]
  isLoading: boolean
  error: HookError | null
  saveSecret: (key: string, value: string) => Promise<{ success: boolean; error?: HookError }>
  removeSecret: (key: string) => Promise<{ success: boolean; error?: HookError }>
  clearAll: () => Promise<{ success: boolean; error?: HookError }>
  refreshItems: () => Promise<void>
}
```

#### Features

- ✅ Full CRUD operations
- ✅ Optimistic updates for delete
- ✅ Automatic list refresh after save/delete
- ✅ Selective value inclusion
- ✅ Service-wide operations

#### Example

```tsx
function SecureStorageManager() {
  const {
    items,
    isLoading,
    error,
    saveSecret,
    removeSecret,
    clearAll,
    refreshItems
  } = useSecureStorage({
    service: 'credentials',
    includeValues: false // Don't fetch values initially
  })

  const handleAddSecret = async () => {
    const { success, error: err } = await saveSecret('apiKey', 'secret-value')
    if (!success) {
      showError(err?.message)
    }
  }

  const handleRemoveSecret = async (key: string) => {
    const { success } = await removeSecret(key)
    if (success) {
      showNotification(`Deleted ${key}`)
    }
  }

  const handleClearAll = async () => {
    if (confirm('Delete all secrets?')) {
      const { success } = await clearAll()
      if (success) {
        showNotification('All secrets cleared')
      }
    }
  }

  if (isLoading) return <ActivityIndicator />
  if (error) return <Text>Error: {error.message}</Text>

  return (
    <View>
      <FlatList
        data={items}
        renderItem={({ item }) => (
          <SecretListItem
            item={item}
            onDelete={() => handleRemoveSecret(item.key)}
          />
        )}
        keyExtractor={item => item.key}
      />
      <Button title="Add Secret" onPress={handleAddSecret} />
      <Button title="Clear All" onPress={handleClearAll} />
      <Button title="Refresh" onPress={refreshItems} />
    </View>
  )
}
```

---

### `useSecurityAvailability`

Fetches and caches device security capabilities (Secure Enclave, StrongBox, Biometry, etc.).

#### API

```typescript
function useSecurityAvailability(): AsyncState<SecurityAvailability> & {
  refetch: () => Promise<void>
}

interface SecurityAvailability {
  readonly secureEnclave: boolean
  readonly strongBox: boolean
  readonly biometry: boolean
  readonly deviceCredential: boolean
}
```

#### Features

- ✅ Results automatically cached
- ✅ Single native call per app lifecycle
- ✅ Refetch on demand

#### Example

```tsx
function AccessControlSelector() {
  const { data: capabilities, isLoading } = useSecurityAvailability()

  if (isLoading) return <Text>Detecting capabilities...</Text>

  return (
    <View>
      {capabilities?.secureEnclave && (
        <Text>✓ Secure Enclave available</Text>
      )}
      {capabilities?.biometry && (
        <Text>✓ Biometry available</Text>
      )}
      {capabilities?.deviceCredential && (
        <Text>✓ Device credential available</Text>
      )}
    </View>
  )
}
```

---

### `useSecureOperation`

One-time operation hook for non-reactive operations (e.g., bulk operations, logout).

#### API

```typescript
function useSecureOperation(): VoidAsyncState & {
  execute: (operation: () => Promise<void>) => Promise<void>
}

interface VoidAsyncState {
  error: HookError | null
  isLoading: boolean
  isPending: boolean
}
```

#### Features

- ✅ Flexible operation execution
- ✅ Loading state management
- ✅ Error handling

#### Example

```tsx
function LogoutButton() {
  const { execute, isLoading, error } = useSecureOperation()

  const handleLogout = async () => {
    await execute(async () => {
      // Clear all app credentials
      await clearService({ service: 'auth' })
      await clearService({ service: 'cache' })
      // Navigate to login
      navigateTo('Login')
    })
  }

  if (error) return <Text>Logout failed: {error.message}</Text>

  return (
    <Button 
      title="Logout" 
      onPress={handleLogout} 
      disabled={isLoading}
    />
  )
}
```

---

## No Setup Required

All hooks work independently without any provider. Just import and use them directly in your components:

```tsx
import { 
  useSecureStorage, 
  useSecurityAvailability 
} from 'react-native-sensitive-info'

function MyComponent() {
  const { items } = useSecureStorage({ service: 'myapp' })
  const { data: capabilities } = useSecurityAvailability()
  
  // Results are cached automatically - no duplicate native calls
  // even if used in multiple components
}
```

**Automatic caching:**
```tsx
// Component A
const { data: cap1 } = useSecurityAvailability()

// Component B  
const { data: cap2 } = useSecurityAvailability()

// Both get the SAME cached result - only one native call made!
```

---

## Best Practices

### 1. Memory Leak Prevention ✅

All hooks automatically clean up resources on unmount:

```tsx
// ✅ GOOD: Automatic cleanup
function Component() {
  const { data, isLoading } = useSecretItem('token')
  // Cleanup happens automatically on unmount
}
```

### 2. Avoid Unnecessary Re-renders

Use the `skip` parameter to conditionally skip fetches:

```tsx
// ✅ GOOD: Conditional fetching
function Component() {
  const isAuthenticated = useIsAuthenticated()
  const { data } = useSecretItem('token', { skip: !isAuthenticated })
  // Won't fetch until user is authenticated
}
```

### 3. Use `useMemo` for Options

Stabilize options objects to prevent unnecessary API calls:

```tsx
// ✅ GOOD: Memoized options
const options = useMemo(() => ({
  service: 'myapp',
  accessControl: 'secureEnclaveBiometry'
}), []) // Empty deps - only create once

const { data } = useSecretItem('token', options)

// ❌ BAD: New object every render
const { data } = useSecretItem('token', {
  service: 'myapp',
  accessControl: 'secureEnclaveBiometry'
})
```

### 4. Handle Errors Gracefully

Always check error states and provide user feedback:

```tsx
// ✅ GOOD: Proper error handling
function Component() {
  const { data, error, isLoading } = useSecretItem('token')

  if (isLoading) return <ActivityIndicator />
  if (error) return <ErrorBoundary error={error} />
  if (!data) return <Text>No data found</Text>

  return <Text>{data.value}</Text>
}
```

### 5. Batch Operations

Use `useSecureStorage` instead of multiple `useSecretItem` calls:

```tsx
// ✅ GOOD: Single hook for multiple items
function Component() {
  const { items } = useSecureStorage({ service: 'auth' })
  // Access all items
}

// ❌ AVOID: Multiple hook instances
const token = useSecretItem('token')
const refresh = useSecretItem('refreshToken')
const apiKey = useSecretItem('apiKey')
```

### 6. Share Capabilities Without Context

Results are cached automatically - no duplicate native calls:

```tsx
// ✅ GOOD: Multiple independent queries
function ComponentA() {
  const { data: cap1 } = useSecurityAvailability()
  // Native call happens
}

function ComponentB() {
  const { data: cap2 } = useSecurityAvailability()
  // Returns cached result from ComponentA - no new native call!
}
```

### 7. Optional Context for Deep Trees (if needed)

### 7. Accessing Security Capabilities

Check what security features are available on the device:

```tsx
// ✅ GOOD: Direct hook usage
function SecurityStatus() {
  const { data: capabilities, isLoading } = useSecurityAvailability()
  
  if (isLoading) return <ActivityIndicator />
  
  return (
    <View>
      <Text>Biometric: {capabilities?.isBiometricEnabled ? '✓' : '✗'}</Text>
      <Text>Strong Box: {capabilities?.isStrongBoxAvailable ? '✓' : '✗'}</Text>
    </View>
  )
}
```

### 8. Refetch Data Strategically

Use `refetch()` when you need to sync state with native storage:

```tsx
// ✅ GOOD: Manual refetch after external updates
const { data, refetch } = useSecretItem('token')

const handleExternalUpdate = async () => {
  await externallyUpdateToken()
  await refetch() // Sync with native state
}
```

---

## Performance Considerations

### 1. Request Cancellation

All hooks automatically cancel in-flight requests on unmount:

```tsx
// If component unmounts while fetching, request is cancelled
const { data, isLoading } = useSecretItem('token')
```

### 2. Caching

`useSecurityAvailability` caches results to avoid repeated native calls:

```tsx
const cap1 = useSecurityAvailability() // Calls native
const cap2 = useSecurityAvailability() // Uses cache
```

### 3. Selective Value Fetching

Use `includeValues: false` when you only need metadata:

```tsx
// ✅ GOOD: Only fetch metadata
const { items } = useSecureStorage({ includeValues: false })

// ❌ AVOID: Unnecessary decryption
const { items } = useSecureStorage({ includeValues: true })
```

### 4. Optimistic Updates

Delete operations update UI immediately:

```tsx
const { removeSecret } = useSecureStorage()

// UI updates immediately, native call happens in background
await removeSecret('token') // Optimistic delete
```

---

## Error Handling

### Understanding Errors

The `HookError` class wraps errors with context:

```typescript
class HookError extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown
  ) {}
}
```

### Error Handling Patterns

```tsx
function Component() {
  const { error, data } = useSecretItem('token')

  if (error) {
    // Log original error for debugging
    console.error('Hook error:', error.originalError)
    
    // Show user-friendly message
    return <Text>Failed to load token: {error.message}</Text>
  }

  return <Text>{data?.value}</Text>
}
```

---

## Migration Guide

### From Callback-Based API to Hooks

#### Before (Callback API)

```tsx
function Component() {
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true

    const fetchToken = async () => {
      try {
        const item = await getItem('token')
        if (mounted) setToken(item)
      } catch (err) {
        if (mounted) setError(err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchToken()

    return () => {
      mounted = false
    }
  }, [])

  return loading ? <Text>Loading</Text> : <Text>{token?.value}</Text>
}
```

#### After (Hooks API)

```tsx
// ✅ MUCH CLEANER
function Component() {
  const { data: token, isLoading, error } = useSecretItem('token')
  return isLoading ? <Text>Loading</Text> : <Text>{token?.value}</Text>
}
```

---

## Examples

### Complete Authentication Flow

```tsx
import {
  useSecret,
  useSecurityAvailability
} from 'react-native-sensitive-info'

function AuthenticationFlow() {
  const {
    data: token,
    isLoading: tokenLoading,
    saveSecret,
    deleteSecret
  } = useSecret('authToken', {
    service: 'myapp',
    accessControl: 'secureEnclaveBiometry'
  })

  const { data: capabilities } = useSecurityAvailability()

  const handleLogin = async (credentials) => {
    const response = await login(credentials)
    const { success } = await saveSecret(response.token)
    
    if (success) {
      navigateTo('Home')
    }
  }

  const handleLogout = async () => {
    const { success } = await deleteSecret()
    if (success) {
      navigateTo('Login')
    }
  }

  return token ? <HomeScreen onLogout={handleLogout} /> : <LoginForm />
}
```

### Biometric Authentication

```tsx
function BiometricAuth() {
  const { data: capabilities } = useSecurityAvailability()
  const { data: storedToken } = useSecretItem('biometricToken')

  const canUseBiometry = capabilities?.biometry ?? false

  if (!canUseBiometry) {
    return <Text>Biometry not available</Text>
  }

  return (
    <Button
      title="Authenticate with Biometry"
      onPress={async () => {
        const item = await getItem('biometricToken', {
          authenticationPrompt: {
            title: 'Authenticate',
            description: 'Use your biometry to unlock'
          }
        })
        if (item) {
          authorizeUser(item.value)
        }
      }}
    />
  )
}
```

### Multi-Service Management

```tsx
function CredentialsManager() {
  const authCredentials = useSecureStorage({
    service: 'auth',
    includeValues: false
  })

  const apiKeys = useSecureStorage({
    service: 'api',
    includeValues: false
  })

  return (
    <View>
      <Section title="Auth Credentials">
        {authCredentials.items.map(item => (
          <CredentialItem
            key={item.key}
            item={item}
            onDelete={() => authCredentials.removeSecret(item.key)}
          />
        ))}
      </Section>

      <Section title="API Keys">
        {apiKeys.items.map(item => (
          <CredentialItem
            key={item.key}
            item={item}
            onDelete={() => apiKeys.removeSecret(item.key)}
          />
        ))}
      </Section>
    </View>
  )
}
```

---

## Type Safety

All hooks are fully typed with TypeScript:

```tsx
import type {
  AsyncState,
  HookError,
  VoidAsyncState
} from 'react-native-sensitive-info/hooks'

const { data, error, isLoading }: AsyncState<SensitiveInfoItem> = useSecretItem('token')

const hookError: HookError = error
const originalError: unknown = error?.originalError
```

---

## Troubleshooting

### Hooks return loading state but never complete

**Solution:** Check for errors in the console. Ensure proper options are passed.

### Memory warnings during testing

**Solution:** Hooks automatically clean up. Ensure you're waiting for async operations in tests:

```tsx
await waitFor(() => {
  expect(result.current.isLoading).toBe(false)
})
```

---

## Contributing

We welcome contributions! Please ensure:
- All memory cleanup is handled
- Hooks follow React Rules of Hooks
- TypeScript types are comprehensive
- Examples are provided for new hooks

---

## License

MIT © Mateus Andrade
