---
id: security
title: Security
sidebar_label: Security
---

Jailbroken/Rooted devices can access your iOS' Keystore and Android's shared preferences/keystore in plain text, so it is necessary to add another layer of protection.

- **iOS:** it is implemented through [Access Control](https://developer.apple.com/documentation/security/secaccesscontrol). Everytime the app wants to access the protected keychain item, a prompt by iOS will show up. Only after authentication success will return the requested item.

- **Android** it is implemented through [FingerprintManager](https://developer.android.com/reference/android/hardware/fingerprint/FingerprintManager.html) + Keystore. Keystore has a function called `setUserAuthenticationRequired` which makes Keystore requires user authentication before getting value. However, Android doesn't nicely asks user to scan their finger, it just throws error this is why FingerprintManager comes in. However (AGAIN), FingerprintManager doesn't prompt automatically for you, so you need to build UI yourself to let user to know that it is time to scan his/her fingerprint.