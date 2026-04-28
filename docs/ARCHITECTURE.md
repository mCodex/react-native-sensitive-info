# Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Public API                                                          │
│   ├── react-native-sensitive-info           (storage, errors, types) │
│   ├── react-native-sensitive-info/hooks     (React hooks)            │
│   └── react-native-sensitive-info/errors    (typed errors only)      │
└────────────────────────────────────────────┬─────────────────────────┘
                                             │
┌────────────────────────────────────────────▼─────────────────────────┐
│  TS layer (src/)                                                     │
│   • core/storage.ts   ─ thin wrapper, normalizes options + classifies │
│                         errors                                       │
│   • internal/options  ─ defaults, service resolution                  │
│   • internal/native   ─ lazy Nitro hybrid handle (Expo Go detection)  │
│   • internal/validate ─ TS-side input contracts (key/service/value)   │
│   • internal/errors   ─ marker-based error utilities                  │
│   • errors.ts         ─ typed error classes + predicates              │
│   • hooks/            ─ stable, memoized hook surface                 │
└────────────────────────────────────────────┬─────────────────────────┘
                                             │  Nitro JSI bridge
┌────────────────────────────────────────────▼─────────────────────────┐
│  Native layer                                                        │
│   • iOS    ─ Swift / Keychain / Secure Enclave / CryptoKit           │
│   • Android─ Kotlin / Keystore / StrongBox / AES-GCM                 │
└──────────────────────────────────────────────────────────────────────┘
```

## Naming conventions

### Service & key

- `service` is a logical namespace (reverse-DNS recommended: `com.example.auth`). Defaults to
  the bundle identifier when available, otherwise `'default'`.
- `key` is the entry identifier within a service. Must be a non-empty UTF-8 string ≤ 1024 bytes.
- Combined storage key on Android: `<service>::<key>`. On iOS: Keychain `service` attribute is
  set to `service` and `account` to `key`.

### Keystore aliases (Android)

Each `service` owns a master key under the alias `rnsensitiveinfo.<service>.v<n>` where `n` is
the active key version. `rotateKeys` increments `n` and either lazily re-encrypts on next access
or eagerly walks the existing entries when `reEncryptEagerly: true`.

### Versions

- `keyVersion` is stored in `StorageMetadata`. Legacy entries default to `0` and are
  opportunistically upgraded on read.
- `integrityTag` is a base64 HMAC-SHA256 over metadata + ciphertext, signed with a derived
  subkey of the master.

## Cache locations

| Cache               | Where                                | Lifetime                             |
| ------------------- | ------------------------------------ | ------------------------------------ |
| Nitro instance      | `src/internal/native.ts` module-scope | App process                          |
| Stable options      | Per-hook `useRef` keyed by deepEqual | Component lifetime                   |
| Service resolution  | `src/internal/options.ts`            | Recomputed on every call (cheap)     |
| Key version (native)| Keystore / Keychain                  | Persistent until `clearService`      |

## Tree-shaking

The package sets `"sideEffects": false` and ships ESM via subpath exports. Hooks live behind
`react-native-sensitive-info/hooks` so apps that only use the imperative API never pay for the
hook bundle. Errors are also re-exported from `/errors` for the same reason.
