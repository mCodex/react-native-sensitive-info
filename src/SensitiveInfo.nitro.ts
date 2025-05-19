import type { HybridObject } from 'react-native-nitro-modules';

export interface SensitiveInfo
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /**
   * Store a value securely.
   * @param key The key to store the value under.
   * @param value The value to store.
   * @param requireBiometric Require biometric authentication to access this value.
   * @param promptTitle Title for the biometric prompt (Android/iOS).
   * @param promptSubtitle Subtitle for the biometric prompt (Android only).
   * @param promptDescription Description for the biometric prompt (Android only).
   * @param promptNegativeButton Negative button text (Android only).
   * @param promptReason Reason for authentication (iOS only).
   */
  setItem(
    key: string,
    value: string,
    requireBiometric?: boolean,
    promptTitle?: string,
    promptSubtitle?: string,
    promptDescription?: string,
    promptNegativeButton?: string,
    promptReason?: string
  ): Promise<void>;

  /**
   * Retrieve a value securely.
   * @param key The key to retrieve.
   * @param requireBiometric Require biometric authentication to access this value.
   * @param promptTitle Title for the biometric prompt (Android/iOS).
   * @param promptSubtitle Subtitle for the biometric prompt (Android only).
   * @param promptDescription Description for the biometric prompt (Android only).
   * @param promptNegativeButton Negative button text (Android only).
   * @param promptReason Reason for authentication (iOS only).
   */
  getItem(
    key: string,
    requireBiometric?: boolean,
    promptTitle?: string,
    promptSubtitle?: string,
    promptDescription?: string,
    promptNegativeButton?: string,
    promptReason?: string
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
   * @param promptTitle Title for the biometric prompt (Android/iOS).
   * @param promptSubtitle Subtitle for the biometric prompt (Android only).
   * @param promptDescription Description for the biometric prompt (Android only).
   * @param promptNegativeButton Negative button text (Android only).
   * @param promptReason Reason for authentication (iOS only).
   */
  authenticate(
    promptTitle?: string,
    promptSubtitle?: string,
    promptDescription?: string,
    promptNegativeButton?: string,
    promptReason?: string
  ): Promise<boolean>;
}
