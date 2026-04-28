## Unreleased

### Added

* **biometric availability:** New `biometryStatus` field on `SecurityAvailability` (`'available' | 'notEnrolled' | 'notAvailable' | 'lockedOut' | 'unknown'`) disambiguates *hardware missing*, *hardware present but no enrollment*, and *currently usable*. The legacy `biometry` boolean stays as a backward-compatible alias for `biometryStatus === 'available'`. Mapped natively from `LAError` codes on iOS and `BiometricManager.canAuthenticate` results on Android.
* **policy precheck:** New `canUseAccessControl(policy, levels?)` and `canUseAccessControlSync(policy, levels)` predict whether a given `AccessControl` policy will succeed on the current device. Pure TS mapping over `SecurityAvailability` — no extra IPC round-trip.
* **foreground auto-refresh:** `useSecurityAvailability({ refreshOnForeground: true })` subscribes to `AppState` and refetches on `active` transitions (debounced ~500 ms, unsubscribes on unmount). Covers the *user leaves to enroll a fingerprint and returns* flow without manual `refetch()`.
* **enrollment listener:** New `useBiometryStatusWatcher(onChange)` hook fires only on actual `BiometryStatus` transitions (not on every render or refetch). Lives in its own module for tree-shaking.

All additions are non-breaking; apps reading only the `biometry` boolean continue to work unchanged.

### Fixed

* **ios:** `getItem` no longer triggers a second Face ID / Touch ID prompt for biometry-protected entries. The lazy re-encryption path that runs after a successful authenticated read used to call `SecItemUpdate` against the same Keychain item to refresh its key-version metadata; iOS treats that as a separate authorization gate, prompting the user a second time. Biometric items now skip the lazy refresh entirely and are upgraded only by an explicit `setItem` (full overwrite, single user-initiated write) or by `rotateKeys({ reEncryptEagerly: true })`. Non-biometric items continue to be upgraded silently.
* **android:** Same double-prompt regression on `getItem` for entries whose Keystore key was created with `setUserAuthenticationRequired(true)`. Lazy re-encryption inside `getItem` allocated a new key alias for the active version and `Cipher.init` on that fresh key required its own biometric authorization, surfacing as a second prompt right after the read. The lazy refresh now skips entries with `requiresAuthentication == true` (or any biometry-class access policy); explicit `setItem` and `rotateKeys({ reEncryptEagerly: true })` still upgrade them.
* **ios:** `setItem` no longer returns `errSecDuplicateItem` ("The specified item already exists in the keychain") when the caller toggles `iosSynchronizable` between writes or when iCloud Keychain restores an entry between our delete and add. The internal upsert helper now wipes prior entries with `kSecAttrSynchronizableAny` and absorbs the iCloud-restore race with a single bounded retry. Bundle ID + access group already scope the partition, so the overwrite never crosses an app or sharing boundary.

## [6.0.0](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.12...v6.0.0) (2026-04-28)

First stable release of the Nitro-based v6 line. Promotes `6.0.0-rc.12` to GA with no API changes — the release notes below summarize everything new since the v5 line.

### Features

* **rotation:** Add versioned key rotation via `rotateKeys()` and `getKeyVersion()` with lazy re-encryption on read. New `useKeyRotation` hook exposes the same flow declaratively.
* **security hardening:** Defense-in-depth pass — non-breaking, applied transparently to new writes and via lazy upgrade on rotation:
  - HMAC-SHA256 integrity tag bound to every entry's metadata + ciphertext, surfaced on `StorageMetadata.integrityTag`. Tampering with SharedPreferences/Keychain attributes now raises `IntegrityViolationError` (`E_INTEGRITY_VIOLATION`) before any biometric prompt is shown.
  - AES-GCM AAD on Android binds ciphertext to `service|key|v<version>`, defeating cross-entry swap attacks.
  - `setUnlockedDeviceRequired(true)` on every Android Keystore key (API 28+), mirroring iOS's `kSecAttrAccessibleWhenUnlocked` semantics.
  - Plaintext byte buffers are zeroized after use on both platforms.
  - Constant-time HMAC comparison via `MessageDigest.isEqual` / manual `UInt8` XOR fold.
  - Backwards compatible: entries written by earlier versions decode without verification and are upgraded on the next write or rotation.
* **errors:** New typed error classes (`SensitiveInfoError`, `NotFoundError`, `AuthenticationCanceledError`, `IntegrityViolationError`, `KeyInvalidatedError`, `RotationFailedError`) with `code` discriminants and `instanceof` predicates. Importable from the `react-native-sensitive-info/errors` subpath.
* **tree-shaking:** `"sideEffects": false` everywhere; the package now publishes three focused subpath entries (`.`, `/hooks`, `/errors`). The default export has been removed — import only the helpers you use.
* **nitro 0.35:** Regenerated against `nitrogen@0.35.5` and `react-native-nitro-modules@0.35.5`.
* **tooling:** Migrated linting/formatting from ESLint + Prettier to **Biome 2**. Single config at `biome.json`, faster CI runs.

### Refactor (KISS · DRY · SRP)

