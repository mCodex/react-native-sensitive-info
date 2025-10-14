import NativeSensitiveInfo from './NativeSensitiveInfo';
import type {
  RNSensitiveInfoOptions,
  RNSensitiveInfoBiometryType,
  SensitiveInfoEntry,
} from './types';

function withDefaultOptions(
  options?: RNSensitiveInfoOptions
): RNSensitiveInfoOptions {
  return options ?? {};
}

export function setItem(
  key: string,
  value: string,
  options?: RNSensitiveInfoOptions
): Promise<null> {
  return NativeSensitiveInfo.setItem(key, value, withDefaultOptions(options));
}

export function getItem(
  key: string,
  options?: RNSensitiveInfoOptions
): Promise<string | null> {
  return NativeSensitiveInfo.getItem(key, withDefaultOptions(options));
}

export function hasItem(
  key: string,
  options?: RNSensitiveInfoOptions
): Promise<boolean> {
  return NativeSensitiveInfo.hasItem(key, withDefaultOptions(options));
}

export function getAllItems(
  options?: RNSensitiveInfoOptions
): Promise<SensitiveInfoEntry[]> {
  return NativeSensitiveInfo.getAllItems(withDefaultOptions(options));
}

export function deleteItem(
  key: string,
  options?: RNSensitiveInfoOptions
): Promise<null> {
  return NativeSensitiveInfo.deleteItem(key, withDefaultOptions(options));
}

export function isSensorAvailable(): Promise<
  RNSensitiveInfoBiometryType | boolean
> {
  return NativeSensitiveInfo.isSensorAvailable();
}

export function hasEnrolledFingerprints(): Promise<boolean> {
  return NativeSensitiveInfo.hasEnrolledFingerprints();
}

export function cancelFingerprintAuth(): void {
  NativeSensitiveInfo.cancelFingerprintAuth();
}

export function setInvalidatedByBiometricEnrollment(set: boolean): void {
  NativeSensitiveInfo.setInvalidatedByBiometricEnrollment(set);
}

export type {
  RNSensitiveInfoOptions,
  RNSensitiveInfoBiometryType,
  SensitiveInfoEntry,
};
