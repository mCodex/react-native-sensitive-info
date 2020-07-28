---
id: deleteItem
title: deleteItem
sidebar_label: deleteItem
---

Delete an item from storage

```javascript
deleteItem(key, options) : Promise<null>
```

Example:

```javascript
import RNSInfo from 'react-native-sensitive-info';

const myFunc = async () => {
    return SInfo.deleteItem('key1', {
        keystoreKey: 'mySharedPrefs',
        keychainService: 'myKeychain'
    });
}

await myFunc();

// Data successfully deleted
```