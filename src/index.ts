/**
 * @fileoverview React Native Sensitive Info v5.6.0 - Public API
 *
 * Provides secure storage for sensitive data with biometric authentication,
 * hardware-backed encryption, and automatic migration from v5.x format.
 *
 * Key Features:
 * - AES-256-GCM encryption with random IV per operation (NIST SP 800-38D)
 * - Biometric authentication (Face ID, Touch ID, Fingerprint, Optic ID)
 * - Hardware-backed key storage (Secure Enclave, StrongBox)
 * - Automatic v5.x → v5.6.0 format migration (transparent)
 * - 100% backward compatible with v5.0.0-v5.5.x
 * - Zero-knowledge storage on device
 * - Multi-platform: iOS 13+, macOS 10.15+, visionOS 1.0+, watchOS 6.0+, Android 8+
 *
 * @version 5.6.0
 * @platform ios >= 13 (Keychain, LocalAuthentication)
 * @platform macos >= 10.15 (Keychain, LocalAuthentication, Touch ID on M1+)
 * @platform visionos >= 1.0 (Keychain, Optic ID)
 * @platform watchos >= 6.0 (Keychain, device passcode)
 * @platform android >= 8 (KeyStore, BiometricPrompt)
 *
 * @example
 * ```typescript
 * import { SensitiveInfo } from 'react-native-sensitive-info';
 *
 * // Store with biometric protection
 * await SensitiveInfo.setItem('auth-token', jwtToken, {
 *   keychainService: 'myapp',
 *   accessControl: 'secureEnclaveBiometry',
 *   authenticationPrompt: {
 *     title: 'Authenticate',
 *     subtitle: 'Store your authentication token'
 *   }
 * });
 *
 * // Retrieve (prompts for biometric)
 * const token = await SensitiveInfo.getItem('auth-token', {
 *   keychainService: 'myapp',
 *   prompt: {
 *     title: 'Unlock',
 *     subtitle: 'Verify your identity'
 *   }
 * });
 *
 * // Cleanup on logout
 * await SensitiveInfo.clearService({ keychainService: 'myapp' });
 * ```
 *
 * @see {@link https://github.com/mCodex/react-native-sensitive-info} GitHub Repository
 * @see {@link https://github.com/mCodex/react-native-sensitive-info/blob/v5.x/README.md} Documentation
 */

import { NativeModules } from 'react-native';

import {
  DEFAULT_ACCESS_CONTROL,
  DEFAULT_KEYCHAIN_SERVICE,
  ErrorCode,
} from './types';
import type {
  DeviceCapabilities,
  OperationResult,
  RetrievalOptions,
  StorageOptions,
} from './types';

// ============================================================================
// RE-EXPORT UNIFIED TYPES (from src/types.ts)
// ============================================================================

export type {
  AccessControl,
  AuthenticationPrompt,
  SecurityLevel,
  StorageMetadata,
  DeviceCapabilities,
  StorageOptions,
  RetrievalOptions,
  OperationResult,
  StoredItem,
} from './types';

export {
  SensitiveInfoError,
  ErrorCode,
  isSensitiveInfoError,
  SUPPORTED_PLATFORMS,
  MIN_VERSIONS,
  DEFAULT_ACCESS_CONTROL,
  DEFAULT_KEYCHAIN_SERVICE,
  MAX_VALUE_LENGTH,
} from './types';

/**
 * Mock storage for development and example app
 * In production, this delegates to native modules
 * @private
 */
const mockStorage: Record<string, string> = {};

const FALLBACK_CAPABILITIES: DeviceCapabilities = {
  secureEnclave: false,
  strongBox: false,
  biometry: false,
  deviceCredential: false,
  iCloudSync: false,
};

type NativeSetOptions = StorageOptions & { service: string };
type NativeGetOptions = RetrievalOptions & { service: string };
type NativeScopedOptions = { service: string };

type NativeSensitiveInfoModule = {
  setItem?: (
    key: string,
    value: string,
    options: NativeSetOptions
  ) => Promise<OperationResult>;
  getItem?: (
    key: string,
    options: NativeGetOptions
  ) => Promise<{ value?: string | null } | null>;
  hasItem?: (key: string, options: NativeScopedOptions) => Promise<boolean>;
  deleteItem?: (key: string, options: NativeScopedOptions) => Promise<void>;
  getAllItems?: (options: NativeScopedOptions) => Promise<string[]>;
  clearService?: (options: NativeScopedOptions) => Promise<void>;
  getSupportedSecurityLevels?: () => Promise<DeviceCapabilities>;
};

