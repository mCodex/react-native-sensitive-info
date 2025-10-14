import type { TurboModule } from 'react-native';
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

import type {
  RNSensitiveInfoOptions,
  RNSensitiveInfoBiometryType,
  SensitiveInfoEntry,
} from './types';

export interface Spec extends TurboModule {
  readonly getConstants: () => Record<string, unknown>;
  setItem(
    key: string,
    value: string,
    options: RNSensitiveInfoOptions
  ): Promise<null>;
  getItem(key: string, options: RNSensitiveInfoOptions): Promise<string | null>;
  hasItem(key: string, options: RNSensitiveInfoOptions): Promise<boolean>;
  getAllItems(options: RNSensitiveInfoOptions): Promise<SensitiveInfoEntry[]>;
  deleteItem(key: string, options: RNSensitiveInfoOptions): Promise<null>;
  isSensorAvailable(): Promise<RNSensitiveInfoBiometryType | boolean>;
  hasEnrolledFingerprints(): Promise<boolean>;
  cancelFingerprintAuth(): void;
  setInvalidatedByBiometricEnrollment(set: boolean): void;
}

declare global {
  var __turboModuleProxy: object | undefined;
}

const isTurboModuleEnabled = globalThis.__turboModuleProxy != null;

const NativeSensitiveInfoModule: Spec = isTurboModuleEnabled
  ? TurboModuleRegistry.getEnforcing<Spec>('SensitiveInfo')
  : (NativeModules.SensitiveInfo as Spec);

if (__DEV__ && Platform.OS === 'android' && NativeModules.SensitiveInfoView) {
  console.warn(
    '[react-native-sensitive-info] Detected legacy SensitiveInfoView export. Please ensure the library is properly linked as a TurboModule.'
  );
}

export default NativeSensitiveInfoModule;
