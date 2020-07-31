import { NativeModules } from 'react-native';

const { RNSensitiveInfo } = NativeModules;

export default {
  ...RNSensitiveInfo,
  // setInvalidatedByBiometricEnrollment(
  //   invalidatedByBiometricEnrollment
  // ): Function {
  //   if (RNSensitiveInfo.setInvalidatedByBiometricEnrollment == null) {
  //     return;
  //   }

  //   return RNSensitiveInfo.setInvalidatedByBiometricEnrollment(
  //     invalidatedByBiometricEnrollment
  //   );
  // },
  // cancelFingerprintAuth() {
  //   if (RNSensitiveInfo.cancelFingerprintAuth == null) {
  //     return;
  //   }

  //   return RNSensitiveInfo.cancelFingerprintAuth();
  // },
};