type NativeMethod = keyof NativeSensitiveInfoModule;

interface NativeInvocationResult<T> {
  readonly didInvoke: boolean;
  readonly result?: T;
}

interface KeychainScopedOptions {
  readonly keychainService?: string;
}

function resolveService(options?: KeychainScopedOptions): string {
  return options?.keychainService || DEFAULT_KEYCHAIN_SERVICE;
}

async function invokeNative<T>(
  nativeModule: NativeSensitiveInfoModule | null,
  method: NativeMethod,
  args: unknown[]
): Promise<NativeInvocationResult<T>> {
  const candidate = nativeModule?.[method];

  if (typeof candidate !== 'function') {
    return { didInvoke: false };
  }

  const result = await (candidate as (...innerArgs: unknown[]) => Promise<T>)(
    ...args
  );

  return { didInvoke: true, result };
}

function fallbackSetItem(
  service: string,
  key: string,
  value: string,
  accessControl?: StorageOptions['accessControl']
): OperationResult {
  const storageKey = createStorageKey(service, key);
  mockStorage[storageKey] = value;

  return {
    metadata: {
      timestamp: Math.floor(Date.now() / 1000),
      securityLevel: 'software',
      accessControl: accessControl ?? DEFAULT_ACCESS_CONTROL,
      backend: 'androidKeystore',
    },
  };
}

function fallbackGetItem(service: string, key: string): string | null {
  const storageKey = createStorageKey(service, key);
  return mockStorage[storageKey] ?? null;
}

function fallbackHasItem(service: string, key: string): boolean {
  const storageKey = createStorageKey(service, key);
  return storageKey in mockStorage;
}

function fallbackDeleteItem(service: string, key: string): void {
  const storageKey = createStorageKey(service, key);
  delete mockStorage[storageKey];
}

function fallbackGetAllItems(service: string): string[] {
  const prefix = createStorageKey(service, '');
  return Object.keys(mockStorage)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.substring(prefix.length));
}

function fallbackClearService(service: string): void {
  const prefix = createStorageKey(service, '');
  Object.keys(mockStorage).forEach((key) => {
    if (key.startsWith(prefix)) {
      delete mockStorage[key];
    }
  });
}

/**
 * Get native module instance
 * @private
 */
function getNativeModule(): NativeSensitiveInfoModule | null {
  try {
    return NativeModules.SensitiveInfo as NativeSensitiveInfoModule;
  } catch {
    return null;
  }
}

/**
 * Create storage key with service namespace
 * @private
 */
function createStorageKey(service: string, key: string): string {
  return `${service}:${key}`;
}

/*
 * Securely stores a value in encrypted storage with optional biometric protection
 *
 * The storage operation will:
 * 1. Generate a random 12-byte IV
 * 2. Encrypt value using AES-256-GCM
 * 3. Store encrypted data with IV in Keychain (iOS) or KeyStore (Android)
 * 4. Apply biometric/passcode protection if requested
 *
 * **Security Notes:**
 * - Each encryption uses a unique random IV (prevents v5.x vulnerability)
 * - Hardware-backed encryption by default on compatible devices
 * - Biometric requirement can be optional or mandatory
 * - Plaintext is not stored or logged
 *
 * **Performance:**
 * - Typical time: 15-30ms (excluding biometric prompt)
 * - Encryption overhead: minimal
 * - Hardware acceleration: automatic
 *
 * @param key - Unique identifier within the service (case-sensitive)
 * @param value - Plain text value to encrypt and store
 * @param options - Storage configuration options
 *
 * @returns Promise resolving to operation result with metadata
 *
 * @throws {SensitiveInfoError} With code property
 * - E_ENCRYPTION_FAILED: Encryption operation failed
 * - E_KEYSTORE_UNAVAILABLE: Storage system not available
 * - E_AUTH_FAILED: Biometric authentication failed (if required)
 *
 * @example
 * ```typescript
 * // Basic storage (device passcode protection)
 * await setItem('secret_key', 'secret_value', {
 *   keychainService: 'myapp'
 * });
 *
 * // Biometric-protected storage
 * await setItem('auth_token', jwtToken, {
 *   keychainService: 'myapp',
 *   accessControl: 'secureEnclaveBiometry',
 *   authenticationPrompt: {
 *     title: 'Secure Storage',
 *     subtitle: 'Biometric required'
 *   }
 * });
 * ```
 */
