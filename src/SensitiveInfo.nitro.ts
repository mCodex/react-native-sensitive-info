import type { HybridObject } from 'react-native-nitro-modules';

/**
 * Nitro hybrid object interface for secure storage APIs.
 */
export interface SensitiveInfo
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /** Get a stored value by key. */
  getItem(key: string): Promise<string | null>;

  /** Store a value under the specified key. */
  setItem(key: string, value: string): Promise<void>;

  /** Remove the value for the given key. */
  removeItem(key: string): Promise<void>;

  /** Retrieve all stored key-value pairs. */
  getAllItems(): Promise<Record<string, string>>;

  /** Clear all stored items. */
  clear(): Promise<void>;
}
