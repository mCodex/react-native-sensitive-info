import NativeSensitiveInfo from './NativeSensitiveInfo';
import type { SensitiveInfoOptions, Spec } from './NativeSensitiveInfoSpec';
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

/**
 * Normalises consumer provided options and maps them into the TurboModule-friendly shape.
 */
function toNativeOptions(
  options?: RNSensitiveInfoOptions
): SensitiveInfoOptions {
  const normalized = withDefaultOptions(options);
  const { kSecAttrSynchronizable, ...rest } = normalized;
  const prepared: Record<string, unknown> = { ...rest };

  const mapped = mapSynchronizableValue(kSecAttrSynchronizable);
  if (mapped !== undefined) {
    prepared.kSecAttrSynchronizable = mapped;
  }

  return prepared as SensitiveInfoOptions;
}

/** Maps the JS-friendly synchronizable options into the string literal set that codegen accepts. */
function mapSynchronizableValue(
  value: RNSensitiveInfoOptions['kSecAttrSynchronizable']
): SensitiveInfoOptions['kSecAttrSynchronizable'] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (value === true || value === 'enabled') {
    return 'enabled';
  }

  if (value === false || value === 'disabled') {
    return 'disabled';
  }

  if (value === 'kSecAttrSynchronizableAny' || value === 'any') {
    return 'any';
  }

  return undefined;
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
  const module = NativeSensitiveInfo as Partial<Spec>;
  const method = module.setInvalidatedByBiometricEnrollment;

  if (typeof method !== 'function') {
    if (__DEV__) {
      // Helpful reminder during development that the host platform does not expose the feature.
      // Common scenarios: running on Android or using an older native build without the new method.

      console.warn(
        '[react-native-sensitive-info] setInvalidatedByBiometricEnrollment is not available on this platform. ' +
          'The call is being ignored.'
      );
    }
    return;
  }

  method.call(module, set);
}

export type {
  RNSensitiveInfoOptions,
  RNSensitiveInfoBiometryType,
  SensitiveInfoEntry,
  SensitiveInfoEntries,
};
