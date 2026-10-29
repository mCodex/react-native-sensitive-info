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
│   • iOS    ─ Swift / Keychain / access control / CryptoKit HMAC      │
│   • Android─ Kotlin / Keystore / AES-GCM / HMAC                      │
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

Each Android entry uses a Keystore alias derived from its service, key, and key version. New
aliases use length-prefixed service/key inputs before hashing to avoid delimiter collisions.
Existing entries keep their persisted alias so upgrades can still decrypt them. `rotateKeys`
increments the service version and either re-encrypts lazily on access or eagerly walks entries
when `reEncryptEagerly: true`.

### Versions

- `keyVersion` is stored in `StorageMetadata`. Legacy entries default to `0` and are
  opportunistically upgraded on read.
- `integrityTag` is an HMAC-SHA256 over metadata and the stored payload, using a separate
  integrity key. Legacy entries may have no tag; the tag does not prevent replay of a previously
  valid record. See [THREAT_MODEL.md](THREAT_MODEL.md) for the remaining encoding limitation.

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

## iOS prompt boundaries

On iOS, Keychain queries against biometric-protected entries can authenticate even when callers
only ask for attributes. The native layer keeps `hasItem` and metadata-only enumeration on a
dedicated silent path, while value reads own an `LAContext` from the first `SecItemCopyMatching`
attempt so one user action maps to one Face ID / Touch ID sheet.
