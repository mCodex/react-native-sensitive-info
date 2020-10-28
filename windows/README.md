# react-native-sensitive-info Windows Implementation

## Module Installation
This module features a C# implementation supporting react-native-windows 0.62 and a C++ implementation supporting all versions since react-native-windows 0.61.

You can either use autolinking on react-native-windows 0.63 and later with the C++ implementation or manually link the module on earlier releases or when using C# version.

The C++ implementation is based on C# implementation by [Tero Paananen](https://github.com/tero-paananen).

### Automatic install with autolinking on RNW >= 0.63
RNSensitiveInfoCPP supports autolinking. Just call: `npm i react-native-sensitive-info --save`

### Manual installation using C++ on RNW >= 0.62
1. `npm install react-native-sensitive-info --save`
2. Open your solution in Visual Studio 2019 (eg. `windows\yourapp.sln`)
3. Right-click Solution icon in Solution Explorer > Add > Existing Project...
4. Add `node_modules\react-native-sensitive-info\windows\RNSensitiveInfoCPP\RNSensitiveInfoCPP.vcxproj`
5. Right-click main application project > Add > Reference...
6. Select `RNSensitiveInfoCPP` in Solution Projects
7. In app `pch.h` add `#include "winrt/RNSensitiveInfoCPP.h"`
8. In `App.cpp` add `PackageProviders().Append(winrt::RNSensitiveInfoCPP::ReactPackageProvider());` before `InitializeComponent();`

### Manual installation using C++ on RNW 0.61
Do the same steps as for 0.62, but use `node_modules\RNSensitiveInfoCPP\windows\RNSensitiveInfoCPP61\RNSensitiveInfoCPP.vcxproj` in step 4.

### Manual installation using C# on RNW 0.62
See [the Installation guide](https://mcodex.dev/react-native-sensitive-info/docs/installation).

## Module development in C++

If you want to contribute to this module Windows implementation, first you must install the [Windows Development Dependencies](https://aka.ms/rnw-deps).

You must temporarily install the `react-native-windows` package. Versions of `react-native-windows` and `react-native` must match, e.g. if the module uses `react-native@0.62`, install `npm i react-native-windows@^0.62 --dev`.

Now, you will be able to open corresponding `RNSensitiveInfoCPP...sln` file, e.g. `RNSensitiveInfoCPP62.sln` for `react-native-windows@0.62`.
