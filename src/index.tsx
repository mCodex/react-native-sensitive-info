import NativeSensitiveInfo from './NativeSensitiveInfo';
import type { SensitiveInfoOptions, Spec } from './NativeSensitiveInfoSpec';
import type {
  RNSensitiveInfoOptions,
  RNSensitiveInfoBiometryType,
  SensitiveInfoEntry,
  SensitiveInfoEntries,
} from './types';

type NativeModule = Spec;

type NativeMethodName = Extract<
  {
    [Key in keyof NativeModule]: NativeModule[Key] extends (
      ...args: any[]
    ) => any
      ? Key
      : never;
  }[keyof NativeModule],
  string
>;

const nativeModule = NativeSensitiveInfo as NativeModule;

const MISSING_METHOD_ERROR =
  '[react-native-sensitive-info] The requested native method is not available. Ensure the native module is linked and the app has been rebuilt.';

function callNative<Method extends NativeMethodName>(
  method: Method,
  ...args: Parameters<NativeModule[Method]>
): ReturnType<NativeModule[Method]> {
  const implementation = nativeModule[method];
  if (typeof implementation !== 'function') {
    throw new Error(`${MISSING_METHOD_ERROR} (method: ${String(method)})`);
  }

  return (
    implementation as (
      ...nativeArgs: Parameters<NativeModule[Method]>
    ) => ReturnType<NativeModule[Method]>
  ).apply(nativeModule, args) as ReturnType<NativeModule[Method]>;
}

function callNativeOptional<Method extends NativeMethodName>(
  method: Method,
  ...args: Parameters<NativeModule[Method]>
): ReturnType<NativeModule[Method]> | undefined {
  const implementation = nativeModule[method];
  if (typeof implementation !== 'function') {
    if (__DEV__) {
      console.warn(
        `[react-native-sensitive-info] Native method '${String(method)}' is not implemented on this platform. The call was ignored.`
      );
    }
    return undefined;
  }

  return (
    implementation as (
      ...nativeArgs: Parameters<NativeModule[Method]>
    ) => ReturnType<NativeModule[Method]>
  ).apply(nativeModule, args) as ReturnType<NativeModule[Method]>;
}

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
  return callNative('setItem', key, value, toNativeOptions(options));
}

export function getItem(
  key: string,
  options?: RNSensitiveInfoOptions
): Promise<string | null> {
  return callNative('getItem', key, toNativeOptions(options));
}

export function hasItem(
  key: string,
  options?: RNSensitiveInfoOptions
): Promise<boolean> {
  return callNative('hasItem', key, toNativeOptions(options));
}

export function getAllItems(
  options?: RNSensitiveInfoOptions
): Promise<SensitiveInfoEntries> {
  return callNative(
    'getAllItems',
    toNativeOptions(options)
  ) as Promise<SensitiveInfoEntries>;
}

export function deleteItem(
  key: string,
  options?: RNSensitiveInfoOptions
): Promise<null> {
  return callNative('deleteItem', key, toNativeOptions(options));
}

export function isSensorAvailable(): Promise<
  RNSensitiveInfoBiometryType | boolean
> {
  return callNative('isSensorAvailable') as Promise<
    RNSensitiveInfoBiometryType | boolean
  >;
}

export function hasEnrolledFingerprints(): Promise<boolean> {
  return callNative('hasEnrolledFingerprints');
}

export function cancelFingerprintAuth(): void {
  callNative('cancelFingerprintAuth');
}

export function setInvalidatedByBiometricEnrollment(set: boolean): void {
  callNativeOptional('setInvalidatedByBiometricEnrollment', set);
}

export type {
  RNSensitiveInfoOptions,
  RNSensitiveInfoBiometryType,
  SensitiveInfoEntry,
  SensitiveInfoEntries,
};

const SensitiveInfo = {
  setItem,
  getItem,
  hasItem,
  getAllItems,
  deleteItem,
  isSensorAvailable,
  hasEnrolledFingerprints,
  cancelFingerprintAuth,
  setInvalidatedByBiometricEnrollment,
};

export default SensitiveInfo;
