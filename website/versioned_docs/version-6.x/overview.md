---
id: overview
title: Overview
sidebar_label: Overview
---

RNSInfo is an open-source library developed by many contributors since 2016. ❤️

Securing sensitive data is very important in production-ready applications. So, this is why RNSInfo was created for, to help you focus in what matters most, your application. 😉

Handling sensitive data couldn't be easier in React-Native apps. 

## v6.x

Below you can find the new incoming features from v6.x

### BREAKING CHANGES:

* This version uses by default **keystore to encrypt/decrypt data** on Android. So, if you use the master branch in your project you may not be able to retrieve previous saved data. We still need more work to handle this. The discussion can be found [here](https://github.com/mCodex/react-native-sensitive-info/issues/196). On the other hand, if you already use keystore branch you can give it a try.

* In addiction to that the method `isHardwareDetected` was removed due to `isSensorAvailable`

### More changes

- [x] Finally added keystore to encrypt/decrypt data before saving/retrieving in sharedPreferences 🎉
- [x] Migrating JS code to TS
- [x] Added Android's  Biometric Prompt for supported devices
- [x] **If you were using keystore's branch:** Added many bug fixes and improvements which were available only in master's branch


## Demo

```js
import SInfo from 'react-native-sensitive-info';

const savingFirstData = await SInfo.setItem('key1', 'value1', {
    sharedPreferencesName: 'mySharedPrefs',
    keychainService: 'myKeychain'
});

console.log(savingFirstData) //value1

// Need to retrieve later?

const gettingFirstData = await SInfo.getItem('key1', {
    sharedPreferencesName: 'mySharedPrefs',
    keychainService: 'myKeychain'
});

console.log(gettingFirstData) //value1

//Need to get all values stored?

const gettingAllKeys = await SInfo.getAllItems({
    sharedPreferencesName: 'mySharedPrefs',
    keychainService: 'myKeychain'}
);

console.log(gettingAllKeys) //value1

```