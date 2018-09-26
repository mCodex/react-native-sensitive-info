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
  kSecAccessControl?: RNSensitiveInfoAccessControlOptions;
  kSecAttrAccessible?: RNSensitiveInfoAttrAccessibleOptions;
  keychainService?: string;
  kSecUseOperationPrompt?: string;
  sharedPreferencesName?: string;
  touchID?: boolean;
}

export declare function setItem(key: string, value: string, options: RNSensitiveInfoOptions): Promise<null>;
export declare function getItem(key: string, options: RNSensitiveInfoOptions): Promise<string>;
export declare function getAllItems(options: RNSensitiveInfoOptions): Promise<Object>;
export declare function deleteItem(key: string, options: RNSensitiveInfoOptions): Promise<null>;
export declare function isSensorAvailable(): Promise<RNSensitiveInfoBiometryType | boolean>;
export declare function isHardwareDetected(): Promise<boolean>;
export declare function hasEnrolledFingerprints(): Promise<boolean>;
export declare function cancelFingerprintAuth(): void;
