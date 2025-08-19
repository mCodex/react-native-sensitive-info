import { NitroModules } from 'react-native-nitro-modules';
import { getHostComponent, type ViewConfig } from 'react-native-nitro-modules';
import type {
  BiometricPromptMethods,
  BiometricPromptProps,
} from './BiometricPromptView.nitro';
import type {
  SensitiveInfo,
  StorageOptions,
  BiometricStorageOptions,
  StandardOrStrongBoxOptions,
  SecurityLevel,
} from './SensitiveInfo.nitro';
import { withBiometrics, withStrongBox } from './SensitiveInfo.nitro';

const SensitiveInfoHybridObject =
  NitroModules.createHybridObject<SensitiveInfo>('SensitiveInfo');

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
  return SensitiveInfoHybridObject.getItem(key, options);
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
  return SensitiveInfoHybridObject.setItem(key, value, options);
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
  return SensitiveInfoHybridObject.removeItem(key, options);
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
  return SensitiveInfoHybridObject.getAllItems(options);
}

/**
 * Clear all stored items.
 */
export function clear(): Promise<void>;
export function clear(options: StandardOrStrongBoxOptions): Promise<void>;
export function clear(options: BiometricStorageOptions): Promise<void>;
export function clear(options?: StorageOptions): Promise<void>;
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

// Hybrid View: BiometricPromptView
let _BiometricPromptNativeView: any;
try {
  // Provide a minimal ViewConfig. Nitro uses uiViewClassName for lookup,
  // and validAttributes to pass props to the native Hybrid View.
  const viewConfig: ViewConfig<BiometricPromptProps> = {
    uiViewClassName: 'BiometricPromptView',
    bubblingEventTypes: {},
    directEventTypes: {},
    validAttributes: {
      promptTitle: true,
      promptSubtitle: true,
      promptDescription: true,
      cancelButtonText: true,
      allowDeviceCredential: true,
    },
  } as const;
  _BiometricPromptNativeView = getHostComponent<
    BiometricPromptProps,
    BiometricPromptMethods
  >('BiometricPromptView', () => viewConfig);
} catch {
  // During tests or when nitrogen hasn't run yet.
}

export const BiometricPromptView = _BiometricPromptNativeView as any;

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
