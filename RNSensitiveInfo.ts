import { NativeModules } from 'react-native';

const { RNSensitiveInfo } = NativeModules;

export const {
  setItem,
  getItem,
  hasItem,
  getAllItems,
  deleteItem,
  isSensorAvailable,
  hasEnrolledFingerprints,
  cancelFingerprintAuth,
  setInvalidatedByBiometricEnrollment,
} = RNSensitiveInfo;

export default RNSensitiveInfo;
