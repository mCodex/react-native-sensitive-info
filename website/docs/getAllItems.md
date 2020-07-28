---
id: getAllItems
title: getAllItems
sidebar_label: getAllItems
---

Get all items from storage

```javascript
getAllItems(options) : Promise<[{
  key: string
  value: string
  service: string
}]>
```

Example:

```javascript
import RNSInfo from 'react-native-sensitive-info';

const myFunc = async () => {
    return SInfo.getAllItems({        
        keystoreKey: 'mySharedPrefs',
        keychainService: 'myKeychain'
    });
}

await myFunc();

// The data is retrieved
```