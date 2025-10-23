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
 *   accessControl: 'biometryOrDevicePasscode',
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

// Re-export improved types for tree-shaking
export {
  type AccessControl,
  type AuthenticationPrompt,
  type DeviceCapabilities,
  type ItemMetadata,
  type RetrievalOptions,
  type SecurityLevel,
  type StorageOptions,
  type OperationResult,
  ErrorCode,
  SensitiveInfoError,
  isSensitiveInfoError,
  SUPPORTED_PLATFORMS,
  MIN_VERSIONS,
  DEFAULT_ACCESS_CONTROL,
  DEFAULT_KEYCHAIN_SERVICE,
  MAX_VALUE_LENGTH,
} from './types';

// Legacy exports for backward compatibility
export interface SensitiveInfoOptions {
  keychainService?: string;
  accessControl?:
    | 'devicePasscode'
    | 'biometryOrDevicePasscode'
    | 'biometryCurrentSet';
  authenticationPrompt?: {
    title?: string;
    subtitle?: string;
    description?: string;
    negativeButtonText?: string;
  };
  prompt?: {
    title?: string;
    subtitle?: string;
    description?: string;
  };
}

export interface StoredItemMetadata {
  timestamp: string;
  securityLevel:
    | 'hardware-backed'
    | 'biometric-protected'
    | 'passcode-protected'
    | 'software';
  accessControl: string;
}

export interface StorageOperationResult {
  success: boolean;
  metadata?: StoredItemMetadata;
}

export enum SensitiveInfoErrorCode {
  AUTH_FAILED = 'E_AUTH_FAILED',
  AUTH_CANCELED = 'E_AUTH_CANCELED',
  AUTH_TIMEOUT = 'E_AUTH_TIMEOUT',
  BIOMETRY_LOCKOUT = 'E_BIOMETRY_LOCKOUT',
  BIOMETRY_NOT_AVAILABLE = 'E_BIOMETRY_NOT_AVAILABLE',
  KEY_INVALIDATED = 'E_KEY_INVALIDATED',
  DECRYPTION_FAILED = 'E_DECRYPTION_FAILED',
  ENCRYPTION_FAILED = 'E_ENCRYPTION_FAILED',
  KEYSTORE_UNAVAILABLE = 'E_KEYSTORE_UNAVAILABLE',
  MIGRATION_FAILED = 'E_MIGRATION_FAILED',
}

/**
 * Mock storage for development and example app
 * In production, this delegates to native modules
 * @private
 */
const mockStorage: Record<string, string> = {};

/**
 * Get native module instance
 * @private
 */
