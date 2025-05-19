import type { HybridObject } from 'react-native-nitro-modules';

export type SensitiveInfoOptions = {
  requireBiometric?: boolean;
  promptOptions?: BiometricPromptOptions;
  biometric?: boolean; // for compatibility with JS API
};

export interface BiometricPromptOptions {
  /** Title for the biometric prompt (Android only) */
  title?: string;
  /** Subtitle for the biometric prompt (Android only) */
  subtitle?: string;
  /** Description for the biometric prompt (Android only) */
  description?: string;
  /** Negative button text (Android only) */
  negativeButtonText?: string;
  /** Reason for authentication (iOS only) */
  reason?: string;
}

export interface SensitiveInfo
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /**
   * Store a value securely.
   * @param key The key to store the value under.
   * @param value The value to store.
   * @param options Optional: require biometric authentication to access this value.
   */
  setItem(
    key: string,
    value: string,
    options?: {
      requireBiometric?: boolean;
      promptOptions?: BiometricPromptOptions;
    }
  ): Promise<void>;

  /**
   * Retrieve a value securely.
   * @param key The key to retrieve.
   * @param options Optional: require biometric authentication to access this value.
   */
  getItem(
    key: string,
    options?: {
      requireBiometric?: boolean;
      promptOptions?: BiometricPromptOptions;
    }
  ): Promise<string | null>;

  /**
   * Delete a value securely.
   * @param key The key to delete.
   */
  deleteItem(key: string): Promise<void>;

  /**
   * Check if biometric authentication is available on the device.
   */
  isBiometricAvailable(): Promise<boolean>;

  /**
   * Prompt the user for biometric authentication only (no storage).
   * @param options Prompt customization options.
   */
  authenticate(options?: BiometricPromptOptions): Promise<boolean>;
}
