# Migration: 5.6 → 6.x

`react-native-sensitive-info` 6 is a from-scratch rewrite on top of [Nitro Modules][nitro] and
the React Native New Architecture. The public API is intentionally narrower and more typed than
5.6.

[nitro]: https://nitro.margelo.com/

## Breaking changes at a glance

| 5.6                                          | 6.x                                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Bridge module, Old Architecture only         | Nitro hybrid object, **New Architecture required**                                                   |
| `setItem(key, value, options)` returns void  | `setItem(key, value, options)` returns `Promise<StorageMetadata>`                                    |
| `getItem(key, options)` returns the raw value or `null`         | `getItem(key, options)` returns `SensitiveInfoItem \| null` (`{ key, service, value, metadata }`) |
| `getAllItems(options)` returns `Record<string, string>` | `getAllItems(options)` returns `SensitiveInfoItem[]`                                                                              |
| `deleteItem(key, options)` returns void                                  | `deleteItem(key, options)` returns `Promise<boolean>` (`true` when removed)                                                                                |
| Errors are plain `Error` instances           | Typed `SensitiveInfoError` subclasses + `is*Error` predicates                                        |
| `kSecAccessControl*` strings on iOS          | `accessControl: 'secureEnclaveBiometry' \| 'biometryCurrentSet' \| 'biometryAny' \| 'devicePasscode' \| 'none'`                                  |
| Android `keystore` config object             | `accessControl` only — backend is selected automatically (StrongBox → Keystore → EncryptedSharedPreferences) |
| No metadata                                  | `StorageMetadata` returned with every read/write (`securityLevel`, `backend`, `keyVersion`, `integrityTag`)  |
| No key rotation                              | `rotateKeys()` + `getKeyVersion()`                                                                  |
| No React hooks                               | First-party hooks via `react-native-sensitive-info/hooks`                                            |

## Step-by-step

### 1. Update peer requirements

- React Native ≥ 0.80 with **New Architecture enabled**.
- Expo users: SDK 52+ and a custom Dev Client / EAS Build (Expo Go is not supported).

### 2. Replace value-only reads

```diff
- const token = await getItem('token', { sharedPreferencesName: 'auth' })
+ const item = await getItem('token', { service: 'auth' })
+ const token = item?.value ?? null
```

> `sharedPreferencesName` (Android) and `keychainService` (iOS) are unified as `service`.

### 3. Use typed errors

```diff
- try { await getItem('k', opts) }
- catch (e) { if (e.message.includes('cancel')) return }
+ import { isAuthenticationCanceledError } from 'react-native-sensitive-info'
+ try { await getItem('k', opts) }
+ catch (e) { if (isAuthenticationCanceledError(e)) return }
```

Available predicates: `isNotFoundError`, `isAuthenticationCanceledError`,
`isIntegrityViolationError`, `isKeyInvalidatedError`, `isRotationFailedError`,
`isInvalidArgumentError`.

### 4. Migrate access-control flags

| 5.6 (`kSecAccessControl…`)                                   | 6.x (`accessControl`)        |
| ------------------------------------------------------------ | ---------------------------- |
| `kSecAccessControlBiometryCurrentSet` + Secure Enclave class | `secureEnclaveBiometry`      |
| `kSecAccessControlBiometryCurrentSet`                        | `biometryCurrentSet`         |
| `kSecAccessControlBiometryAny`                               | `biometryAny`                |
| `kSecAccessControlDevicePasscode`                            | `devicePasscode`             |
| (no policy)                                                  | `none`                       |

### 5. Replace `setInvalidatedByBiometricEnrollment` etc.

These were Apple-specific opt-outs. In 6.x, biometric-bound entries that the OS invalidates
(re-enrollment, biometric reset) raise `KeyInvalidatedError` deterministically. Catch it and
re-prompt the user to set up the secret again.

### 6. Adopt hooks (optional)

```ts
import { useSecret } from 'react-native-sensitive-info/hooks'

const { data, error, saveSecret, deleteSecret } = useSecret('token', {
	service: 'auth',
	includeValue: true,
})
```

## Data migration

5.6 → 6.x is **not** wire-compatible. Existing entries written by 5.6 are not readable by 6.x
because the metadata envelope is different. To migrate live data, ship a one-time migration that
reads with a vendored 5.6 helper and re-writes via 6.x `setItem`. For most apps the safer answer
is "let users re-authenticate once" — secrets are short-lived by design.
