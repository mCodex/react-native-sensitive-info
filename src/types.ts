export type RNSensitiveInfoBiometryType = 'Touch ID' | 'Face ID';

export type RNSensitiveInfoAccessControlOptions =
  | 'kSecAccessControlApplicationPassword'
  | 'kSecAccessControlPrivateKeyUsage'
  | 'kSecAccessControlDevicePasscode'
  | 'kSecAccessControlTouchIDAny'
  | 'kSecAccessControlTouchIDCurrentSet'
  | 'kSecAccessControlUserPresence'
  | 'kSecAccessControlBiometryAny'
  | 'kSecAccessControlBiometryCurrentSet';

export type RNSensitiveInfoAttrAccessibleOptions =
  | 'kSecAttrAccessibleAfterFirstUnlock'
  | 'kSecAttrAccessibleAlways'
  | 'kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly'
  | 'kSecAttrAccessibleWhenUnlockedThisDeviceOnly'
  | 'kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly'
  | 'kSecAttrAccessibleAlwaysThisDeviceOnly'
  | 'kSecAttrAccessibleWhenUnlocked';

export interface RNSensitiveInfoAndroidDialogStrings {
  header?: string;
  description?: string;
  hint?: string;
  success?: string;
  notRecognized?: string;
  cancel?: string;
  cancelled?: string;
}

export interface RNSensitiveInfoOptions {
  kSecAccessControl?: RNSensitiveInfoAccessControlOptions;
  kSecAttrAccessible?: RNSensitiveInfoAttrAccessibleOptions;
  kSecAttrSynchronizable?: boolean;
  keychainService?: string;
  sharedPreferencesName?: string;
  touchID?: boolean;
  showModal?: boolean;
  kSecUseOperationPrompt?: string;
  kLocalizedFallbackTitle?: string;
  strings?: RNSensitiveInfoAndroidDialogStrings;
}

export interface SensitiveInfoEntry {
  key: string;
  value: string;
  service: string;
}
