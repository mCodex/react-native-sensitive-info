---
id: installation
title: Installation
sidebar_label: Installation
---

First of all, install it using `npm` or `yarn`

```bash
npm install react-native-sensitive-info@next
```

```bash
yarn add react-native-sensitive-info@next
```

## Linking

### React-Native >= 0.60

#### iOS

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

#### Windows with react-native-windows >= 0.63

The C++ module should be automatically linked when you run:

```
yarn windows
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
import dev.mcodex.RNSensitiveInfo.RNSensitiveInfoPackage; //<- You must import this

protected List<ReactPackage> getPackages() {
    return Arrays.<ReactPackage>asList(
        new MainReactPackage(),
        new RNSensitiveInfoPackage(), // <- Add this line
    );
}
```

#### Windows using C++ on RNW >= 0.62

* `npm install react-native-sensitive-info --save`
* Open your solution in Visual Studio 2019 (eg. `windows\yourapp.sln`)
* Right-click Solution icon in Solution Explorer > Add > Existing Project...
* Add `node_modules\react-native-sensitive-info\windows\RNSensitiveInfoCPP\RNSensitiveInfoCPP.vcxproj`
* Right-click main application project > Add > Reference...
* Select `RNSensitiveInfoCPP` in Solution Projects
* In app `pch.h` add `#include "winrt/RNSensitiveInfoCPP.h"`
* In `App.cpp` add `PackageProviders().Append(winrt::RNSensitiveInfoCPP::ReactPackageProvider());` before `InitializeComponent();`

#### Windows using C++ on RNW 0.61

Do the same steps as for 0.62, but use `node_modules\RNSensitiveInfoCPP\windows\RNSensitiveInfoCPP61\RNSensitiveInfoCPP.vcxproj` in the 4th step.

##### Windows C# Module

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
