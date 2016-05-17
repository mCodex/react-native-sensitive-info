# Introduction

This module will get all information stored in android shared preferences. To do so:

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

![result example](https://github.com/classapp/react-native-get-shared-prefs/blob/master/example.png "result example")

