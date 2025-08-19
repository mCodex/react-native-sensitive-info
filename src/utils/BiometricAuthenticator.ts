import { NativeModules, Platform } from 'react-native';

interface BiometricAuthModule {
  isAvailable(): Promise<boolean>;
  authenticate(options?: {
    promptTitle?: string;
    promptSubtitle?: string;
    promptDescription?: string;
    cancelButtonText?: string;
    allowDeviceCredential?: boolean;
  }): Promise<boolean>;
}

// Fallback implementation for when no biometric library is available
const createFallbackBiometricAuth = (): BiometricAuthModule => ({
  isAvailable: async () => false,
  authenticate: async () => {
    throw new Error(
      'Biometric authentication is not available on this device.'
    );
  },
});

let biometricAuth: BiometricAuthModule | undefined;

// Prefer our built-in native modules first (no external deps)
if (Platform.OS === 'android') {
  const AndroidBiometric = NativeModules.AndroidBiometric;
  if (AndroidBiometric) {
    biometricAuth = {
      isAvailable: () => AndroidBiometric.isAvailable(),
      authenticate: (options = {}) => AndroidBiometric.authenticate(options),
    };
  }
}

if (Platform.OS === 'ios' && !biometricAuth) {
  const LocalAuthentication = NativeModules.LocalAuthentication;
  if (LocalAuthentication) {
    biometricAuth = {
      isAvailable: () => LocalAuthentication.isAvailable(),
      authenticate: (options = {}) =>
        LocalAuthentication.authenticate({
          reason:
            options.promptDescription ||
            'Authenticate to access sensitive data',
          allowDeviceCredential: options.allowDeviceCredential ?? false,
        }),
    };
  }
}

// Note: HybridView is render-based; for imperative prompts we use bridge modules above.

// Final fallback
if (!biometricAuth) {
  if (Platform.OS === 'android') {
    const AndroidBiometric = NativeModules.AndroidBiometric;
    biometricAuth = AndroidBiometric
      ? {
          isAvailable: () => AndroidBiometric.isAvailable(),
          authenticate: (options = {}) =>
            AndroidBiometric.authenticate(options),
        }
      : createFallbackBiometricAuth();
  } else {
    const LocalAuthentication = NativeModules.LocalAuthentication;
    biometricAuth = LocalAuthentication
      ? {
          isAvailable: () => LocalAuthentication.isAvailable(),
          authenticate: (options = {}) =>
            LocalAuthentication.authenticate({
              reason:
                options.promptDescription ||
                'Authenticate to access sensitive data',
              allowDeviceCredential: options.allowDeviceCredential ?? false,
            }),
        }
      : createFallbackBiometricAuth();
  }
}

export interface BiometricOptions {
  promptTitle?: string;
  promptSubtitle?: string;
  promptDescription?: string;
  cancelButtonText?: string;
  allowDeviceCredential?: boolean;
}

export class BiometricAuthenticator {
  static async isAvailable(): Promise<boolean> {
    const impl = biometricAuth ?? createFallbackBiometricAuth();
    return impl.isAvailable();
  }

  static async authenticate(options?: BiometricOptions): Promise<boolean> {
    const impl = biometricAuth ?? createFallbackBiometricAuth();
    return impl.authenticate(options);
  }
}

export default BiometricAuthenticator;
