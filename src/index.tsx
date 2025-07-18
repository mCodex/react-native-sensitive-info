import { NitroModules } from 'react-native-nitro-modules';
import type { SensitiveInfo, StorageOptions } from './SensitiveInfo.nitro';

const SensitiveInfoHybridObject =
  NitroModules.createHybridObject<SensitiveInfo>('SensitiveInfo');

/**
 * Get a stored value by key.
 */
export function getItem(
  key: string,
  options?: StorageOptions
): Promise<string | null> {
  return SensitiveInfoHybridObject.getItem(key, options);
}

/**
 * Store a value under the specified key.
 */
export function setItem(
  key: string,
  value: string,
  options?: StorageOptions
): Promise<void> {
  return SensitiveInfoHybridObject.setItem(key, value, options);
}

/**
 * Remove the value for the given key.
 */
export function removeItem(
  key: string,
  options?: StorageOptions
): Promise<void> {
  return SensitiveInfoHybridObject.removeItem(key, options);
}

/**
 * Retrieve all stored key-value pairs.
 */
export function getAllItems(
  options?: StorageOptions
): Promise<Record<string, string>> {
  return SensitiveInfoHybridObject.getAllItems(options);
}

/**
 * Clear all stored items.
 */
export function clear(options?: StorageOptions): Promise<void> {
  return SensitiveInfoHybridObject.clear(options);
}

/**
 * Check if biometric authentication is available on the device.
 */
export function isBiometricAvailable(): Promise<boolean> {
  return SensitiveInfoHybridObject.isBiometricAvailable();
}

/**
 * Check if StrongBox is available on the device.
 */
export function isStrongBoxAvailable(): Promise<boolean> {
  return SensitiveInfoHybridObject.isStrongBoxAvailable();
}

// Export React hooks
export { useSensitiveInfo } from './hooks/useSensitiveInfo';
export type { StoredItem } from './hooks/useSensitiveInfo';

// Export types
export type {
  StorageOptions,
  SecurityLevel,
  BiometricOptions,
} from './SensitiveInfo.nitro';
