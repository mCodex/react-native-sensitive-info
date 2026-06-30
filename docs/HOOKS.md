# React Hooks for react-native-sensitive-info

React hooks for `react-native-sensitive-info`. Each hook manages its own async state, error handling, and cleanup automatically.

## Quick Start

```bash
npm install react-native-sensitive-info
# or
yarn add react-native-sensitive-info
```

```tsx
import { useSecretItem, useSecureStorage } from 'react-native-sensitive-info/hooks'

function MyComponent() {
  const { data, isLoading, error } = useSecretItem('apiToken')
  const { items, saveSecret, removeSecret } = useSecureStorage({ service: 'myapp' })

  if (isLoading) return <Text>Loading...</Text>
  if (error) return <Text>Error: {error.message}</Text>

  return <Text>{data?.value}</Text>
}
```

## Core Hooks

### `useSecretItem`

Fetches and manages a single secure storage item.

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
```

Returns `data`, `error`, `isLoading`, `isPending`, and a `refetch` function. Pass `skip: true` to defer loading until a condition is met.

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

### `useSecret`

Read and write a single secret from one hook. Returns the same async state as `useSecretItem` plus `saveSecret`, `deleteSecret`, and `refetch`.

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

```tsx
function AuthTokenManager() {
  const { data: token, isLoading, saveSecret, deleteSecret, refetch } = useSecret('authToken', {
    service: 'myapp'
  })

  const handleLogout = async () => {
    const { success, error } = await deleteSecret()
    if (success) navigateTo('Login')
    else showError(error?.message)
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

### `useHasSecret`

Checks if a secret exists without fetching its value. Useful for conditional rendering.

```typescript
function useHasSecret(
  key: string,
  options?: SensitiveInfoOptions & { skip?: boolean }
): AsyncState<boolean> & {
  refetch: () => Promise<void>
}
```

```tsx
function ConditionalContent() {
  const { data: tokenExists, isLoading } = useHasSecret('apiToken')

  if (isLoading) return <Text>Checking...</Text>

  return tokenExists ? <AuthenticatedContent /> : <LoginForm />
}
```

### `useSecureStorage`

Manages all secrets in a service. Returns an `items` array plus `saveSecret`, `removeSecret`, `clearAll`, and `refreshItems`.

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

Set `includeValues: false` to skip decryption when you only need keys and metadata.

```tsx
function SecureStorageManager() {
  const { items, isLoading, error, saveSecret, removeSecret, clearAll, refreshItems } =
    useSecureStorage({ service: 'credentials', includeValues: false })

  const handleAddSecret = async () => {
    const { success, error: err } = await saveSecret('apiKey', 'secret-value')
    if (!success) showError(err?.message)
  }

  const handleRemoveSecret = async (key: string) => {
    const { success } = await removeSecret(key)
    if (success) showNotification(`Deleted ${key}`)
  }

  if (isLoading) return <ActivityIndicator />
  if (error) return <Text>Error: {error.message}</Text>

  return (
    <View>
      <FlatList
        data={items}
        renderItem={({ item }) => (
          <SecretListItem item={item} onDelete={() => handleRemoveSecret(item.key)} />
        )}
        keyExtractor={item => item.key}
      />
      <Button title="Add Secret" onPress={handleAddSecret} />
      <Button title="Clear All" onPress={clearAll} />
      <Button title="Refresh" onPress={refreshItems} />
    </View>
  )
}
```

### `useSecurityAvailability`

Fetches device security capabilities (Secure Enclave, StrongBox, Biometry).

```typescript
function useSecurityAvailability(
  options?: UseSecurityAvailabilityOptions
): AsyncState<SecurityAvailability> & {
  refetch: () => Promise<void>
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `refreshOnForeground` | `false` | Subscribes to `AppState` and refetches when the user returns from system settings. |

`SecurityAvailability` exposes `secureEnclave`, `strongBox`, `biometry`, `deviceCredential` (booleans) and `biometryStatus` (`'available'`, `'notEnrolled'`, `'notAvailable'`, `'lockedOut'`, `'unknown'`).

```tsx
function AccessControlSelector() {
  const { data: capabilities, isLoading } = useSecurityAvailability({ refreshOnForeground: true })

  if (isLoading) return <Text>Detecting capabilities...</Text>

  if (capabilities?.biometryStatus === 'notEnrolled') {
    return (
      <Pressable onPress={() => Linking.openSettings()}>
        <Text>Set up Face ID / fingerprint</Text>
      </Pressable>
    )
  }

  return (
    <View>
      {capabilities?.secureEnclave && <Text>Secure Enclave available</Text>}
      {capabilities?.biometry && <Text>Biometry available</Text>}
      {capabilities?.deviceCredential && <Text>Device credential available</Text>}
    </View>
  )
}
```

React to enrollment changes with `useBiometryStatusWatcher`, which fires once per real status change:

```tsx
import { useBiometryStatusWatcher } from 'react-native-sensitive-info/hooks'

useBiometryStatusWatcher((next, previous) => {
  if (previous === 'notEnrolled' && next === 'available') {
    showToast('Face ID is ready.')
  }
})
```

Gate writes on a specific access-control policy by pairing with `canUseAccessControlSync`:

```tsx
import { canUseAccessControlSync } from 'react-native-sensitive-info'

const { data: caps } = useSecurityAvailability()
const canEnableSecureEnclave = caps
  ? canUseAccessControlSync('secureEnclaveBiometry', caps)
  : false
```

### `useKeyRotation`

Manages versioned master-key rotation for a service. Tracks the active version and last rotation result.

```typescript
function useKeyRotation(options?: UseKeyRotationOptions): {
  lastResult: RotationResult | null
  error: HookError | null
  isRotating: boolean
  rotate: () => Promise<HookMutationResult>
  readVersion: () => Promise<number | null>
}
```

Defaults to lazy rotation, re-encrypting entries when they are next read. Pass `reEncryptEagerly: true` to re-encrypt all entries up front.

```tsx
function RotationButton() {
  const { rotate, isRotating, lastResult, error } = useKeyRotation({ service: 'auth' })

  return (
    <View>
      <Button
        title={isRotating ? 'Rotating...' : 'Rotate master key'}
        onPress={rotate}
        disabled={isRotating}
      />
      {lastResult && (
        <Text>v{lastResult.previousVersion} to v{lastResult.newVersion}</Text>
      )}
      {error && <Text>{error.message}</Text>}
    </View>
  )
}
```

### `useSecureOperation`

One-time operation hook for non-reactive flows like logout or bulk cleanup.

```typescript
function useSecureOperation(): VoidAsyncState & {
  execute: (operation: () => Promise<void>) => Promise<void>
}
```

```tsx
function LogoutButton() {
  const { execute, isLoading, error } = useSecureOperation()

  const handleLogout = async () => {
    await execute(async () => {
      await clearService({ service: 'auth' })
      await clearService({ service: 'cache' })
      navigateTo('Login')
    })
  }

  if (error) return <Text>Logout failed: {error.message}</Text>

  return <Button title="Logout" onPress={handleLogout} disabled={isLoading} />
}
```

## Best Practices

### Use `skip` for conditional fetching

```tsx
function Component() {
  const isAuthenticated = useIsAuthenticated()
  const { data } = useSecretItem('token', { skip: !isAuthenticated })
}
```

### Prefer `useSecureStorage` over multiple `useSecretItem` calls

A single `useSecureStorage` instance manages the entire service. Mounting separate `useSecretItem` hooks for every key creates separate async pipelines and cache entries.

### Selective value fetching

Pass `includeValues: false` when you only need keys or metadata. Skipping decryption reduces latency and avoids prompting the user for biometrics unnecessarily.

### Gate biometric UI on `biometryStatus`

Check `biometryStatus` instead of just the `biometry` boolean. The status tells you whether biometry is unavailable because the hardware is missing, unenrolled, or locked out. Drive enrollment CTAs off `'notEnrolled'`.

## Performance Considerations

### `useSecurityAvailability` caches per instance

Each mount calls native code once. Re-renders reuse the cached value. Multiple components mounting the hook each issue their own read. Lift the hook into a parent and pass `data` down if you need a single source of truth.

### Previous data preserved on error

When a fetch fails, `data` retains the last successful value instead of resetting to `null`. This prevents UI flicker during transient network or platform failures.

### In-flight requests cancel on unmount

All hooks abort pending operations when the component unmounts. You do not need to implement manual cleanup.

## Error Handling

`HookError` wraps the underlying native error with operation context:

```typescript
class HookError extends Error {
  readonly operation?: string   // e.g. 'useSecretItem.fetch'
  readonly hint?: string        // e.g. 'Ask the user to retry biometrics.'
  readonly cause?: unknown      // the original SensitiveInfoError
}
```

```tsx
function Component() {
  const { error, data } = useSecretItem('token')

  if (error) {
    console.error(`[${error.operation}] ${error.message}`)
    if (error.hint) console.warn(`Hint: ${error.hint}`)
    return <Text>Failed to load token: {error.message}</Text>
  }

  return <Text>{data?.value}</Text>
}
```

## Examples

### Authentication Flow

```tsx
import { useSecret, useSecurityAvailability } from 'react-native-sensitive-info/hooks'

function AuthenticationFlow() {
  const { data: token, saveSecret, deleteSecret } = useSecret('authToken', {
    service: 'myapp',
    accessControl: 'secureEnclaveBiometry'
  })

  const { data: capabilities } = useSecurityAvailability()

  const handleLogin = async (credentials) => {
    const response = await login(credentials)
    const { success } = await saveSecret(response.token)
    if (success) navigateTo('Home')
  }

  const handleLogout = async () => {
    const { success } = await deleteSecret()
    if (success) navigateTo('Login')
  }

  return token ? <HomeScreen onLogout={handleLogout} /> : <LoginForm />
}
```

### Biometric Auth

```tsx
function BiometricAuth() {
  const { data: capabilities } = useSecurityAvailability()
  const { data: storedToken } = useSecretItem('biometricToken')

  const canUseBiometry = capabilities?.biometry ?? false

  if (!canUseBiometry) return <Text>Biometry not available</Text>

  return (
    <Button
      title="Authenticate with Biometry"
      onPress={async () => {
        const item = await getItem('biometricToken', {
          authenticationPrompt: { title: 'Authenticate', description: 'Use your biometry to unlock' }
        })
        if (item) authorizeUser(item.value)
      }}
    />
  )
}
```
