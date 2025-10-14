import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { UnsafeObject } from 'react-native/Libraries/Types/CodegenTypes';

export interface Spec extends TurboModule {
  readonly getConstants: () => UnsafeObject;
  setItem(key: string, value: string, options: UnsafeObject): Promise<null>;
  getItem(key: string, options: UnsafeObject): Promise<string | null>;
  hasItem(key: string, options: UnsafeObject): Promise<boolean>;
  getAllItems(
    options: UnsafeObject
  ): Promise<Array<{ key: string; value: string; service: string }>>;
  deleteItem(key: string, options: UnsafeObject): Promise<null>;
  isSensorAvailable(): Promise<string | boolean>;
  hasEnrolledFingerprints(): Promise<boolean>;
  cancelFingerprintAuth(): void;
  setInvalidatedByBiometricEnrollment(set: boolean): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('SensitiveInfo');
