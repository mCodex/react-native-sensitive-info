# Introduction

This module will get all information stored in shared preferences. To do so:

# Install

Install `react-native-get-shared-prefs` using: 

``npm i -S react-native-get-shared-prefs``

# How to use?

Here is a simple example:

```javascript
import SharedPrefs from 'react-native-get-shared-prefs';

SharedPrefs.getSharedPrefs(function(result){

    console.log(result); //It will display your data from Shared Preferences
    
});
```