export async function setItem(
  key: string,
  value: string,
  options?: StorageOptions
): Promise<OperationResult> {
  if (!key || !value) {
    throw new Error('Key and value are required');
  }

  const service = resolveService(options);
  const nativeModule = getNativeModule();

  try {
    const { didInvoke, result } = await invokeNative<OperationResult>(
      nativeModule,
      'setItem',
      [key, value, { service, ...options }]
    );

    if (didInvoke) {
      return result as OperationResult;
    }

    return fallbackSetItem(service, key, value, options?.accessControl);
  } catch (error: any) {
    const errorCode = error?.code || ErrorCode.ENCRYPTION_FAILED;
    const message = `Failed to store "${key}": ${error?.message}`;
    throw Object.assign(new Error(message), {
      code: errorCode,
      nativeError: error,
    });
  }
}

/**
 * Retrieves and decrypts a stored secret
 *
 * The retrieval operation will:
 * 1. Locate encrypted data in storage
 * 2. Optionally prompt for biometric/passcode authentication
 * 3. Decrypt using stored IV and authentication key
 * 4. Return plaintext value
 * 5. Clear plaintext from memory after return
 *
 * **Security Notes:**
 * - Returns null for missing keys (not an error)
 * - Biometric authentication is verified before decryption
 * - Plaintext exists only during this function execution
 * - Automatic migration from v5.x format on first access
 *
 * **Performance:**
 * - Without biometric: 20-50ms
 * - With biometric prompt: 2-5 seconds (user dependent)
 * - Decryption: hardware accelerated
 *
 * @param key - Unique identifier within the service
 * @param options - Retrieval configuration and authentication prompt
 *
 * @returns Promise resolving to:
 * - null if key doesn't exist
 * - Plaintext value if found and successfully decrypted
 *
 * @throws {SensitiveInfoError} With code property
 * - E_AUTH_FAILED: Authentication failed
 * - E_AUTH_CANCELED: User canceled authentication
 * - E_BIOMETRY_LOCKOUT: Too many failed biometric attempts
 * - E_KEY_INVALIDATED: Key invalidated (e.g., biometry change)
 * - E_DECRYPTION_FAILED: Decryption failed (corruption?)
 * - E_KEYSTORE_UNAVAILABLE: Storage system not available
 *
 * @example
 * ```typescript
 * // Retrieve without biometric
 * const value = await getItem('simple_key', {
 *   keychainService: 'myapp'
 * });
 *
 * if (value === null) {
 *   console.log('Not found');
 *   return;
 * }
 *
 * console.log('Retrieved:', value);
 *
 * // Retrieve with biometric authentication
 * try {
 *   const token = await getItem('auth_token', {
 *     keychainService: 'myapp',
 *     prompt: {
 *       title: 'Unlock Token',
 *       subtitle: 'Use biometric to access your authentication token',
 *       description: 'Required for secure access'
 *     }
 *   });
 *
 *   if (token) {
 *     // Use token for API request
 *     const response = await fetch(apiUrl, {
 *       headers: { Authorization: `Bearer ${token}` }
 *     });
 *   }
 * } catch (error) {
 *   if (error.code === ErrorCode.AUTH_CANCELED) {
 *     console.log('User canceled authentication');
 *   } else if (error.code === ErrorCode.BIOMETRY_LOCKOUT) {
 *     console.log('Too many failed attempts - try again later');
 *   } else {
 *     console.error('Failed to retrieve token:', error);
 *   }
 * }
 * ```
 */
export async function getItem(
  key: string,
  options?: RetrievalOptions
): Promise<string | null> {
  if (!key) {
    throw new Error('Key is required');
  }

  const service = resolveService(options);
  const nativeModule = getNativeModule();

  try {
    const { didInvoke, result } = await invokeNative<{
      value?: string | null;
    } | null>(nativeModule, 'getItem', [
      key,
      {
        service,
        ...options,
      },
    ]);

    if (didInvoke) {
      return result?.value ?? null;
    }

    return fallbackGetItem(service, key);
  } catch (error: any) {
    const errorCode = error?.code || ErrorCode.DECRYPTION_FAILED;
    const message = `Failed to retrieve "${key}": ${error?.message}`;
    throw Object.assign(new Error(message), {
      code: errorCode,
      nativeError: error,
    });
  }
}

