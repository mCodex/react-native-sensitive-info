type RNSensitiveInfoBiometryType = "Touch ID" | "Face ID";

type RNSensitiveInfoAccessControlOptions =
  | "kSecAccessControlApplicationPassword"
  | "kSecAccessControlPrivateKeyUsage"
  | "kSecAccessControlDevicePasscode"
  | "kSecAccessControlTouchIDAny"
  | "kSecAccessControlTouchIDCurrentSet"
  | "kSecAccessControlUserPresence"
  | "kSecAccessControlBiometryAny"
  | "kSecAccessControlBiometryCurrentSet";

type RNSensitiveInfoAttrAccessibleOptions =
  | "kSecAttrAccessibleAfterFirstUnlock"
  | "kSecAttrAccessibleAlways"
  | "kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly"
  | "kSecAttrAccessibleWhenUnlockedThisDeviceOnly"
  | "kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly"
  | "kSecAttrAccessibleAlwaysThisDeviceOnly"
  | "kSecAttrAccessibleWhenUnlocked";

interface RNSensitiveInfoAndroidDialogStrings {
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
  keychainService?: string;
  sharedPreferencesName?: string;
  touchID?: boolean;
  showModal?: boolean;
  kSecUseOperationPrompt?: string;
  kLocalizedFallbackTitle?: string;
  strings?: RNSensitiveInfoAndroidDialogStrings;
}

export declare function setItem(
  key: string,
  value: string,
  options: RNSensitiveInfoOptions
): Promise<null>;
export declare function getItem(
  key: string,
  options: RNSensitiveInfoOptions
): Promise<string>;

interface SensitiveInfoEntry {
  key: string
  value: string
  service: string
}
export declare function getAllItems(
  options: RNSensitiveInfoOptions
): Promise<[SensitiveInfoEntry[]]>;

export declare function deleteItem(
  key: string,
  options: RNSensitiveInfoOptions
): Promise<null>;
export declare function isSensorAvailable(): Promise<
  RNSensitiveInfoBiometryType | boolean
>;
export declare function isHardwareDetected(): Promise<boolean>;
export declare function hasEnrolledFingerprints(): Promise<boolean>;
export declare function cancelFingerprintAuth(): void;
export declare function setInvalidatedByBiometricEnrollment(set: boolean): void;
