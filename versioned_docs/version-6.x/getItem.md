---
id: getItem
title: getItem
sidebar_label: getItem
---

Get an item from storage

```javascript
getItem(key, options) : Promise<string>
```

Example:

```javascript
import RNSInfo from 'react-native-sensitive-info';

const myFunc = async () => {
    return RNSInfo.getItem('key1', {
        sharedPreferencesName: 'mySharedPrefs',
        keychainService: 'myKeychain'
    });
}

await myFunc();

// The data is retrieved
```