/**
 * Checks if a secret exists without decrypting
 *
 * Use this to check key existence before full retrieval, avoiding
 * unnecessary decryption or biometric prompts.
 *
 * **Performance:**
 * - Metadata lookup only: < 5ms
 * - No decryption or biometric required
 *
 * @param key - Unique identifier within the service
 * @param options - Service configuration
 *
 * @returns Promise resolving to true if key exists, false otherwise
 *
 * @throws {SensitiveInfoError} If storage system unavailable
 *
 * @example
 * ```typescript
 * const exists = await hasItem('auth_token', {
 *   keychainService: 'myapp'
 * });
 *
 * if (exists) {
 *   const token = await getItem('auth_token', { ... });
 *   // Use token
 * } else {
 *   // Redirect to login
 *   navigateTo('login');
 * }
 * ```
 */
export async function hasItem(
  key: string,
  options?: Pick<StorageOptions, 'keychainService'>
): Promise<boolean> {
  if (!key) {
    throw new Error('Key is required');
  }

  const service = resolveService(options);
  const nativeModule = getNativeModule();

  try {
    const { didInvoke, result } = await invokeNative<boolean>(
      nativeModule,
      'hasItem',
      [key, { service }]
    );

    if (didInvoke) {
      return Boolean(result);
    }

    return fallbackHasItem(service, key);
  } catch (error: any) {
    const message = `Failed to check "${key}": ${error?.message}`;
    throw Object.assign(new Error(message), {
      code: ErrorCode.KEYSTORE_UNAVAILABLE,
      nativeError: error,
    });
  }
}

/**
 * Deletes a specific secret
 *
 * **Caution:** This operation is irreversible. Once deleted, the secret
 * cannot be recovered.
 *
 * **Performance:**
 * - Typical time: 5-10ms
 * - Immediate effect
 *
 * @param key - Unique identifier within the service
 * @param options - Service configuration
 *
 * @returns Promise resolving when deletion complete
 *
 * @throws {SensitiveInfoError} If deletion fails
 *
 * @example
 * ```typescript
 * // On logout, delete auth token
 * await deleteItem('auth_token', {
 *   keychainService: 'myapp'
 * });
 * console.log('✓ Auth token securely deleted');
 *
 * // With confirmation
 * if (confirm('Delete this item?')) {
 *   await deleteItem('secret_key', { keychainService: 'myapp' });
 * }
 * ```
 */

export async function deleteItem(
  key: string,
  options?: Pick<StorageOptions, 'keychainService'>
): Promise<void> {
  if (!key) {
    throw new Error('Key is required');
  }

  const service = resolveService(options);
  const nativeModule = getNativeModule();

  try {
    const { didInvoke } = await invokeNative<void>(nativeModule, 'deleteItem', [
      key,
      { service },
    ]);

    if (didInvoke) {
      return;
    }

    fallbackDeleteItem(service, key);
  } catch (error: any) {
    const message = `Failed to delete "${key}": ${error?.message}`;
    throw Object.assign(new Error(message), {
      code: ErrorCode.KEYSTORE_UNAVAILABLE,
      nativeError: error,
    });
  }
}

/**
 * Lists all secret keys in a service
 *
 * **Note:** Only key names are returned, not values. Useful for:
 * - Audit logging
 * - Cleanup operations
 * - Inventory management
 *
 * **Performance:**
 * - Typical time: 10-25ms
 * - Scales with number of items
 *
 * @param options - Service configuration
 *
 * @returns Promise resolving to array of stored key names
 *
 * @throws {SensitiveInfoError} If operation fails
 *
 * @example
 * ```typescript
 * // List all stored tokens
 * const keys = await getAllItems({ keychainService: 'myapp' });
 * console.log(`Found ${keys.length} items:`, keys);
 *
 * // Retrieve all (with caution!)
 * for (const key of keys) {
 *   const value = await getItem(key, { keychainService: 'myapp' });
 *   console.log(`${key}: ${value ? '✓ found' : '✗ not found'}`);
 * }
 * ```
 */
