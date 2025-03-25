import { NativeModules } from 'react-native';

var RNSensitiveInfo = NativeModules.RNSensitiveInfo;
RNSensitiveInfo.setInvalidatedByBiometricEnrollment = function (invalidatedByBiometricEnrollment) {
    if (RNSensitiveInfo.setInvalidatedByBiometricEnrollment == null) {
        return undefined;
    }
    return RNSensitiveInfo.setInvalidatedByBiometricEnrollment(invalidatedByBiometricEnrollment);
};
RNSensitiveInfo.cancelFingerprintAuth = function () {
    if (RNSensitiveInfo.cancelFingerprintAuth == null) {
        return undefined;
    }
    return RNSensitiveInfo.cancelFingerprintAuth();
};

export { RNSensitiveInfo as default };
//# sourceMappingURL=index.es.js.map
