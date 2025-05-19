# Manual & E2E Test Plan for SensitiveInfo

## Biometric Authentication
- Test storing and retrieving a value with `requireBiometric: true`.
- Test prompt customization (title/reason, etc.) on both iOS and Android.
- Test fallback and error handling if biometrics are not available or user cancels.

## Secure Storage
- Test storing, retrieving, and deleting values with and without biometric protection.
- Test that values are not accessible after deletion.

## Example
```ts
await SensitiveInfoHybridObject.setItem('bioKey', 'bioSecret', {
  requireBiometric: true,
  promptOptions: { reason: 'Authenticate to access secret' },
});
const secret = await SensitiveInfoHybridObject.getItem('bioKey', {
  requireBiometric: true,
  promptOptions: { reason: 'Authenticate to access secret' },
});
```

## Edge Cases
- Try to retrieve a non-existent key.
- Try to store a value with the same key twice.
- Test on devices with and without biometric hardware.
