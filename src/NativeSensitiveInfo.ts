import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  setItem(key: string, value: string, options: Object): Promise<string>;
  getItem(key: string, options: Object): Promise<string | null>;
  getAllItems(options: Object): Promise<Array<Object>>;
  deleteItem(key: string, options: Object): Promise<void>;
  isSensorAvailable(): Promise<string | boolean>;
  setInvalidatedByBiometricEnrollment?(): void;
  cancelFingerprintAuth?(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNSensitiveInfo');
