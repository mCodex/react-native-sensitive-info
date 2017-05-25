# React Native Sensitive Info

[![npm version](https://badge.fury.io/js/react-native-sensitive-info.svg)](https://badge.fury.io/js/react-native-sensitive-info)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Open Source Love](https://badges.frapsoft.com/os/v2/open-source.png?v=103)](https://github.com/ellerbrock/open-source-badges/)


**react-native-sensitive-info**  is the next generation of [react-native-get-shared-prefs](https://www.npmjs.com/package/react-native-get-shared-prefs).

# Introduction

`react-native-sensitive-info` manages all data stored in Android Shared Preferences and iOS Keychain. You can set and get all key/value using simple methods.


| RN SensitiveInfo Version | Description                      |
|--------------------------|----------------------------------|
| 4.0+                     | Compatible with RN 0.40+         |
| <= 3.0.2                 | Compatible with RN 0.40 or below |

# Install

Install `react-native-sensitive-info` using:

``npm i -S react-native-sensitive-info`` or ``yarn add react-native-sensitive-info``

## Linking project

### Automatically

`react-native link react-native-sensitive-info`

### Manually

#### iOS

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

# Methods

We unified our library's methods to bring more efficiency and simplify the usability for other developers. We hope that you enjoy it. :)

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

If you used Android's getDefaultSharedPreferences in your project the shared preference's name that you are looking for is: **com.mypackage.MyApp_preferences**. In other hands if you used iOS's Keychain the default service is: **app** which is our default too.

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

# Contributing

Pull requests are always welcome :)
