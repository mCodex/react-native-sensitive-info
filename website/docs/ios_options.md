---
id: ios_options
title: iOS
sidebar_label: iOS
---

## keychainService

You can choose the keychain's service which you want to use. Otherwise, the default is **app**

## touchID

Enable touchID support.

```javascript
SInfo.setItem('key1', 'value1', {
  ...
  touchID: true,
});

```

## kSecAccessControl

When passing in the [touchID](#touchID) option as `true`, you can also set `kSecAccessControl`. For example:


```javascript
SInfo.setItem('key1', 'value1', {
  keychainService: 'myKeychain',
  kSecAccessControl: 'kSecAccessControlTouchIDCurrentSet',
  sharedPreferencesName: 'mySharedPrefs',
  touchID: true,
});
```

**Note:** By default `kSecAccessControl` will get set to `kSecAccessControlUserPresence`.

## kSecAttrSynchronizable

You can set this to `true` in order to sync the keychain items with iCloud.

**Note:** By default `kSecAttrSynchronizable` will get set to `false`.

## kLocalizedFallbackTitle

You can set this to a string and fallback to pin code authentication.

## Enable Face ID

To enable Face ID, for iOS X and above or iPad Pro, set `kSecAccessControl` to `kSecAccessControlBiometryAny`. For example:

```javascript
SInfo.setItem('key1', 'value1', {
  keychainService: 'myKeychain',
  kSecAccessControl: 'kSecAccessControlBiometryAny',
  ...
});
```