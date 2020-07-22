import {NativeModules} from 'react-native';

const RNSensitiveInfo = NativeModules.RNSensitiveInfo;

module.exports = {
  ...RNSensitiveInfo,
  setInvalidatedByBiometricEnrollment(invalidatedByBiometricEnrollment) {
    if (RNSensitiveInfo.setInvalidatedByBiometricEnrollment == null) {
      return;
    }

    return RNSensitiveInfo.setInvalidatedByBiometricEnrollment(
      invalidatedByBiometricEnrollment,
    );
  },
  cancelFingerprintAuth() {
    if (RNSensitiveInfo.cancelFingerprintAuth == null) {
      return;
    }

    return RNSensitiveInfo.cancelFingerprintAuth();
  },
};
