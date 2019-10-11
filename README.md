# React Native Sensitive Info

[![npm version](https://badge.fury.io/js/react-native-sensitive-info.svg)](https://badge.fury.io/js/react-native-sensitive-info)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Open Source Love](https://badges.frapsoft.com/os/v2/open-source.png?v=103)](https://github.com/ellerbrock/open-source-badges/)

`react-native-sensitive-info` manages all data stored in Android Shared Preferences, iOS Keychain and Windows Credentials. You can set and get all key/value using simple methods.


# Help Wanted

Hi 👋! It's been 3 years since I released RNSensitiveInfo's first version only to fix a problem that I was facing at that moment. I was starting my career as JS Developer and RNSensitiveInfo helped me a lot through my learning path. Unfortunately, I don't have too much time as I wanted to, to support by myself this awesome library that we've built so far. So, I'm looking for developers who could help during this journey... We have so many pending issues, features, security improvements, unity/integration tests that could be done... I'm still willing to help and take care of releasing it.

Feel free to contact me,

Best Regards!

# Install

Install `react-native-sensitive-info` using:

``npm i -S react-native-sensitive-info`` or ``yarn add react-native-sensitive-info``

## Linking project

### Automatically

`react-native link react-native-sensitive-info`

### Manually

#### iOS

If you are using Cocoapods add the following line to your Podfile:
```ruby
pod 'react-native-sensitive-info', path: "../node_modules/react-native-sensitive-info"
```

otherwise follow those steps:

In XCode, in the project navigator:

* Right click Libraries
* Add Files to [your project's name]
* Go to node_modules/react-native-sensitive-info
* Add the .xcodeproj file

In XCode, in the project navigator, select your project.

* Add the libRNSensitiveInfo.a from the RNSensitiveInfo project to your project's Build Phases ➜ Link Binary With Libraries
* Click .xcodeproj file you added before in the project navigator and go the Build Settings tab. Make sure 'All' is toggled on (instead of 'Basic').
* Look for Header Search Paths and make sure it contains both $(SRCROOT)/../react-native/React and $(SRCROOT)/../../React - mark both as recursive. (Should be OK by default.)

Run your project (Cmd+R)

#### macos (https://github.com/ptmt/react-native-macos)

Same steps as iOS but change the Base SDK to macOS in Libraries/RNSensitiveInfo.xcodeproj.

#### Android

Go to `settings.gradle` inside your android project folder and paste this lines there:

```java
include ':react-native-sensitive-info'

project(':react-native-sensitive-info').projectDir = new File(rootProject.projectDir, '../node_modules/react-native-sensitive-info/android')
```

and paste it into `build.gradle`:

```java
compile project(':react-native-sensitive-info')
```

In your `MainApplication.java` add:
```java
import br.com.classapp.RNSensitiveInfo.RNSensitiveInfoPackage; //<- You must import this

protected List<ReactPackage> getPackages() {
    return Arrays.<ReactPackage>asList(
        new MainReactPackage(),
        new RNSensitiveInfoPackage(), // <- Add this line
    );
}
```

Sync gradle and go :)

#### Windows

* Open the solution in Visual Studio for your Windows apps.

* Right click your in the Explorer and click Add > Existing Project....

* Navigate to ./<app-name>/node_modules/react-native-sensitive-info/windows/RNSensitiveInfo/RNSensitiveInfo/ and add RNSensitiveInfo.csproj.

* Right click on your React Native Windows app under your solutions directory and click Add > Reference....

* Check the RNSensitiveInfo you just added and press Ok

* Open MainPage.cs in your app

```
using RNSqlite2;

get
  {
      return new List<IReactPackage>
      {
          new MainReactPackage(),
          new RNSensitiveInfoPackage(),
      };
  }
```


### Expo

As noted by by [@Palisand](https://github.com/Palisand) in [this issue](https://github.com/mCodex/react-native-sensitive-info/issues/50#issuecomment-334583668), it's not possible to use this module with Expo, unless your project is detached. The same is true for any modules with native code, it's not an issue with `react-native-sensitive-info`. You may want to try [SecureStore](https://docs.expo.io/versions/latest/sdk/securestore.html) from Expo itself.

# Methods

We unified our library's methods to bring more efficiency and simplify the usability for other developers. We hope that you enjoy it. :)

`isHardwareDetected()`: resolves to a boolean that indicates the detection of fingerprint hardware

`hasEnrolledFingerprints()`: resolves to a boolean that indicates the enrollment status of fingerprints on the device

`isSensorAvailable`: resolves to a boolean that indicates the overall availability of fingerprint sensor (a combination of the previous two methods)

`setItem(key, value, options)`: You can insert data into shared preferences & keychain using this promise method.

`getItem(key, options)`: This promise will get value from given key.

`deleteItem(key, options)`: It will delete value from given key

`getAllItems(options)`: Will retrieve all keys and values from Shared Preferences & Keychain

"Options" is a new parameter (optional) that you can pass to our methods. But what does it do? Now, you can select which keychain's service (iOS) and shared preferences's name (android) you can use. To do so:

```javascript
SInfo.setItem('key1', 'value1', {
sharedPreferencesName: 'mySharedPrefs',
keychainService: 'myKeychain'});
```

But if you prefer to not use it, our default sharedPreferencesName is: **shared_preferences** and keychainService is: **app**. For that, use:

```javascript
SInfo.setItem('key1', 'value1', {});
```

If you used Android's getDefaultSharedPreferences in your project the shared preference's name that you are looking for is: **com.mypackage.MyApp_preferences**. On the other hand if you used iOS's Keychain the default service is: **app** which is our default too.

### Android Specific Options

#### showModal & strings

When passing in `touchID` and `showModal` (Android only) options as `true`, an Android native prompt will show up asking for user's authentication. This behavior is similar to that of iOS.

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

#### setInvalidatedByBiometricEnrollment

If you want to control the behaviour on android when new Fingers are enrolled or removed on the device [https://developer.android.com/reference/android/security/keystore/KeyGenParameterSpec.Builder#setInvalidatedByBiometricEnrollment(boolean)](https://developer.android.com/reference/android/security/keystore/KeyGenParameterSpec.Builder#setInvalidatedByBiometricEnrollment(boolean)) on any device with API level greater than 24 (`Android version >= N`). You should call during the initialization of your app to the function `setInvalidatedByBiometricEnrollment`.
This will re-initialise the internal android Key generator with the flag set to keep/invalidate the credentials upon fingers change.

```javascript
    import SInfo from 'react-native-sensitive-info';

    SInfo.setInvalidatedByBiometricEnrollment(false);
```
If you do not call to this function the default value is set to `true`.

### iOS Specific Options

#### kSecAccessControl

When passing in the `touchID` option as `true`, you can also set `kSecAccessControl`. For example:

```javascript
SInfo.setItem('key1', 'value1', {
  keychainService: 'myKeychain',
  kSecAccessControl: 'kSecAccessControlTouchIDCurrentSet',
  sharedPreferencesName: 'mySharedPrefs',
  touchID: true,
});
```

Note: By default `kSecAccessControl` will get set to `kSecAccessControlUserPresence`.

### Enable Face ID 

To enable Face ID, for iOS X and above or iPad Pro, set `kSecAccessControl` to `kSecAccessControlBiometryAny`.  For example:
```javascript
SInfo.setItem('key1', 'value1', {
  keychainService: 'myKeychain',
  kSecAccessControl: 'kSecAccessControlBiometryAny',
  ...
});
```

Note: This will require a string for the prompt that you have to set the key `NSFaceIDUsageDescription` in your App's Info.plist file. The string value of this key will be added to the Face ID prompt. You can read more about it in the [Apple Docs]("https://developer.apple.com/documentation/localauthentication/logging_a_user_into_your_app_with_face_id_or_touch_id")

#### kSecAttrSynchronizable

You can set this to `true` in order to sync the keychain items with iCloud.

Note: By default `kSecAttrSynchronizable` will get set to `false`.

#### kLocalizedFallbackTitle

You can set this to a string and fallback to pin code authentication.


# How to use?

Here is a simple example:

```javascript
import SInfo from 'react-native-sensitive-info';

SInfo.setItem('key1', 'value1', {
sharedPreferencesName: 'mySharedPrefs',
keychainService: 'myKeychain'
}).then((value) =>
        console.log(value) //value 1
);

SInfo.setItem('key2', 'value2', {});

SInfo.getItem('key1', {
sharedPreferencesName: 'mySharedPrefs',
keychainService: 'myKeychain'}).then(value => {
    console.log(value) //value1
});

SInfo.getItem('key2',{}).then(value => {
    console.log(value) //value2
});

SInfo.getAllItems({
sharedPreferencesName: 'mySharedPrefs',
keychainService: 'myKeychain'}).then(values => {
    console.log(values) //value1, value2
});
```

# Protect your item with fingerprint
As jailbroken device can access your iOS Keychain/ Android shared preference and key store in plain text, it is necessary to add another layer of protection so even jailbreaking won't leak your data (like refresh_token or bank account password).
- for iOS it is implemented though [Access Control](https://developer.apple.com/documentation/security/secaccesscontrol). Everytime when app wants to access the protected keychain item, a prompt by iOS will show up. Only when authentication success will the app get the keychain item.
- for Android it is implemented though [FingerprintManager](https://developer.android.com/reference/android/hardware/fingerprint/FingerprintManager.html) + Keystore. Keystore has a function called `setUserAuthenticationRequired` which makes Keystore requires user authentication before getting value. However Android doesn't nicely user to scan their finger, it just throws error. Here is where FingerprintManager comes in. However (AGAIN) FingerprintManager doesn't show prompt for you, so you need to build UI yourself to let user to know that it is time to scan fingerprint.

**The example in the repo shows how to use this feature and how to build some Android UI based on callbacks.**

**NOTE: fingerprint will only work with Android 6.0 and above.**

HELP NEEDED: It will be nice if someone can build an Android native prompt to make Android touch as easy to use as iOS. Maybe we can borrow some code from [google's example](https://github.com/googlesamples/android-FingerprintDialog)

# Use with redux-persist

If you would like to use [redux-persist](https://github.com/rt2zz/redux-persist) to store information from your Redux state into secure storage, you can use [redux-persist-sensitive-storage](https://github.com/CodingZeal/redux-persist-sensitive-storage), which provides a custom storage back-end for redux-persist that uses react-native-sensitive-info.

# Contributing

Pull requests are always welcome :)
