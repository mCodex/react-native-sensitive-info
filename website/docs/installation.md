---
id: installation
title: Installation
sidebar_label: Installation
---

First of all, install it using `npm` or `yarn`

### Master branch (using Keychain and Android Shared Preferences)

```bash
npm install --save react-native-sensitive-info
```

```bash
yarn add react-native-sensitive-info
```

### Keystore branch (using Keychain and Keystore)

```bash
npm install --save git://github.com/mCodex/react-native-sensitive-info#keystore
```

```bash
yarn add git://github.com/mCodex/react-native-sensitive-info#keystore
```

### Next (v6.0.0)

This version includes keystore usage by default. Also, includes many fixes and improvements which were outdated in keystore's branch due to lack of maintenance and only available in master's branch. You can read more [here](https://github.com/mCodex/react-native-sensitive-info/releases/tag/v6.0.0). 

You can install by running:

```bash
npm install --save react-native-sensitive-info@next
```

```bash
yarn add react-native-sensitive-info@next
```

## Linking

### React-Native >= 0.60

#### iOS / MacOS

Should be automatically linked when you run:

```bash
pod install
```

Then:

```bash
yarn ios
```

#### Android

Should be automatically linked when you run:

```bash
yarn android
```

### React-Native < 0.60

#### iOS

##### Using cocoapods

```pod
pod 'react-native-sensitive-info', path: "../node_modules/react-native-sensitive-info"
```

##### Not using cocoapods?

Go to your XCode, in the project navigator:

* Right click Libraries
* Add Files to [your project's name]
* Go to `node_modules/react-native-sensitive-info`
* Add the .xcodeproj file

In XCode, in the project navigator, select your project.

* Add the libRNSensitiveInfo.a from the RNSensitiveInfo project to your project's Build Phases ➜ Link Binary With Libraries
* Click .xcodeproj file you added before in the project navigator and go the Build Settings tab. Make sure `All` is toggled on (instead of 'Basic').
* Look for Header Search Paths and make sure it contains both `$(SRCROOT)/../react-native/React` and `$(SRCROOT)/../../React` - mark both as recursive. (Should be OK by default.)

#### MacOS

Same steps as iOS but change the Base SDK to macOS in **Libraries/RNSensitiveInfo.xcodeproj**.

#### Android

Go to `settings.gradle` inside your android project folder and paste this lines there:

```java
include ':react-native-sensitive-info'

project(':react-native-sensitive-info').projectDir = new File(rootProject.projectDir, '../node_modules/react-native-sensitive-info/android')
```

and paste it into build.gradle:

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
##### Windows

* Open the solution in Visual Studio for your Windows apps.

* Right click your in the Explorer and click Add > Existing Project....

* Navigate to `./node_modules/react-native-sensitive-info/windows/RNSensitiveInfo/RNSensitiveInfo/` and add RNSensitiveInfo.csproj.
* Right click on your React Native Windows app under your solutions directory and click `Add > Reference`....
* Check the RNSensitiveInfo you just added and press Ok
* Open MainPage.cs in your app

```c#
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