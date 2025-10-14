import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type AndroidPromptStrings = {
  readonly header?: string;
  readonly description?: string;
  readonly hint?: string;
  readonly cancel?: string;
  readonly notRecognized?: string;
  readonly success?: string;
  readonly cancelled?: string;
};

export type SensitiveInfoOptions = {
  readonly keychainService?: string;
  readonly sharedPreferencesName?: string;
  readonly touchID?: boolean;
  readonly showModal?: boolean;
  readonly strings?: AndroidPromptStrings;
  readonly kSecAttrAccessible?:
    | 'kSecAttrAccessibleAfterFirstUnlock'
    | 'kSecAttrAccessibleAlways'
    | 'kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly'
    | 'kSecAttrAccessibleWhenUnlockedThisDeviceOnly'
    | 'kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly'
    | 'kSecAttrAccessibleAlwaysThisDeviceOnly'
    | 'kSecAttrAccessibleWhenUnlocked';
  readonly kSecAccessControl?:
    | 'kSecAccessControlApplicationPassword'
    | 'kSecAccessControlPrivateKeyUsage'
    | 'kSecAccessControlDevicePasscode'
    | 'kSecAccessControlTouchIDAny'
    | 'kSecAccessControlTouchIDCurrentSet'
    | 'kSecAccessControlUserPresence'
    | 'kSecAccessControlBiometryAny'
    | 'kSecAccessControlBiometryCurrentSet';
  readonly kSecUseOperationPrompt?: string;
  readonly kLocalizedFallbackTitle?: string;
  readonly kSecAttrSynchronizable?: 'enabled' | 'disabled' | 'any';
};

export interface Spec extends TurboModule {
  readonly getConstants: () => {};
  setItem(
    key: string,
    value: string,
    options: SensitiveInfoOptions
  ): Promise<null>;
  getItem(key: string, options: SensitiveInfoOptions): Promise<string | null>;
  hasItem(key: string, options: SensitiveInfoOptions): Promise<boolean>;
  getAllItems(
    options: SensitiveInfoOptions
  ): Promise<Array<{ key: string; value: string; service: string }>>;
  deleteItem(key: string, options: SensitiveInfoOptions): Promise<null>;
  isSensorAvailable(): Promise<string | boolean>;
  hasEnrolledFingerprints(): Promise<boolean>;
  cancelFingerprintAuth(): void;
  setInvalidatedByBiometricEnrollment(set: boolean): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('SensitiveInfo');
