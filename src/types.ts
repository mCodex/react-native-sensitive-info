/**
 * Known biometric types returned by `isSensorAvailable`.
 */
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

/**
 * Customisable strings for the Android biometric modal when `showModal` is enabled.
 */
export interface RNSensitiveInfoAndroidDialogStrings {
  readonly header?: string;
  readonly description?: string;
  readonly hint?: string;
  readonly success?: string;
  readonly notRecognized?: string;
  readonly cancel?: string;
  readonly cancelled?: string;
}

/**
 * Cross-platform configuration options for the sensitive info APIs.
 * Field names mirror previous versions to avoid breaking changes.
 */
export type RNSensitiveInfoOptions = Readonly<{
  /** iOS: Access control policy applied to Keychain items when `touchID` is true. */
  readonly kSecAccessControl?: RNSensitiveInfoAccessControlOptions;
  /** iOS: Custom accessibility level, defaults to `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`. */
  readonly kSecAttrAccessible?: RNSensitiveInfoAttrAccessibleOptions;
  /** iOS: Whether the keychain item should sync via iCloud keychain. */
  readonly kSecAttrSynchronizable?: boolean;
  /** iOS: Namespaced keychain service. Defaults to `app`. */
  readonly keychainService?: string;
  /** Android: Name for the backing SharedPreferences file. Defaults to `shared_preferences`. */
  readonly sharedPreferencesName?: string;
  /** Toggle biometric guarded storage. Maps to Touch/Face ID on iOS and BiometricPrompt on Android. */
  readonly touchID?: boolean;
  /** Android: Show platform modal instead of emitting events when authenticating. */
  readonly showModal?: boolean;
  /** iOS: Custom message shown in the biometric prompt. */
  readonly kSecUseOperationPrompt?: string;
  /** iOS: Custom fallback button label when policy allows password fallback. */
  readonly kLocalizedFallbackTitle?: string;
  /** Android: Custom strings for the biometric modal. */
  readonly strings?: Readonly<RNSensitiveInfoAndroidDialogStrings>;
}>;

/**
 * Entry returned by `getAllItems`.
 */
export interface SensitiveInfoEntry {
  readonly key: string;
  readonly value: string;
  readonly service: string;
}

/**
 * Convenience alias describing the aggregated result set from `getAllItems`.
 */
export type SensitiveInfoEntries = ReadonlyArray<SensitiveInfoEntry>;
