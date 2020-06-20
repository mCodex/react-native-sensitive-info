---
id: hasEnrolledFingerprints
title: hasEnrolledFingerprints
sidebar_label: hasEnrolledFingerprints
---

Checks the enrollment status of fingerprints on the device. It will return `true` if detected otherwise returns `false`

```javascript
hasEnrolledFingerprints(): Promise<boolean>
```

Example:

```javascript
import RNSInfo from 'react-native-sensitive-info';

SINFo.hasEnrolledFingerprints();
```