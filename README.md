# Introduction

This module was produced by ClassApp Team and will be improved in future updates. `react-native-sensitive-info` manage all data stored in Android shared preferences. You can grab, set and get all keys/values using only one line of code.

# Install

Install `react-native-sensitive-info` using:

``npm i -S react-native-sensitive-info``

After that, you should link `react-native-sensitive-info` in your project, to do so:

`rnpm link react-native-sensitive-info`

or

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
import br.com.classapp.RNGetSInfo.RNSensitiveInfoPackage; //<- You must import this

protected List<ReactPackage> getPackages() {
    return Arrays.<ReactPackage>asList(
        new MainReactPackage(),
        new RNSensitiveInfoPackage(), // <- Add this line
    );
}
```

Sync gradle and go :)

#Methods

`setPrefs(key, value)`: You can insert data into shared preferences using this method.

`getPrefs('key').then(function(result){});)`: This promise will get value from given key.

`getAllPrefs(Callback)`: Will retrieve all keys and values from Shared Preferences

# How to use?

Here is a simple example:

```javascript
import SInfo from 'react-native-sensitive-info';

SInfo.setPrefs('key1', 'value1');
SInfo.setPrefs('key2', 'value2');
SInfo.setPrefs('key3', 'value3');
SInfo.setPrefs('key4', 'value4');
SInfo.setPrefs('key5', 'value5');

SInfo.getKey('key1').then(function(data) {
  console.log(data);
});

SInfo.getAllPrefs(function(result){
  console.log(result);
});
```

# Future Works

  * Add support for iOS's keychain
  * Add support for Android's keystore
