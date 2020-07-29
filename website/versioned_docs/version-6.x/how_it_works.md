---
id: how_it_works
title: How it works
sidebar_label: How it works
---

Supposing you need to save an authentication token in user's device using [RNSInfo.setItem](setItem):

* Android: RNSInfo will automatically encrypt the token using keystore and save it into shared preferences. If you want you will be able to add an extra layer of security by requesting user's fingerprint to unlock the encrypted data. Check out our recipe [here](protectingWithFingerprint)

* iOS: RNSInfo will automatically save your data into user's keychain which is handled by OS. You can also add an extra layer of security by requesting user's fingerprint or faceID to unlock the encrypted data. Check out our recipe [here](protectingWithFingerprint)