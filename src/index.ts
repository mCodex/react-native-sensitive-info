import NativeSensitiveInfo from './NativeSensitiveInfo';
import type { UnsafeObject } from 'react-native/Libraries/Types/CodegenTypes';
import type {
  RNSensitiveInfoOptions,
  RNSensitiveInfoBiometryType,
  SensitiveInfoEntry,
  SensitiveInfoEntries,
} from './types';

function withDefaultOptions(
  options?: RNSensitiveInfoOptions
): RNSensitiveInfoOptions {
  return options ?? {};
}

function toNativeOptions(options?: RNSensitiveInfoOptions): UnsafeObject {
  return withDefaultOptions(options) as unknown as UnsafeObject;
}

export function setItem(
  key: string,
  value: string,
  options?: RNSensitiveInfoOptions
): Promise<null> {
  return NativeSensitiveInfo.setItem(key, value, toNativeOptions(options));
}

export function getItem(
  key: string,
  options?: RNSensitiveInfoOptions
): Promise<string | null> {
  return NativeSensitiveInfo.getItem(key, toNativeOptions(options));
}

export function hasItem(
  key: string,
  options?: RNSensitiveInfoOptions
): Promise<boolean> {
  return NativeSensitiveInfo.hasItem(key, toNativeOptions(options));
}

export function getAllItems(
  options?: RNSensitiveInfoOptions
): Promise<SensitiveInfoEntries> {
  return NativeSensitiveInfo.getAllItems(
    toNativeOptions(options)
  ) as Promise<SensitiveInfoEntries>;
}

export function deleteItem(
  key: string,
  options?: RNSensitiveInfoOptions
): Promise<null> {
  return NativeSensitiveInfo.deleteItem(key, toNativeOptions(options));
}

export function isSensorAvailable(): Promise<
  RNSensitiveInfoBiometryType | boolean
> {
  return NativeSensitiveInfo.isSensorAvailable() as Promise<
    RNSensitiveInfoBiometryType | boolean
  >;
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
  SensitiveInfoEntries,
};
