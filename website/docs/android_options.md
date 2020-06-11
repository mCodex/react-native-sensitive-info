---
id: android_options
title: Android
sidebar_label: Android
---

Android specific configurations

## showModal & strings

When `showModal` is `true`, an Android native prompt will show up asking for user's authentication. This behavior is similar to that of iOS.

You can control strings associated with a modal prompt via `strings` option:

```javascript
strings: {
    header: 'Sign in',
    description: 'Place finger to authenticate',
    hint: 'Touch',
    success: 'Fingerprint recognized',
    notRecognized: 'Fingerprint not recognized, try again',
    cancel: 'Cancel',
    cancelled: 'Authentication was cancelled', // reject error message
}
```

## setInvalidatedByBiometricEnrollment

If you want to control the behaviour on android when new fingers are enrolled or removed on the device on any device with API level greater than 24. You should call during the initialization of your app to the function `setInvalidatedByBiometricEnrollment`. This will re-initialise the internal android Key generator with the flag set to keep/invalidate the credentials upon fingers change.

```javascript
import SInfo from 'react-native-sensitive-info';

SInfo.setInvalidatedByBiometricEnrollment(false);
```

[You can check out more here](https://developer.android.com/reference/android/security/keystore/KeyGenParameterSpec.Builder#setInvalidatedByBiometricEnrollment(boolean))