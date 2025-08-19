import { NitroModules } from 'react-native-nitro-modules';
// (Hybrid View host component intentionally omitted for stability)
import type {
  SensitiveInfo,
  StorageOptions,
  BiometricStorageOptions,
  StandardOrStrongBoxOptions,
  SecurityLevel,
} from './SensitiveInfo.nitro';
import { withBiometrics, withStrongBox } from './SensitiveInfo.nitro';

let _SensitiveInfoHybridObject: SensitiveInfo | null = null;
let _initAttempted = false;

async function waitForHybrid<T>(create: () => T): Promise<T> {
  // If we already tried, just create (it should be ready by now or throw clearly)
  if (_initAttempted) return create();
  _initAttempted = true;

  // Small retry loop: give Nitro a moment to register on app start
  const maxTries = 8;
  const backoffMs = [0, 10, 20, 40, 80, 120, 180, 250];

  // Native init now happens in the Package static init (Android) and ObjC/Swift load (iOS)
  for (let i = 0; i < maxTries; i++) {
    try {
      return create();
    } catch (e) {
      await new Promise((r) => setTimeout(r, backoffMs[i] ?? 200));
    }
  }
  // Final attempt (will throw with the helpful Nitro error message if still not registered)
  return create();
}

async function getSensitiveInfoAsync(): Promise<SensitiveInfo> {
  if (_SensitiveInfoHybridObject) return _SensitiveInfoHybridObject;
  const instance = await waitForHybrid(() =>
    NitroModules.createHybridObject<SensitiveInfo>('SensitiveInfo')
  );
  _SensitiveInfoHybridObject = instance;
  return instance;
}

/**
 * Get a stored value by key.
 */
export function getItem(key: string): Promise<string | null>;
export function getItem(
  key: string,
  options: StandardOrStrongBoxOptions
): Promise<string | null>;
export function getItem(
  key: string,
  options: BiometricStorageOptions
): Promise<string | null>;
export function getItem(
  key: string,
  options?: StorageOptions
): Promise<string | null>;
export function getItem(
  key: string,
  options?: StorageOptions
): Promise<string | null> {
  return getSensitiveInfoAsync().then((m) => m.getItem(key, options));
}

/**
 * Store a value under the specified key.
 */
export function setItem(key: string, value: string): Promise<void>;
export function setItem(
  key: string,
  value: string,
  options: StandardOrStrongBoxOptions
): Promise<void>;
export function setItem(
  key: string,
  value: string,
  options: BiometricStorageOptions
): Promise<void>;
export function setItem(
  key: string,
  value: string,
  options?: StorageOptions
): Promise<void>;
export function setItem(
  key: string,
  value: string,
  options?: StorageOptions
): Promise<void> {
  return getSensitiveInfoAsync().then((m) => m.setItem(key, value, options));
}

/**
 * Remove the value for the given key.
 */
export function removeItem(key: string): Promise<void>;
export function removeItem(
  key: string,
  options: StandardOrStrongBoxOptions
): Promise<void>;
export function removeItem(
  key: string,
  options: BiometricStorageOptions
): Promise<void>;
export function removeItem(
  key: string,
  options?: StorageOptions
): Promise<void>;
export function removeItem(
  key: string,
  options?: StorageOptions
): Promise<void> {
  return getSensitiveInfoAsync().then((m) => m.removeItem(key, options));
}

/**
 * Retrieve all stored key-value pairs.
 */
export function getAllItems(): Promise<Record<string, string>>;
export function getAllItems(
  options: StandardOrStrongBoxOptions
): Promise<Record<string, string>>;
export function getAllItems(
  options: BiometricStorageOptions
): Promise<Record<string, string>>;
export function getAllItems(
  options?: StorageOptions
): Promise<Record<string, string>>;
export function getAllItems(
  options?: StorageOptions
): Promise<Record<string, string>> {
  return getSensitiveInfoAsync().then((m) => m.getAllItems(options));
}

/**
 * Clear all stored items.
 */
export function clear(): Promise<void>;
export function clear(options: StandardOrStrongBoxOptions): Promise<void>;
export function clear(options: BiometricStorageOptions): Promise<void>;
export function clear(options?: StorageOptions): Promise<void>;
export function clear(options?: StorageOptions): Promise<void> {
  return getSensitiveInfoAsync().then((m) => m.clear(options));
}

/**
 * Check if biometric authentication is available on the device.
 */
export function isBiometricAvailable(): Promise<boolean> {
  return getSensitiveInfoAsync().then((m) => m.isBiometricAvailable());
}

/**
 * Check if StrongBox is available on the device.
 */
export function isStrongBoxAvailable(): Promise<boolean> {
  return getSensitiveInfoAsync().then((m) => m.isStrongBoxAvailable());
}

/**
 * Get the available security capabilities of the device.
 * This helps determine what security levels are actually supported.
 */
export type SecurityCapabilities = {
  biometric: boolean;
  strongbox: boolean;
  recommendedLevel: SecurityLevel;
};

export async function getSecurityCapabilities(): Promise<SecurityCapabilities> {
  const [biometric, strongbox] = await Promise.all([
    isBiometricAvailable(),
    isStrongBoxAvailable(),
  ]);

  let recommendedLevel: SecurityLevel = 'standard';

  if (strongbox) {
    recommendedLevel = 'strongbox';
  } else if (biometric) {
    recommendedLevel = 'biometric';
  }

  return {
    biometric,
    strongbox,
    recommendedLevel,
  };
}

// Export React hooks
export { useSensitiveInfo } from './hooks/useSensitiveInfo';
export type {
  StoredItem,
  UseSensitiveInfoReturn,
  SecurityCapabilities as HookSecurityCapabilities,
} from './hooks/useSensitiveInfo';
export { BiometricAuthenticator } from './utils/BiometricAuthenticator';

// Note: We avoid eagerly registering the HybridView host component to prevent
// Fabric crashes on some setups. If needed in the future, we can expose a
// helper that lazily calls getHostComponent.
export const BiometricPromptView = undefined as unknown as any;

// Export types
export type {
  StorageOptions,
  SecurityLevel,
  BiometricOptions,
} from './SensitiveInfo.nitro';

export {
  SecurityLevels,
  withBiometrics,
  withStrongBox,
  withStandard,
} from './SensitiveInfo.nitro';

// Ergonomic wrappers (opt-in) — avoids creating option objects on the call-site
export function setItemBiometric(
  key: string,
  value: string,
  biometric?: BiometricStorageOptions['biometricOptions']
): Promise<void> {
  return setItem(key, value, withBiometrics(biometric));
}

export function getItemBiometric(
  key: string,
  biometric?: BiometricStorageOptions['biometricOptions']
): Promise<string | null> {
  return getItem(key, withBiometrics(biometric));
}

export function removeItemBiometric(
  key: string,
  biometric?: BiometricStorageOptions['biometricOptions']
): Promise<void> {
  return removeItem(key, withBiometrics(biometric));
}

export function setItemStrongBox(key: string, value: string): Promise<void> {
  return setItem(key, value, withStrongBox());
}

export function getItemStrongBox(key: string): Promise<string | null> {
  return getItem(key, withStrongBox());
}

export function removeItemStrongBox(key: string): Promise<void> {
  return removeItem(key, withStrongBox());
}

export function getAllItemsStrongBox(): Promise<Record<string, string>> {
  return getAllItems(withStrongBox());
}

export function clearStrongBox(): Promise<void> {
  return clear(withStrongBox());
}

export type {
  BiometricStorageOptions,
  StandardOrStrongBoxOptions,
} from './SensitiveInfo.nitro';
