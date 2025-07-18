import { NitroModules } from 'react-native-nitro-modules';
import type { SensitiveInfo } from './SensitiveInfo.nitro';

const SensitiveInfoHybridObject =
  NitroModules.createHybridObject<SensitiveInfo>('SensitiveInfo');

/**
 * Get a stored value by key.
 */
export function getItem(key: string): Promise<string | null> {
  return SensitiveInfoHybridObject.getItem(key);
}

/**
 * Store a value under the specified key.
 */
export function setItem(key: string, value: string): Promise<void> {
  return SensitiveInfoHybridObject.setItem(key, value);
}

/**
 * Remove the value for the given key.
 */
export function removeItem(key: string): Promise<void> {
  return SensitiveInfoHybridObject.removeItem(key);
}

/**
 * Retrieve all stored key-value pairs.
 */
export function getAllItems(): Promise<Record<string, string>> {
  return SensitiveInfoHybridObject.getAllItems();
}

/**
 * Clear all stored items.
 */
export function clear(): Promise<void> {
  return SensitiveInfoHybridObject.clear();
}
