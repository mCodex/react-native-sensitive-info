export enum RNSensitiveInfoBiometryType {
  "Touch ID",
  "Face ID",
}

export enum RNSensitiveInfoAccessControlOptions {
  'kSecAccessControlApplicationPassword',
  'kSecAccessControlPrivateKeyUsage',
  'kSecAccessControlDevicePasscode',
  'kSecAccessControlTouchIDAny',
  'kSecAccessControlTouchIDCurrentSet',
  'kSecAccessControlUserPresence',
}

export enum RNSensitiveInfoAttrAccessibleOptions {
  'kSecAttrAccessibleAfterFirstUnlock',
  'kSecAttrAccessibleAlways',
  'kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly',
  'kSecAttrAccessibleWhenUnlockedThisDeviceOnly',
  'kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly',
  'kSecAttrAccessibleAlwaysThisDeviceOnly',
  'kSecAttrAccessibleWhenUnlocked',
}

export interface RNSensitiveInfoOptions {
  kSecAccessControl: RNSensitiveInfoAccessControlOptions;
  kSecAttrAccessible: RNSensitiveInfoAttrAccessibleOptions;
  keychainService: string;
  kSecUseOperationPrompt: string;
  sharedPreferencesName: string;
  touchID: boolean;
}

declare class RNSensitiveInfo {
  setItem(
    key: string,
    value: string,
    options: RNSensitiveInfoOptions,
  ): Promise<null>;

  getItem(key: string, options: RNSensitiveInfoOptions): Promise<string>;

  getAllItems(options: RNSensitiveInfoOptions): Promise<Object>;

  deleteItem(key: string, options: RNSensitiveInfoOptions): Promise<null>;

  isSensorAvailable(): Promise<RNSensitiveInfoBiometryType | boolean>;

  isHardwareDetected(): Promise<boolean>;

  hasEnrolledFingerprints(): Promise<boolean>;

  cancelFingerprintAuth(): void;
}

declare const rnSensitiveInfo: RNSensitiveInfo;
export default rnSensitiveInfo;
