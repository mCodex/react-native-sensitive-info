#React Native Sensitive Info

[![npm version](https://badge.fury.io/js/react-native-sensitive-info.svg)](https://badge.fury.io/js/react-native-sensitive-info)

This module is the next generation of [react-native-get-shared-prefs](https://www.npmjs.com/package/react-native-get-shared-prefs).

# Introduction

`react-native-sensitive-info` manages all data stored in Android Shared Preferences and iOS Keychain. You can set and get all key/value using simple methods.

# Install

Install `react-native-sensitive-info` using:

``npm i -S react-native-sensitive-info``

## Linking project

### Automatically

`rnpm link react-native-sensitive-info`

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

In your `MainActivity.java` add:
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

##Versions < 2.2.0

###Android & iOS

`setItem('key', 'value')`: You can insert data into shared preferences/keychain using this method.

`getItem('key').then(function(value){});)`: This promise will get value from given key.

`getAllItems().then(function(result){});)`: Will retrieve all keys and values from Shared Preferences (Only for Android)


##Since version >= 2.2.0

###Android Methods

`setItem('key', 'value')`: You can insert data into shared preferences using this method.

`getItem('key').then(function(result){});)`: This promise will get value from given key.

`getAllItems().then(function(result){});)`: Will retrieve all keys and values from Shared Preferences

###iOS Methods

`setItem('service', 'key', 'value')`: You can insert data into keychain using this method.

`getItem('service', 'key').then(function(result){});)`: This promise will get value from given key.

`getAllItems().then(function(result){});)`: Will retrieve all keys and values from keychain

# How to use?

Here is a simple Android example:

```javascript
import SInfo from 'react-native-sensitive-info';

SInfo.setItem('key1', 'value1');
SInfo.setItem('key2', 'value2');
SInfo.setItem('key3', 'value3');
SInfo.setItem('key4', 'value4');
SInfo.setItem('key5', 'value5');

SInfo.setItem('key1').then(function(data) {
  console.log(data);
});

SInfo.getAllItems(function(result){
  console.log(result);
});
```
#Contributing

Pull requests are welcome :)

# Future Works

  * Add support for Android's keystore
