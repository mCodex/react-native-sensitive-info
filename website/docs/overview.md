---
id: overview
title: Overview
sidebar_label: Overview
---

RNSInfo is an open-source library developed by many contributors since 2016. ❤️

Securing sensitive data is very important in production-ready applications. So, this is why RNSInfo was created for, to help you focus in what matters most, your application. 😉

Handling sensitive data couldn't be easier in React-Native apps. 

## Demo

```javascript
import SInfo from 'react-native-sensitive-info';

SInfo.setItem('key1', 'value1', {
keystoreKey: 'mySharedPrefs',
keychainService: 'myKeychain'
}).then((value) =>
        console.log(value) //value 1
);

SInfo.setItem('key2', 'value2', {});

SInfo.getItem('key1', {
keystoreKey: 'mySharedPrefs',
keychainService: 'myKeychain'}).then(value => {
    console.log(value) //value1
});

SInfo.getItem('key2',{}).then(value => {
    console.log(value) //value2
});

SInfo.getAllItems({
keystoreKey: 'mySharedPrefs',
keychainService: 'myKeychain'}).then(values => {
    console.log(values) //value1, value2
});
```