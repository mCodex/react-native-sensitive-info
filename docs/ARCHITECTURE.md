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

## Contributor TypeScript tooling

The library and example use TypeScript 7.0.2 with Yarn 4.18.1. Run
`yarn typecheck`, `yarn typecheck:tests`, and
`yarn workspace react-native-sensitive-info-example typecheck` to check each
scope. Jest uses Babel to transform TypeScript and JSX; test types are checked
separately because Babel only removes type annotations. CI runs all three checks.

Bob and Nitrogen retain their own compiler dependencies. Avoid forcing those
transitive versions: their compiler APIs differ from TypeScript 7. Bob invokes
the workspace compiler for public declarations, while Nitro generation uses its
own compiler tooling.

## iOS example startup

The example starts React Native from `example/ios/SceneDelegate.swift`. Its
`UIApplicationSceneManifest` registers that class in the application target's
Info.plist. Both are required: compiling a SceneDelegate without registering it
does not adopt the scene lifecycle, and iOS 27 rejects the app at launch.
The example was built with Xcode 27.1 and launched on an iOS 27.0 simulator;
the playground rendered and the native capability cards returned results.

Libraries do not own their host application's scene lifecycle; bare consumers
should follow the React Native template for their version, and Expo consumers
should use the lifecycle supplied by their Expo SDK.

Nitro [issue #1652](https://github.com/margelo/nitro/issues/1652) describes a
separate Xcode 27 build problem on iOS below 18, involving a missing libc++
exception symbol. Upstream [PR #1824](https://github.com/margelo/nitro/pull/1824)
fixes Nitro's Swift-visible exception helpers. A scene manifest does not fix
that dependency problem, and changing this library's sources cannot replace
Nitro's compiled runtime.
