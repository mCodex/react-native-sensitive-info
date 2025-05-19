# react-native-sensitive-info

Descriptive

## Installation

```sh
npm install react-native-sensitive-info react-native-nitro-modules

> `react-native-nitro-modules` is required as this library relies on [Nitro Modules](https://nitro.margelo.com/).
```

## Usage



```ts
import {
  setItem,
  getItem,
  deleteItem,
  isBiometricAvailable,
  authenticate,
} from 'react-native-sensitive-info';

// Store a value securely
await setItem('myKey', 'mySecret');

// Retrieve a value
const { value, error } = await getItem('myKey');

// Store a value requiring biometric authentication
await setItem('biometricKey', 'superSecret', {
  biometric: true,
  promptReason: 'Authenticate to access your secret',
});

// Retrieve a value with automatic biometric prompt
const { value: secret } = await getItem('biometricKey');

// Delete a value
await deleteItem('myKey');

// Check if biometric is available
const isAvailable = await isBiometricAvailable();

// Prompt for biometric authentication only
const { value: authResult } = await authenticate({ promptReason: 'Please authenticate' });
```
## React Hooks

This library provides hooks for easy integration in React components:

```ts
import { useSensitiveInfo, useBiometricAuth } from 'react-native-sensitive-info/hooks';

const { value, error, loading, get, set, del } = useSensitiveInfo('myKey');
const { success, error: bioError, loading: bioLoading, authenticate } = useBiometricAuth();
```



## Contributing


## API


### setItem(key, value, options?)
Store a value securely. Pass `{ biometric: true, promptReason }` to require biometric authentication. Automatically stores metadata for biometric detection.

### getItem(key, options?)
Retrieve a value. If the value was stored with biometric protection, biometric prompt is automatic.

### deleteItem(key)
Delete a value securely (and its metadata).

### isBiometricAvailable()
Check if biometric authentication is available on the device.

### authenticate(options?)
Prompt the user for biometric authentication only (no storage).

### useSensitiveInfo(key, options?)
React hook for secure value management. Returns `{ value, error, loading, get, set, del }`.

### useBiometricAuth(options?)
React hook for biometric authentication. Returns `{ success, error, loading, authenticate }`.

#### SensitiveInfoOptions
Customize the biometric prompt (use `promptReason`, `promptTitle`, `promptDescription`, `promptNegativeButton`).

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
