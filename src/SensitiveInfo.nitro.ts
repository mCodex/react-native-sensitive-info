import type { HybridObject } from 'react-native-nitro-modules';

/**
 * Security level for storage operations.
 */
export type SecurityLevel = 'standard' | 'biometric' | 'strongbox';

/**
 * Biometric authentication options.
 */
export interface BiometricOptions {
  /** Title shown in the biometric prompt */
  promptTitle?: string;
  /** Subtitle shown in the biometric prompt */
  promptSubtitle?: string;
  /** Description shown in the biometric prompt */
  promptDescription?: string;
  /** Cancel button text */
  cancelButtonText?: string;
  /** Allow device credential (PIN/Pattern/Password) as fallback */
  allowDeviceCredential?: boolean;
}

/**
 * Options for storage operations.
 */
export interface StorageOptions {
  /** Security level for the operation */
  securityLevel?: SecurityLevel;
  /** Biometric authentication options (when securityLevel is 'biometric') */
  biometricOptions?: BiometricOptions;
}

/**
 * Nitro hybrid object interface for secure storage APIs.
 */
export interface SensitiveInfo
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /** Get a stored value by key. */
  getItem(key: string, options?: StorageOptions): Promise<string | null>;

  /** Store a value under the specified key. */
  setItem(key: string, value: string, options?: StorageOptions): Promise<void>;

  /** Remove the value for the given key. */
  removeItem(key: string, options?: StorageOptions): Promise<void>;

  /** Retrieve all stored key-value pairs. */
  getAllItems(options?: StorageOptions): Promise<Record<string, string>>;

  /** Clear all stored items. */
  clear(options?: StorageOptions): Promise<void>;

  /** Check if biometric authentication is available on the device. */
  isBiometricAvailable(): Promise<boolean>;

  /** Check if StrongBox is available on the device. */
  isStrongBoxAvailable(): Promise<boolean>;
}
