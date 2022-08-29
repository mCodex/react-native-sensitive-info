---
id: isSensorAvailable
title: isSensorAvailable
sidebar_label: isSensorAvailable
---

Indicates the overall availability of fingerprint sensor. It will resolve to `true` or `false`

```javascript
isSensorAvailable(): Promise<
  "Touch ID" | "Face ID" | boolean
>;
```

Example:

```javascript
import RNSInfo from 'react-native-sensitive-info';

RNSInfo.isSensorAvailable();
```