* Introduced `useAsyncQuery` (read-only hooks) and `useMutation` (mutation hooks) primitives. `useHasSecret`, `useSecretItem`, `useSecureOperation`, `useKeyRotation`, and `useSecureStorage` now compose the same lifecycle/abort/error-handling pipeline — no duplicated state machines.
* `useSecureStorage` shrunk from ~230 LOC to ~180 LOC and reuses the shared abort + auth-cancel semantics; behaviour is unchanged.
* Test fixtures consolidated in `src/__tests__/__mocks__/fixtures.ts` (`buildTestItem`, `buildTestMetadata`).
* Removed redundant re-exports from `src/internal/errors.ts`.

### Breaking changes

* The default export is gone. Use named imports: `import { setItem } from 'react-native-sensitive-info'`.
* React hooks are no longer re-exported from the package root — import them from `react-native-sensitive-info/hooks`.

### Notes

* **iOS rotation** updates the Keychain metadata via `SecItemUpdate`, preserving the original access-control attributes while bumping `keyVersion`.
* **Android rotation** mints a fresh per-entry Keystore alias (`SensitiveInfo_<hash>_v<version>`) during lazy or eager re-encryption and deletes the stale alias after a successful rewrite.
* Version state lives in a non-secret registry (`SharedPreferences` on Android, `UserDefaults` on iOS). Delete the app's data to reset.

## [6.0.0-rc.12](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.11...v6.0.0-rc.12) (2025-12-16)

### Features

