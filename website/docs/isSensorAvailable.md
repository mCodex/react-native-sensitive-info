---
id: isSensorAvailable
title: isSensorAvailable
sidebar_label: isSensorAvailable
---

Indicates the overall availability of fingerprint sensor. It is the same as using **[hasEnrolledFingerprints](./hasEnrolledFingerprints)** and **[isHardwareDetected](./isHardwareDetected)**. It will resolve to `true` or `false`

```
import RNSInfo from 'react-native-sensitive-info';

SINFo.isSensorAvailable();
```