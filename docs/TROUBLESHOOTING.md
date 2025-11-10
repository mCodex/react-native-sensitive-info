# FAQ & Troubleshooting

## Frequently Asked Questions

### What's the difference between v5 and v6?

v6 is powered by Nitro Modules, offering ~3.3× speed improvement and modern security defaults. v5 uses the classic React Native bridge. Both are fully supported, but v6 requires React Native 0.76+.

### Do I need to use hooks?

No! You can use the imperative API (`setItem`, `getItem`, etc.) directly. Hooks are optional and provide reactive state management for UI.

### Can I migrate from v5 to v6?

Yes, v6 is designed to be drop-in compatible with v5. The API is the same, but you benefit from Nitro's speed improvements.

### Is there any data migration needed?

No. Secrets stored in v5 are automatically compatible with v6 on both platforms.

### How do I debug storage issues?

Enable platform-specific logging:
- **iOS**: Xcode → Product → Scheme → Edit Scheme → Run → Environment Variables → Add `OS_LOG_DEFAULT=info`
- **Android**: Android Studio → Logcat → Filter by `com.sensitiveinfo`
- **JavaScript**: Wrap calls in try/catch and log error details

### Can I store large files?

Keychain is optimized for small payloads (<64KB on iOS). For larger files, consider encrypting them separately and storing encryption keys with this library.

### What happens if the device is locked?

Accessing secrets with biometric access control triggers a prompt. With device passcode only, it requires unlocking the device first.

### Can I share secrets between my apps?

**iOS**: Yes, use `keychainGroup` in options (requires Keychain group entitlement).
**Android**: No, Android Keystore is app-specific.

### How do I handle simulator limitations?

Use device capability detection:
```tsx
const caps = await getSupportedSecurityLevels()
if (!caps.secureEnclave) {
  // Use software encryption fallback
}
```

### Can I sync secrets to iCloud?

Yes, on iOS set `iosSynchronizable: true`. Requires iCloud entitlement and user sync enabled.

## Troubleshooting Guide

### Biometric Prompt Never Appears

**Symptom**: `setItem()` or `getItem()` completes without showing a prompt.

**Causes**:
- Device doesn't support requested access control
- Biometric not enrolled (simulator)
- Already authenticated in this session

**Solutions**:
1. Check device capabilities: `await getSupportedSecurityLevels()`
2. Test on a device with biometrics enrolled
3. Clear biometric cache: Restart the app

### "authentication failed" Error

**Symptom**: Native error `authentication failed` when using biometric access control.

**Causes**:
- User declined biometric prompt
- Biometric enrollment changed
- Device locked

**Solutions**:
1. Catch `AuthenticationCanceled` error specifically (user declined)
2. Fall back to `devicePasscode` access control
3. Test on physical device with biometrics

### Undefined Symbol on iOS

**Symptom**: Build error: `Undefined symbol: _objc_...`

**Causes**:
- Pods not installed after upgrading
- Nitro module missing from linked frameworks

**Solutions**:
1. Run `cd ios && pod install` from project root
2. Clean build folder: Cmd+Shift+K
3. Rebuild: Cmd+B

### Android Build Errors

**Symptom**: `Could not resolve all artifacts`, `Gradle sync failed`

**Causes**:
- Missing Kotlin plugin
- Hilt configuration missing
- Android SDK version mismatch

**Solutions**:
1. Ensure `com.sensitiveinfo` module is included in build
2. Run `./gradlew clean && ./gradlew build` from android folder
3. Check Android SDK version in `build.gradle`

### Windows Build Error

**Symptom**: `RNSI does not support Windows`

**Causes**:
- Running on v6 (Windows support dropped)

**Solutions**:
- Migrate to v5.5.x if Windows support needed
- Use a different secure storage solution
- File an issue to discuss alternatives

### Storage Unavailable Error

**Symptom**: Error `StorageUnavailable` on all operations.

**Causes**:
- Device storage encrypted but not unlocked
- Secure Enclave/Keystore inaccessible
- OS-level security restrictions

**Solutions**:
1. Unlock device/decryption
2. Restart app
3. Check device security settings

### Items Not Persisting

**Symptom**: Items saved but not retrievable after app restart.

**Causes**:
- Using wrong service name on retrieval
- Item expired (timestamp validation)
- Service namespace cleared

**Solutions**:
1. Verify `service` param matches on read
2. Use same options object for write and read
3. Check that `clearService()` wasn't called

### Performance Degradation

**Symptom**: Slow reads even though benchmark shows 3×+ speed.

**Causes**:
- Using `includeValues: true` for list queries
- Biometric required for every operation
- Reading large payloads

**Solutions**:
1. Use `includeValues: false` for metadata-only queries
2. Batch operations: use `getAllItems()` instead of loop
3. Pre-fetch without biometric, then prompt for access

### Memory Leaks in Hooks

**Symptom**: App memory grows over time, hooks don't clean up.

**Causes**:
- Event listeners not unsubscribed
- Components not unmounting properly
- Large payload caching

**Solutions**:
1. Wrap hooks in `useEffect` with dependency array
2. Unsubscribe from events in cleanup
3. Limit `includeValues` queries

## Platform-Specific Issues

### iOS

| Issue | Solution |
| --- | --- |
| Face ID usage description missing | Add `NSFaceIDUsageDescription` to Info.plist |
| Simulator Secure Enclave not available | Test on device, or use `accessControl: 'none'` on simulator |
| iCloud sync not working | Verify iCloud entitlement and user sync enabled |
| Passcode dialog instead of biometric | Simulator limitation, test on device |

### Android

| Issue | Solution |
| --- | --- |
| Biometric not working on emulator | Enable biometric in AVD settings or test on device |
| StrongBox not available | Use API 28+ and supported device, fallback handled auto |
| Permission denied errors | Verify permissions in AndroidManifest.xml |
| Gradle sync failed | Check Android SDK version and Kotlin plugin |

## Getting Help

1. **Check this guide first** — Most issues are listed here
2. **Enable logging** — See debugging section above
3. **Check the example app** — Showcases all features working correctly
4. **Search GitHub issues** — Your issue may already be solved
5. **File an issue** — Include platform, OS version, and reproduction steps
6. **Ask on discussions** — Community may have workarounds

## Reporting Issues

When filing an issue, include:
- Minimal reproduction code
- Platform(s) affected (iOS, Android, web)
- OS version(s)
- Device model or simulator/emulator details
- Error message and full stack trace
- Steps to reproduce
- Expected vs actual behavior
