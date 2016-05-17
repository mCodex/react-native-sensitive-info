# Introduction

This module was produced by ClassApp Team and will be improved in future updates. `react-native-get-shared-prefs` gets all information stored in Android shared preferences.

# Install

Install `react-native-get-shared-prefs` using:

``npm i -S react-native-get-shared-prefs``

After that, you should link `react-native-get-shared-prefs` in your project, to do so:

`rnpm link react-native-get-shared-prefs`

or

Go to `settings.gradle` inside your android project folder and paste this lines there:
```java
include ':react-native-get-shared-prefs'
project(':react-native-get-shared-prefs').projectDir = new File(rootProject.projectDir, '../node_modules/react-native-get-shared-prefs/android')
```

and paste it into `build.gradle`:

```java
compile project(':react-native-get-shared-prefs')
```

In your `MainActivity.java` add:
```java
import br.com.classapp.RNGetSharedPrefs.RNGetSharedPrefsPackage; //<- You must import this

protected List<ReactPackage> getPackages() {
    return Arrays.<ReactPackage>asList(
        new MainReactPackage(),
        new RNGetSharedPrefsPackage(), // <- Add this line
    );
}
```

Sync gradle and go :)

# How to use?

Here is a simple example:

```javascript
import SharedPrefs from 'react-native-get-shared-prefs';

SharedPrefs.getSharedPrefs(function(result){
    //result = { 'key1':'value1', 'key2': 'value2', 'key3': 'value3'}

    console.log(result); //It will display your data from Shared Preferences

});
```

Here is an output example:

![example](https://github.com/classapp/react-native-get-shared-prefs/example.png "Result Example")

# Future Works

  * Add more features
