---
id: protectingWithFingerprint
title: Fingerprint Protection 
sidebar_label: Fingerprint Protection
---

You can easily protect stored data and unlocking it using fingerprint on Android, TouchID or FaceID on iOS.

## Prerequisites


### Android

You need to add these permissions into your Android's manifest file:

```xml
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
<uses-permission android:name="android.permission.USE_FINGERPRINT" />
```

### iOS

You need to add this permission into `Info.plist`:

```xml
<key>NSFaceIDUsageDescription</key>
<string>ADD_WHY_YOU_NEED_FACEID_PERMISSION</string>
```

## Saving

Before you proceed is important to check if user's device has any kind of sensors available.

```javascript
import SInfo from 'react-native-sensitive-info';

// To check if any sensor is available on iOS/Android
const hasAnySensors = await SInfo.isSensorAvailable();

// on Android you can check if has any fingersprints enrolled
const hasAnyFingerprintsEnrolled = await SInfo.hasEnrolledFingerprints();
```

After checking those infos, you need to pass a few options into setItem's method:

```javascript
import SInfo from 'react-native-sensitive-info';

const savingFirstData = await SInfo.setItem('key1', 'value1', {
    sharedPreferencesName: 'mySharedPrefs',
    keychainService: 'myKeychain',
    touchId: true, //add this key
    kSecAccessControl: 'kSecAccessControlBiometryAny' // optional - Add support for FaceID
});
```

Setting `touchId: true` will store and protect your data by requiring to unlock using fingerprint or FaceID

## Getting

To get protected data from user's device you just do:

```javascript
import SInfo from 'react-native-sensitive-info';

const protectedData = await SInfo.getItem('key1', {
    touchID: true,
    showModal: true, //required (Android) - Will prompt user's fingerprint on Android
    strings: { // optional (Android) - You can personalize your prompt
        description: 'Custom Title ',
        header: 'Custom Description',
    },
    kSecUseOperationPrompt: // required (iOS) -  A fallback string for iOS
        'We need your permission to retrieve encrypted data',
});
```