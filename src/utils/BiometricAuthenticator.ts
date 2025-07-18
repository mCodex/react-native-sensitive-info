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
      'Biometric authentication is not available. Please install react-native-biometrics for enhanced biometric support.'
    );
  },
});

let biometricAuth: BiometricAuthModule;

try {
  // Try to use react-native-biometrics if available
  const ReactNativeBiometrics = require('react-native-biometrics').default;
  const rnBiometrics = new ReactNativeBiometrics();

  biometricAuth = {
    isAvailable: async () => {
      try {
        const { available } = await rnBiometrics.isSensorAvailable();
        return available;
      } catch {
        return false;
      }
    },
    authenticate: async (options = {}) => {
      const { success } = await rnBiometrics.simplePrompt({
        promptMessage:
          options.promptDescription || 'Authenticate to access sensitive data',
        cancelButtonText: options.cancelButtonText || 'Cancel',
      });
      return success;
    },
  };
} catch {
  // Fallback implementation without external dependencies
  if (Platform.OS === 'ios') {
    // iOS fallback using LocalAuthentication through native modules
    const LocalAuthentication = NativeModules.LocalAuthentication;
    if (LocalAuthentication) {
      biometricAuth = {
        isAvailable: () => LocalAuthentication.isAvailable(),
        authenticate: (options = {}) =>
          LocalAuthentication.authenticate({
            reason:
              options.promptDescription ||
              'Authenticate to access sensitive data',
            fallbackTitle: options.allowDeviceCredential
              ? 'Use Passcode'
              : undefined,
          }),
      };
    } else {
      biometricAuth = createFallbackBiometricAuth();
    }
  } else {
    // Android fallback - use our own native implementation
    const AndroidBiometric = NativeModules.AndroidBiometric;
    if (AndroidBiometric) {
      biometricAuth = {
        isAvailable: () => AndroidBiometric.isAvailable(),
        authenticate: (options = {}) => AndroidBiometric.authenticate(options),
      };
    } else {
      biometricAuth = createFallbackBiometricAuth();
    }
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
    return biometricAuth.isAvailable();
  }

  static async authenticate(options?: BiometricOptions): Promise<boolean> {
    return biometricAuth.authenticate(options);
  }
}

export default BiometricAuthenticator;
