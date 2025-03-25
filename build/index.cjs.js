'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var reactNative = require('react-native');

var RNSensitiveInfo = reactNative.NativeModules.RNSensitiveInfo;
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

exports["default"] = RNSensitiveInfo;
//# sourceMappingURL=index.cjs.js.map
