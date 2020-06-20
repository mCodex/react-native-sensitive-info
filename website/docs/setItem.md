---
id: setItem
title: setItem
sidebar_label: setItem
---

Insert new data into the storage.

```javascript
setItem(key, value, options) : Promise<null>
```

Check out the options that you can use for [Android](android_options) and [iOS](ios_options)

Example:

```javascript
import RNSInfo from 'react-native-sensitive-info';

const myFunc = async () => {
    return SInfo.setItem('key1', 'value1', {
        sharedPreferencesName: 'mySharedPrefs',
        keychainService: 'myKeychain'
    });
}

await myFunc();

// The data is saved
```

### Note

You can choose which keychain's service (iOS) and shared preferences's name (android) you want to use.

But if you rather not to use it our **default** sharedPreferencesName is: **shared_preferences** and keychainService is: **app**. To do so, just use `setItem` like this: 

```javascript
SInfo.setItem('key1', 'value1', {});
```

If you used Android's getDefaultSharedPreferences in your project the shared preference's name that you are looking for is: **com.mypackage.MyApp_preferences**. On the other hand if you used iOS's Keychain the default service is: **app**.