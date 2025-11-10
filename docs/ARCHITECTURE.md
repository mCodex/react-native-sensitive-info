# Architecture

## Overview

react-native-sensitive-info is built on Nitro Modules, providing a native hybrid bridge for secure storage across all platforms.

## iOS Implementation (Swift)

The iOS codebase is decomposed into focused modules following SOLID principles:

### `KeychainItemManager.swift`
Manages all Keychain CRUD operations (get, set, delete, has). Handles:
- Query construction for Keychain API
- Item encryption/decryption coordination
- Metadata encoding/decoding
- Error handling and logging

### `CryptoService.swift`
Encapsulates AES-256-CBC encryption and decryption using CommonCrypto. Responsible for:
- Encryption key generation (32-byte secure random)
- Key storage in Keychain
- Encryption/decryption with PKCS7 padding
- Salt management for key derivation

### `AccessControlFactory.swift`
Creates `SecAccessControl` policies based on requested security level:
- Secure Enclave biometric authentication
- Device credential fallback
- Graceful hardware feature detection
- Automatic policy negotiation when hardware unavailable

### `HybridSensitiveInfo.swift`
Main Nitro module orchestrator that:
- Delegates to specialized managers
- Resolves device capabilities and security availability
- Validates request options
- Formats response data

## Android Implementation (Kotlin)

Version 6 includes comprehensive Android infrastructure:

### Core Components

#### `Result<T>` Sealed Class
Type-safe result type for operations that can fail:
- `Result.Success<T>` for successful operations
- `Result.Failure` for exceptions
- Functional operators: `map()`, `flatMap()`, `onSuccess()`, `onFailure()`
- Factory methods: `success()`, `failure()`, `try_()`
- Conversion: `toStdResult()`, `getOrNull()`, `getOrElse()`

#### `SensitiveInfoModule` (Hilt)
Dependency injection module providing singletons:
- `SecurityAvailabilityResolver` — Device capability detection
- `AccessControlResolver` — Security policy creation
- `BiometricAuthenticator` — Biometric prompts
- `CryptoManager` — Encryption/decryption
- `SecureStorage` — Persistent storage
- `ServiceNameResolver` — Service name normalization
- `StorageValidator` — Input validation
- `ResponseBuilder` — Type conversion
- `KeyRotationManager` — Key rotation handling

#### `Extensions.kt`
Rich extension functions for:
- **Result type** — Compose multiple results, find successes, collect failures
- **Storage** — Check staleness, hardware backing, safely extract values
- **Responses** — Inspect mutation success, auth requirements, filter operations
- **Keystore** — Generate aliases, validate names, normalize services
- **Validation** — Enforce key/value contracts, validate inputs
- **Error handling** — Create contextual errors, classify types, format messages

### Internal Modules

Located in `com.sensitiveinfo.internal.*`:

- **`auth/`** — `BiometricAuthenticator` for biometric prompts and fallback handling
- **`crypto/`** — `CryptoManager` with Android Keystore integration for encryption/decryption
- **`storage/`** — `SecureStorage` wrapper around `EncryptedSharedPreferences`
- **`validation/`** — Input validation and constraint checking
- **`util/`** — Service name resolution, normalization, and helpers

### `HybridSensitiveInfo.kt`
Main Nitro module that:
- Uses Hilt-injected dependencies
- Routes API calls to appropriate managers
- Handles error classification
- Formats responses for React Native

## TypeScript / React Native

### `src/core/storage.ts`
Nitro bridge that:
- Routes calls to native implementations
- Validates arguments before native calls
- Handles response deserialization
- Manages error translation

### `src/hooks/`
React hooks for reactive storage access:
- `useSecureStorage()` — Manage all secrets in a service
- `useSecretItem()` — Fetch single secret
- `useSecret()` — Single secret with mutations
- `useHasSecret()` — Lightweight existence check
- `useSecurityAvailability()` — Query device capabilities

All hooks include:
- Automatic lifecycle management
- Memory leak prevention
- Error and loading states
- Caching where appropriate

### `src/internal/`
Shared utilities:
- **Error handling** — `SensitiveInfoError` class with 18 error codes
- **Validation** — `StorageValidator` with unified validation rules
- **Branded types** — `StorageKey`, `ServiceName`, `StorageValue` for compile-time safety
- **Async operations** — `useAsyncOperation` and `useAsyncMutation` hooks

### `src/rotation/`
Key rotation engine:
- Versioned key derivation function (KDF)
- Background re-encryption with progress tracking
- Event-driven lifecycle notifications
- Migration support for key versions

## Data Flow

### Write Operation
```
React Component (useSecret/setItem)
  ↓
Validation (StorageValidator)
  ↓
TypeScript Bridge (src/core/storage.ts)
  ↓
Native Nitro Module
  ├─ iOS: HybridSensitiveInfo → CryptoService → KeychainItemManager
  └─ Android: HybridSensitiveInfo → CryptoManager → SecureStorage
  ↓
Secure Hardware (Secure Enclave / Keystore / StrongBox)
  ↓
MutationResult with metadata
```

### Read Operation
```
React Component (useSecretItem/getItem)
  ↓
TypeScript Bridge (src/core/storage.ts)
  ↓
Native Nitro Module
  ├─ iOS: HybridSensitiveInfo → KeychainItemManager → CryptoService
  └─ Android: HybridSensitiveInfo → SecureStorage → CryptoManager
  ↓
Secure Hardware (decrypt if needed)
  ↓
SensitiveInfoItem with decrypted value + metadata
```

## Security Boundaries

- **Hardware security** — Encryption keys never leave Secure Enclave (iOS) or Keystore (Android)
- **No string marshaling** — Secrets handled as bytes until final decryption
- **Biometric gates** — Access control policies enforce authentication before retrieval
- **Memory management** — Native layer handles sensitive data; JS layer discards after use
- **Keychain/Preferences isolation** — Service namespace prevents cross-app access

## Performance Characteristics

Nitro's C++/Swift/Kotlin hybrid path keeps secure storage calls close to native implementations:
- Bridge overhead reduced ~70% vs React Native classic bridge (v5)
- Secure hardware latency dominates for biometric operations
- Batch operations (getAllItems) benefit most from Nitro speed gains
- See [Performance Benchmarks](./PERFORMANCE.md) for detailed measurements

## Testing Strategy

- **Unit tests** — Isolated component testing with mocks
- **Integration tests** — Full operation flows (write → read → delete)
- **Platform tests** — Hardware-specific validation (Secure Enclave, StrongBox)
- **Emulator/simulator tests** — Graceful fallback validation
- **Performance tests** — Regression detection for bridge overhead

## Future Roadmap

- Swift Concurrency (async/await) for iOS
- Android Flow reactive streams
- Cross-platform event bus
- Operation telemetry and profiling