* restructure app components and implement secure storage functionality ([b84ec82](https://github.com/mcodex/react-native-sensitive-info/commit/b84ec82e175eb0b7f951c08c5156a7931457c092))

### Bug Fixes

* add tokenRef for npm access verification in release-it configuration ([9e39622](https://github.com/mcodex/react-native-sensitive-info/commit/9e39622beac9c69d7a66dccd402c814764ab8dcc))
* update repository field format in package.json ([eeadcb8](https://github.com/mcodex/react-native-sensitive-info/commit/eeadcb890a4d30cefdb3f6ee2fba8ef2d4da6912))
## [6.0.0-rc.11](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.10...v6.0.0-rc.11) (2025-11-05)

### Bug Fixes

* **ios:** prompt simulator biometric auth before keychain fetch and probe security on main thread ([240bc60](https://github.com/mcodex/react-native-sensitive-info/commit/240bc609521d3d3d19e7e25b319bab2e8fb236d4))
## [6.0.0-rc.10](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.9...v6.0.0-rc.10) (2025-11-05)

### Bug Fixes

* **ios:** run SecItemCopyMatching on main thread and refine auth cancel handling ([c6cbfe3](https://github.com/mcodex/react-native-sensitive-info/commit/c6cbfe37c266cdaf32ddc65875142ba27c2df439))
## [6.0.0-rc.9](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.8...v6.0.0-rc.9) (2025-11-03)

### Bug Fixes

* **auth:** treat authentication cancellations as soft-failures and map native cancel codes ([4454883](https://github.com/mcodex/react-native-sensitive-info/commit/44548839c4755d1067c3246c1dab5e049ad44963))
## [6.0.0-rc.8](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.7...v6.0.0-rc.8) (2025-10-27)
## [6.0.0-rc.7](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.6...v6.0.0-rc.7) (2025-10-27)
## [6.0.0-rc.6](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.5...v6.0.0-rc.6) (2025-10-27)
## [6.0.0-rc.5](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.4...v6.0.0-rc.5) (2025-10-27)
## [6.0.0-rc.4](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.3...v6.0.0-rc.4) (2025-10-25)
## [6.0.0-rc.3](https://github.com/mcodex/react-native-sensitive-info/compare/v6.0.0-rc.1...v6.0.0-rc.3) (2025-10-24)

### Features

* Add biometric authentication support for Android and iOS ([0310140](https://github.com/mcodex/react-native-sensitive-info/commit/0310140ce970195918973dfd256a4b10a035f89d))
* Add biometric security demo component and integrate biometric storage options ([1f7e3ac](https://github.com/mcodex/react-native-sensitive-info/commit/1f7e3acd6a794f42d363b2606b02a2756138208f))
* Add SecurityCapabilitiesDemo component and integrate security capabilities checks ([7f942a0](https://github.com/mcodex/react-native-sensitive-info/commit/7f942a041782d1ba6b40e15e2f74f8ab2afa6c55))
* Adding a hasItem method ([#259](https://github.com/mcodex/react-native-sensitive-info/issues/259)) ([1dc4825](https://github.com/mcodex/react-native-sensitive-info/commit/1dc48251fb4afc777351d6feb87d1c6cf2fe2d3b))
* Enhance security options with biometric and strongbox support in storage functions ([f554332](https://github.com/mcodex/react-native-sensitive-info/commit/f5543325c043ebb5bd5bc04a701b5c17c3a6fc8d))
* Implement secure storage using EncryptedSharedPreferences for Android ([5671fcd](https://github.com/mcodex/react-native-sensitive-info/commit/5671fcd1748915bdb3bd4d73f12437e0fdff873e))

### Bug Fixes

* **android:** Error is null on invalidateEnrollment set to false ([#258](https://github.com/mcodex/react-native-sensitive-info/issues/258)) ([4f9af66](https://github.com/mcodex/react-native-sensitive-info/commit/4f9af66a5df6ee8cc9f72bb25596fbdcbc16288c))
## [6.0.0-alpha9](https://github.com/mcodex/react-native-sensitive-info/compare/5.5.0...v6.0.0-alpha9) (2020-12-17)

### Features

* **android:** biometric api implementation ([9b608cf](https://github.com/mcodex/react-native-sensitive-info/commit/9b608cf7b98a39f27e632efef2ac2b68f7eb4104))

### Bug Fixes

* **android:** Android 11 auth required check ([#238](https://github.com/mcodex/react-native-sensitive-info/issues/238)) ([89dab84](https://github.com/mcodex/react-native-sensitive-info/commit/89dab8495821fb8d0a6169639fb068d81283c4a4))
* **android:** handle UnrecoverableKeyException ([79c8197](https://github.com/mcodex/react-native-sensitive-info/commit/79c81973f28f70d72216f8155b47b2c897358c38))
* **android:** key user not authenticated ([#224](https://github.com/mcodex/react-native-sensitive-info/issues/224)) ([bb9ef04](https://github.com/mcodex/react-native-sensitive-info/commit/bb9ef047d2bb16bdfe784d56e7f205d2059b15f7))
* **android:** normalize error codes ([#225](https://github.com/mcodex/react-native-sensitive-info/issues/225)) ([6937221](https://github.com/mcodex/react-native-sensitive-info/commit/6937221b5768ed082832245b3f43dfb365679658))
* **android:** remove unused code ([595e955](https://github.com/mcodex/react-native-sensitive-info/commit/595e955e2415df88ac8dec9d0bce6d2117b346a4))
* **android:** same callback logic between showModal options ([#220](https://github.com/mcodex/react-native-sensitive-info/issues/220)) ([7eef64a](https://github.com/mcodex/react-native-sensitive-info/commit/7eef64a75a0c43e18545eab5fad108d905cc7a3f))
* updated react dependency in podspec to enable build in Xcode 12 (for iOS >= 12) ([#246](https://github.com/mcodex/react-native-sensitive-info/issues/246)) ([a1b7e88](https://github.com/mcodex/react-native-sensitive-info/commit/a1b7e88240bb6bfa43baf3f006d029e4f9fd700b))
## [5.5.0](https://github.com/mcodex/react-native-sensitive-info/compare/5.4.0...5.5.0) (2019-07-31)

### Reverts

* Revert "Add config on android to controlled setInvalidatedByBiometricEnrollment property" ([8a01182](https://github.com/mcodex/react-native-sensitive-info/commit/8a0118270352400b9d54d94e9ba6d21976d2a2d5))
## [5.2.5](https://github.com/mcodex/react-native-sensitive-info/compare/5.2.4...5.2.5) (2018-08-07)
## [5.2.4](https://github.com/mcodex/react-native-sensitive-info/compare/5.2.3...5.2.4) (2018-07-27)
## [5.2.2](https://github.com/mcodex/react-native-sensitive-info/compare/5.2.1...5.2.2) (2018-07-26)

### Features

* adding TypeScript typings ([5a10dce](https://github.com/mcodex/react-native-sensitive-info/commit/5a10dce8a8277b495a0959a537ab4c8b2711e3bf))
## [5.2.1](https://github.com/mcodex/react-native-sensitive-info/compare/5.2.0...5.2.1) (2018-06-14)

### Features

* add more methods ([792de81](https://github.com/mcodex/react-native-sensitive-info/commit/792de819f2dda225bd99a8ab1ecce68d307426ab))
* handle exception by re-initialize key ([2144bfc](https://github.com/mcodex/react-native-sensitive-info/commit/2144bfc976025f3672b95e78ad56cac49b3f428f))
## [5.2.0](https://github.com/mcodex/react-native-sensitive-info/compare/5.1.0...5.2.0) (2017-10-10)
## [5.1.0](https://github.com/mcodex/react-native-sensitive-info/compare/5.0.1...5.1.0) (2017-05-25)
## [5.0.1](https://github.com/mcodex/react-native-sensitive-info/compare/3.0.1...5.0.1) (2017-05-16)
## [3.0.1](https://github.com/mcodex/react-native-sensitive-info/compare/3.0.0...3.0.1) (2016-06-20)
## [3.0.0](https://github.com/mcodex/react-native-sensitive-info/compare/2.2.0...3.0.0) (2016-06-14)
## [2.2.0](https://github.com/mcodex/react-native-sensitive-info/compare/2.1.0...2.2.0) (2016-06-11)
## [2.1.0](https://github.com/mcodex/react-native-sensitive-info/compare/f4de6a4559db2ffe9a0f49c08def24a04ac0b5e9...2.1.0) (2016-06-07)

### Reverts

* Revert "adding more items into .gitignore" ([f4de6a4](https://github.com/mcodex/react-native-sensitive-info/commit/f4de6a4559db2ffe9a0f49c08def24a04ac0b5e9))
