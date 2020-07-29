---
id: overview
title: Overview
sidebar_label: Overview
---

RNSInfo is an open-source library developed by many contributors since 2016. ❤️

Securing sensitive data is very important in production-ready applications. So, this is why RNSInfo was created for, to help you focus in what matters most, your application. 😉

Handling sensitive data couldn't be easier in React-Native apps. 

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