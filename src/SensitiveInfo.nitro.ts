import type { HybridObject } from 'react-native-nitro-modules';

/**
 * Security level for storage operations.
 */
/**
 * Available security levels for storage operations.
 */
export type SecurityLevel = 'standard' | 'biometric' | 'strongbox';

/**
 * Constant helper for security levels with excellent IDE completion.
 *
 * Example:
 * setItem(key, value, { securityLevel: SecurityLevels.Biometric })
 */
export const SecurityLevels = {
  Standard: 'standard',
  Biometric: 'biometric',
  StrongBox: 'strongbox',
} as const;

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
/**
 * Options for storage operations when NOT using biometrics explicitly.
 * If provided, `securityLevel` can be 'standard' or 'strongbox'.
 * Note: `biometricOptions` are not accepted in this branch and will be a type error.
 */
export interface StorageOptions {
  /** Security level for the operation */
  securityLevel?: SecurityLevel;
  /** Biometric authentication options (when securityLevel is 'biometric') */
  biometricOptions?: BiometricOptions;
}

/**
 * Narrowed variants for better TS DX (not used by Nitro codegen directly).
 */
export interface StandardOrStrongBoxOptions {
  securityLevel?: Exclude<SecurityLevel, 'biometric'>;
  biometricOptions?: never;
}

export interface BiometricStorageOptions {
  securityLevel: 'biometric';
  biometricOptions?: BiometricOptions;
}

/**
 * Small helpers to build strongly‑typed options with great autocompletion.
 */
export const withStandard = (): StandardOrStrongBoxOptions => ({
  securityLevel: SecurityLevels.Standard,
});

export const withStrongBox = (): StandardOrStrongBoxOptions => ({
  securityLevel: SecurityLevels.StrongBox,
});

export const withBiometrics = (
  biometricOptions?: BiometricOptions
): BiometricStorageOptions => ({
  securityLevel: SecurityLevels.Biometric,
  biometricOptions,
});

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