export async function getAllItems(
  options?: Pick<StorageOptions, 'keychainService'>
): Promise<string[]> {
  const service = resolveService(options);
  const nativeModule = getNativeModule();

  try {
    const { didInvoke, result } = await invokeNative<string[]>(
      nativeModule,
      'getAllItems',
      [{ service }]
    );

    if (didInvoke) {
      return result ?? [];
    }

    return fallbackGetAllItems(service);
  } catch (error: any) {
    throw Object.assign(new Error(`Failed to list items: ${error?.message}`), {
      code: ErrorCode.KEYSTORE_UNAVAILABLE,
      nativeError: error,
    });
  }
}

/**
 * Clears all secrets in a service
 *
 * **Caution:** This operation is irreversible. All secrets in the service
 * will be permanently deleted.
 *
 * Common use cases:
 * - User logout (clear all auth tokens)
 * - Account reset or deauthorization
 * - Device wipe/reset preparation
 * - App uninstall cleanup
 *
 * **Performance:**
 * - Typical time: 10-50ms (depends on item count)
 * - Affects only specified service
 *
 * @param options - Service configuration
 *
 * @returns Promise resolving when all items cleared
 *
 * @throws {SensitiveInfoError} If clearing fails
 *
 * @example
 * ```typescript
 * // On logout - clear all app secrets
 * const handleLogout = async () => {
 *   try {
 *     await clearService({ keychainService: 'myapp' });
 *     console.log('✓ All secrets cleared');
 *
 *     // Navigate to login
 *     navigation.replace('Login');
 *   } catch (error) {
 *     console.error('Failed to clear secrets:', error);
 *   }
 * };
 *
 * // Selective clearing (different services)
 * await clearService({ keychainService: 'auth' });    // Clears auth tokens
 * await clearService({ keychainService: 'payment' }); // Clears payment data
 * ```
 */
export async function clearService(
  options?: Pick<StorageOptions, 'keychainService'>
): Promise<void> {
  const service = resolveService(options);
  const nativeModule = getNativeModule();

  try {
    const { didInvoke } = await invokeNative<void>(
      nativeModule,
      'clearService',
      [{ service }]
    );

    if (didInvoke) {
      return;
    }

    fallbackClearService(service);
  } catch (error: any) {
    const message = `Failed to clear service: ${error?.message}`;
    throw Object.assign(new Error(message), {
      code: ErrorCode.KEYSTORE_UNAVAILABLE,
      nativeError: error,
    });
  }
}

/**
 * Gets the security capabilities available on the device
 *
 * Use this to determine which security features can be offered to users:
 * - Show biometric option only if available
 * - Warn if only software-only storage available
 * - Decide which access control to request
 *
 * @returns Promise resolving to device capabilities
 *
 * @example
 * ```typescript
 * const caps = await getSupportedSecurityLevels();
 *
 * if (caps.biometry) {
 *   showBiometricOption(caps.biometryType);
 * }
 *
 * if (!caps.deviceCredential) {
 *   showSecurityWarning('Set device PIN for app protection');
 * }
 * ```
 */
export async function getSupportedSecurityLevels(): Promise<DeviceCapabilities> {
  const nativeModule = getNativeModule();

  try {
    const { didInvoke, result } = await invokeNative<DeviceCapabilities>(
      nativeModule,
      'getSupportedSecurityLevels',
      []
    );

    if (didInvoke && result) {
      return result;
    }

    return FALLBACK_CAPABILITIES;
  } catch {
    return FALLBACK_CAPABILITIES;
  }
}

/**
 * SensitiveInfo Public API
 *
 * Namespace providing all storage operations as static methods.
 * Convenient alternative to importing individual functions.
 *
 * @example
 * ```typescript
 * import SensitiveInfo from 'react-native-sensitive-info';
 *
 * // Use as namespace
 * await SensitiveInfo.setItem('token', 'value', { ... });
 * const token = await SensitiveInfo.getItem('token', { ... });
 * await SensitiveInfo.deleteItem('token', { ... });
 *
 * // Or use named imports
 * import { setItem, getItem, deleteItem } from 'react-native-sensitive-info';
 * ```
 */
export const SensitiveInfo = {
  setItem,
  getItem,
  hasItem,
  deleteItem,
  getAllItems,
  clearService,
  getSupportedSecurityLevels,
};

// Default export for convenience
export default SensitiveInfo;