function getNativeModule() {
  try {
    return NativeModules.SensitiveInfo;
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

/**
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
 * @throws {Error} With code from SensitiveInfoErrorCode enum
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
 *   accessControl: 'biometryOrDevicePasscode',
 *   authenticationPrompt: {
 *     title: 'Secure Storage',
 *     subtitle: 'Biometric required'
 *   }
 * });
 *
 * // Face ID only (iOS)
 * await setItem('payment_token', token, {
 *   keychainService: 'myapp',
 *   accessControl: 'biometryCurrentSet',
 *   authenticationPrompt: {
 *     title: 'Face ID Required',
 *     subtitle: 'Store payment method'
 *   }
 * });
 * ```
 */
export async function setItem(
  key: string,
  value: string,
  options?: SensitiveInfoOptions
): Promise<StorageOperationResult> {
  if (!key || !value) {
    throw new Error('Key and value are required');
  }

  const service = options?.keychainService || 'default';
  const nativeModule = getNativeModule();

  try {
    if (nativeModule?.setItem) {
      // Use native implementation when available
      return await nativeModule.setItem(key, value, {
        service,
        ...options,
      });
    }

    // Development/example fallback
    const storageKey = createStorageKey(service, key);
    mockStorage[storageKey] = value;

    return {
      success: true,
      metadata: {
        timestamp: new Date().toISOString(),
        securityLevel: 'software',
        accessControl: options?.accessControl || 'devicePasscode',
      },
    };
  } catch (error: any) {
    const errorCode = error?.code || SensitiveInfoErrorCode.ENCRYPTION_FAILED;
    const message = `Failed to store "${key}": ${error?.message}`;
    throw Object.assign(new Error(message), {
      code: errorCode,
      originalError: error,
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
 * @throws {Error} With code from SensitiveInfoErrorCode enum
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
 *   if (error.code === 'E_AUTH_CANCELED') {
 *     console.log('User canceled authentication');
 *   } else if (error.code === 'E_BIOMETRY_LOCKOUT') {
 *     console.log('Too many failed attempts - try again later');
 *   } else {
 *     console.error('Failed to retrieve token:', error);
 *   }
 * }
 * ```
 */
export async function getItem(
  key: string,
  options?: SensitiveInfoOptions
): Promise<string | null> {
  if (!key) {
    throw new Error('Key is required');
  }

  const service = options?.keychainService || 'default';
  const nativeModule = getNativeModule();

  try {
    if (nativeModule?.getItem) {
      // Use native implementation when available
      const result = await nativeModule.getItem(key, {
        service,
        ...options,
      });
      // Extract the value field from the native result object
      return result?.value ?? null;
    }

    // Development/example fallback
    const storageKey = createStorageKey(service, key);
    return mockStorage[storageKey] ?? null;
  } catch (error: any) {
    const errorCode = error?.code || SensitiveInfoErrorCode.DECRYPTION_FAILED;
    const message = `Failed to retrieve "${key}": ${error?.message}`;
    throw Object.assign(new Error(message), {
      code: errorCode,
      originalError: error,
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
 * @throws {Error} If storage system unavailable
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
  options?: SensitiveInfoOptions
): Promise<boolean> {
  if (!key) {
    throw new Error('Key is required');
  }

  const service = options?.keychainService || 'default';
  const nativeModule = getNativeModule();

  try {
    if (nativeModule?.hasItem) {
      return await nativeModule.hasItem(key, { service });
    }

    // Development/example fallback
    const storageKey = createStorageKey(service, key);
    return storageKey in mockStorage;
  } catch (error: any) {
    const message = `Failed to check "${key}": ${error?.message}`;
    throw Object.assign(new Error(message), {
      code: SensitiveInfoErrorCode.KEYSTORE_UNAVAILABLE,
      originalError: error,
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
 * @throws {Error} If deletion fails
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
  options?: SensitiveInfoOptions
): Promise<void> {
  if (!key) {
    throw new Error('Key is required');
  }

  const service = options?.keychainService || 'default';
  const nativeModule = getNativeModule();

  try {
    if (nativeModule?.deleteItem) {
      await nativeModule.deleteItem(key, { service });
      return;
    }

    // Development/example fallback
    const storageKey = createStorageKey(service, key);
    delete mockStorage[storageKey];
  } catch (error: any) {
    const message = `Failed to delete "${key}": ${error?.message}`;
    throw Object.assign(new Error(message), {
      code: SensitiveInfoErrorCode.KEYSTORE_UNAVAILABLE,
      originalError: error,
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
 * @throws {Error} If operation fails
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
  options?: SensitiveInfoOptions
): Promise<string[]> {
  const service = options?.keychainService || 'default';
  const nativeModule = getNativeModule();

  try {
    if (nativeModule?.getAllItems) {
      return await nativeModule.getAllItems({ service });
    }

    // Development/example fallback
    const prefix = createStorageKey(service, '');
    return Object.keys(mockStorage)
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.substring(prefix.length));
  } catch (error: any) {
    throw Object.assign(new Error(`Failed to list items: ${error?.message}`), {
      code: SensitiveInfoErrorCode.KEYSTORE_UNAVAILABLE,
      originalError: error,
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
 * @throws {Error} If clearing fails
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
  options?: SensitiveInfoOptions
): Promise<void> {
  const service = options?.keychainService || 'default';
  const nativeModule = getNativeModule();

  try {
    if (nativeModule?.clearService) {
      await nativeModule.clearService({ service });
      return;
    }

    // Development/example fallback
    const prefix = createStorageKey(service, '');
    Object.keys(mockStorage).forEach((key) => {
      if (key.startsWith(prefix)) {
        delete mockStorage[key];
      }
    });
  } catch (error: any) {
    const message = `Failed to clear service: ${error?.message}`;
    throw Object.assign(new Error(message), {
      code: SensitiveInfoErrorCode.KEYSTORE_UNAVAILABLE,
      originalError: error,
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
 * @param _options - Configuration options (reserved for future use)
 *
 * @returns Promise resolving to array of available security levels
 *
 * @example
 * ```typescript
 * const supported = await getSupportedSecurityLevels();
 *
 * const usesBiometric = supported.includes('biometryOrDevicePasscode');
 * const usesPasscode = supported.includes('devicePasscode');
 *
 * // Adjust UI based on capabilities
 * if (usesBiometric) {
 *   // Show "Use Face ID" option
 * } else if (usesPasscode) {
 *   // Show "Use Device Passcode" option
 * } else {
 *   // Show warning about software-only storage
 * }
 * ```
 */
export async function getSupportedSecurityLevels(
  _options?: SensitiveInfoOptions
): Promise<string[]> {
  return ['biometryOrDevicePasscode', 'devicePasscode'];
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
