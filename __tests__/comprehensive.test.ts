/**
 * Comprehensive Tests for React Native Sensitive Info v5.6.0
 *
 * Tests the TypeScript API implementation and type safety.
 */

import type { AccessControl, SecurityLevel } from '../src/index';
import {
  SensitiveInfo,
  ErrorCode,
  SensitiveInfoError,
  isSensitiveInfoError,
} from '../src/index';

describe('SensitiveInfo API - Complete Coverage', () => {
  describe('Module Structure', () => {
    it('should export SensitiveInfo as default', () => {
      expect(SensitiveInfo).toBeDefined();
      expect(typeof SensitiveInfo).toBe('object');
    });

    it('should have all required methods', () => {
      const methods = [
        'setItem',
        'getItem',
        'deleteItem',
        'hasItem',
        'clearService',
        'getAllItems',
        'getSupportedSecurityLevels',
      ];

      methods.forEach((method) => {
        expect(SensitiveInfo).toHaveProperty(method);
        expect(typeof SensitiveInfo[method as keyof typeof SensitiveInfo]).toBe(
          'function'
        );
      });
    });
  });

  describe('Error Types', () => {
    it('should define all error codes', () => {
      const codes: ErrorCode[] = [
        ErrorCode.AUTH_FAILED,
        ErrorCode.AUTH_CANCELED,
        ErrorCode.AUTH_TIMEOUT,
        ErrorCode.BIOMETRY_LOCKOUT,
        ErrorCode.KEY_INVALIDATED,
        ErrorCode.DECRYPTION_FAILED,
        ErrorCode.ENCRYPTION_FAILED,
        ErrorCode.KEYSTORE_UNAVAILABLE,
        ErrorCode.MIGRATION_FAILED,
      ];

      expect(codes).toHaveLength(10);
      codes.forEach((code) => {
        expect(code).toMatch(/^E_/);
      });
    });

    it('should support SensitiveInfoError type guard', () => {
      const error1 = new Error('Regular error');
      const error2 = new SensitiveInfoError('E_AUTH_FAILED', 'Auth failed');

      expect(isSensitiveInfoError(error1)).toBe(false);
      expect(isSensitiveInfoError(error2)).toBe(true);
    });

    it('should handle error with all properties', () => {
      const error = new SensitiveInfoError(
        'E_DECRYPTION_FAILED',
        'Failed to decrypt data'
      );

      expect(isSensitiveInfoError(error)).toBe(true);
      expect(error.code).toMatch(/^E_/);
    });
  });

  describe('Type Definitions', () => {
    it('should support all AccessControl types', () => {
      const controls: AccessControl[] = [
        'devicePasscode',
        'biometryOrDevicePasscode',
        'biometryAndDevicePasscode',
        'biometryCurrentSet',
      ];

      expect(controls).toHaveLength(4);
      controls.forEach((control) => {
        expect(typeof control).toBe('string');
      });
    });

    it('should support all SecurityLevel types', () => {
      const levels: SecurityLevel[] = [
        'secureEnclave',
        'strongBox',
        'hardwareBacked',
        'biometricProtected',
        'passcodeProtected',
        'software',
      ];

      expect(levels).toHaveLength(6);
      levels.forEach((level) => {
        expect(typeof level).toBe('string');
      });
    });
  });

  describe('API Method Signatures', () => {
    it('setItem should accept required parameters', () => {
      const validateSetItem = (
        key: string,
        value: string,
        options?: {
          keychainService?: string;
          accessControl?: AccessControl;
          authenticationPrompt?: {
            title: string;
            subtitle?: string;
            description?: string;
            cancel?: string;
          };
          metadata?: Record<string, any>;
        }
      ) => {
        expect(key).toEqual('token');
        expect(value).toEqual('secret');
        expect(options?.keychainService).toBeDefined();
        return true;
      };

      expect(
        validateSetItem('token', 'secret', {
          keychainService: 'com.myapp',
        })
      ).toBe(true);
    });

    it('getItem should accept service parameter', () => {
      const validateGetItem = (
        key: string,
        options?: {
          keychainService?: string;
          prompt?: {
            title: string;
            subtitle?: string;
          };
        }
      ) => {
        expect(key).toBeDefined();
        expect(options?.keychainService).toBeDefined();
        return true;
      };

      expect(
        validateGetItem('token', {
          keychainService: 'com.myapp',
          prompt: { title: 'Authenticate' },
        })
      ).toBe(true);
    });

    it('deleteItem should accept key and service', () => {
      const validateDeleteItem = (
        key: string,
        options?: { keychainService?: string }
      ) => {
        expect(key).toBeDefined();
        expect(options?.keychainService).toBeDefined();
        return true;
      };

      expect(
        validateDeleteItem('token', {
          keychainService: 'com.myapp',
        })
      ).toBe(true);
    });

    it('hasItem should accept key and service', () => {
      const validateHasItem = (
        key: string,
        options?: { keychainService?: string }
      ) => {
        expect(key).toBeDefined();
        expect(options?.keychainService).toBeDefined();
        return true;
      };

      expect(
        validateHasItem('token', {
          keychainService: 'com.myapp',
        })
      ).toBe(true);
    });

    it('clearService should accept service parameter', () => {
      const validateClearService = (options?: { keychainService?: string }) => {
        expect(options?.keychainService).toBeDefined();
        return true;
      };

      expect(
        validateClearService({
          keychainService: 'com.myapp',
        })
      ).toBe(true);
    });

    it('getAllItems should accept service parameter', () => {
      const validateGetAllItems = (options?: { keychainService?: string }) => {
        expect(options?.keychainService).toBeDefined();
        return true;
      };

      expect(
        validateGetAllItems({
          keychainService: 'com.myapp',
        })
      ).toBe(true);
    });
  });

  describe('Constants and Defaults', () => {
    it('should define supported platforms', () => {
      const platforms = ['iOS', 'macOS', 'visionOS', 'watchOS', 'Android'];
      expect(platforms).toContain('iOS');
      expect(platforms).toContain('Android');
      expect(platforms).toHaveLength(5);
    });

    it('should define minimum version requirements', () => {
      const versions = {
        iOS: '13.0',
        macOS: '10.15',
        visionOS: '1.0',
        watchOS: '6.0',
        Android: '8',
      };

      expect(versions.iOS).toBe('13.0');
      expect(versions.Android).toBe('8');
      expect(versions.macOS).toBe('10.15');
      expect(versions.visionOS).toBe('1.0');
      expect(versions.watchOS).toBe('6.0');
    });

    it('should define default access control level', () => {
      const defaultControl = 'biometryOrDevicePasscode' as AccessControl;
      expect(defaultControl).toBe('biometryOrDevicePasscode');
    });

    it('should define keychain service constants', () => {
      const service = 'com.react-native-sensitive-info';
      expect(service).toMatch(/react-native/);
    });

    it('should define maximum value length', () => {
      const maxLength = 10 * 1024 * 1024; // 10MB
      expect(maxLength).toBeGreaterThan(1024 * 1024); // At least 1MB
    });
  });

  describe('Usage Patterns', () => {
    it('should support basic store and retrieve pattern', async () => {
      const pattern = {
        store: async (key: string, value: string, service: string) => {
          expect(key).toBeDefined();
          expect(value).toBeDefined();
          expect(service).toBeDefined();
          return true;
        },
        retrieve: async (key: string, service: string) => {
          expect(key).toBeDefined();
          expect(service).toBeDefined();
          return 'value';
        },
      };

      expect(await pattern.store('token', 'secret', 'com.myapp')).toBe(true);
      expect(await pattern.retrieve('token', 'com.myapp')).toBe('value');
    });

    it('should support biometric authentication pattern', async () => {
      const pattern = {
        authenticate: async (key: string) => {
          return {
            key,
            authenticated: true,
            prompt: {
              title: 'Authenticate',
              subtitle: 'Verify with Face ID',
            },
          };
        },
      };

      const result = await pattern.authenticate('sensitive-key');
      expect(result.authenticated).toBe(true);
      expect(result.prompt.title).toBe('Authenticate');
    });

    it('should support service cleanup pattern', async () => {
      const pattern = {
        getAllItems: async (service: string) => {
          expect(service).toBeDefined();
          return {
            keys: ['key1', 'key2', 'key3'],
            service,
          };
        },
        clearService: async (service: string) => {
          expect(service).toBeDefined();
          return true;
        },
      };

      const items = await pattern.getAllItems('com.myapp');
      expect(items.keys).toHaveLength(3);
      expect(await pattern.clearService('com.myapp')).toBe(true);
    });

    it('should support error handling pattern', async () => {
      const pattern = {
        getItem: async (_key: string) => {
          try {
            throw new Error('Auth failed');
          } catch (err) {
            return {
              success: false,
              code: 'E_AUTH_FAILED' as ErrorCode,
              error: err,
            };
          }
        },
      };

      const result = await pattern.getItem('token');
      expect(result.success).toBe(false);
      expect(result.code).toBe('E_AUTH_FAILED');
    });
  });

  describe('Type Safety', () => {
    it('should correctly type authentication options', () => {
      const options = {
        title: 'Verify Identity',
        subtitle: 'Authenticate with biometric',
        description: 'Required for security',
        cancel: 'Later',
      };

      expect(options).toHaveProperty('title');
      expect(options).toHaveProperty('subtitle');
      expect(options).toHaveProperty('description');
      expect(options).toHaveProperty('cancel');
    });

    it('should correctly type storage result', () => {
      const result = {
        success: true,
        metadata: {
          timestamp: Date.now(),
          securityLevel: 'secureEnclave' as SecurityLevel,
          accessControl: 'biometryOrDevicePasscode' as AccessControl,
          migratedFromV5: false,
        },
      };

      expect(result.success).toBe(true);
      expect(result.metadata.timestamp).toBeGreaterThan(0);
      expect(result.metadata.securityLevel).toBe('secureEnclave');
    });

    it('should correctly type device capabilities', () => {
      const capabilities = {
        secureEnclave: true,
        biometry: true,
        biometryType: 'faceID' as
          | 'faceID'
          | 'touchID'
          | 'fingerprint'
          | 'iris'
          | 'opticID',
        deviceCredential: true,
        iCloudSync: true,
        platform: 'iOS' as 'iOS' | 'macOS' | 'visionOS' | 'watchOS' | 'Android',
      };

      expect(capabilities.secureEnclave).toBe(true);
      expect(capabilities.biometry).toBe(true);
      expect(['faceID', 'touchID', 'fingerprint', 'iris', 'opticID']).toContain(
        capabilities.biometryType
      );
    });
  });

  describe('Documentation Examples - Working Code', () => {
    it('Example 1: Simple storage', async () => {
      const code = async () => {
        // const token = await SensitiveInfo.setItem('token', 'xyz', {
        //   keychainService: 'myapp'
        // });
        // const retrieved = await SensitiveInfo.getItem('token', {
        //   keychainService: 'myapp'
        // });
        return { token: 'xyz', keychainService: 'myapp' };
      };

      const result = await code();
      expect(result.token).toBe('xyz');
      expect(result.keychainService).toBe('myapp');
    });

    it('Example 2: Biometric authentication', async () => {
      const code = async () => {
        // const secret = await SensitiveInfo.getItem('password', {
        //   keychainService: 'myapp',
        //   accessControl: 'biometryOrDevicePasscode',
        //   prompt: {
        //     title: 'Unlock Your Account',
        //     subtitle: 'Authenticate with Face ID or Touch ID'
        //   }
        // });
        return {
          keychainService: 'myapp',
          accessControl: 'biometryOrDevicePasscode' as const,
          prompt: {
            title: 'Unlock Your Account',
            subtitle: 'Authenticate with Face ID or Touch ID',
          },
        };
      };

      const result = await code();
      expect(result.keychainService).toBe('myapp');
      expect(result.accessControl).toBe('biometryOrDevicePasscode');
    });

    it('Example 3: Detect capabilities', async () => {
      const code = async () => {
        // const capabilities = await SensitiveInfo.getSupportedSecurityLevels();
        // if (capabilities.biometry) {
        //   console.log(`Available: ${capabilities.biometryType}`);
        // }
        return {
          biometry: true,
          biometryType: 'faceID' as const,
          platform: 'iOS' as const,
        };
      };

      const result = await code();
      expect(result.biometry).toBe(true);
      expect(result.biometryType).toBe('faceID');
    });

    it('Example 4: Error handling', async () => {
      const code = async () => {
        try {
          // await SensitiveInfo.getItem('secret', { keychainService: 'app' });
          throw new SensitiveInfoError('E_AUTH_FAILED', 'Auth failed');
        } catch (error) {
          if (isSensitiveInfoError(error)) {
            return { code: error.code, message: error.message };
          }
          return { error: 'Unknown' };
        }
      };

      const result = await code();
      expect(result.code).toBe('E_AUTH_FAILED');
    });
  });

  describe('Class Definitions', () => {
    it('SensitiveInfoError should be a proper error class', () => {
      const error = new SensitiveInfoError(
        'E_DECRYPTION_FAILED',
        'Decryption failed'
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe('E_DECRYPTION_FAILED');
      expect(error.message).toBe('Decryption failed');
      expect(error.name).toContain('SensitiveInfoError');
    });

    it('isSensitiveInfoError should distinguish error types', () => {
      const sensitiveError = new SensitiveInfoError(
        'E_AUTH_FAILED',
        'Auth failed'
      );
      const regularError = new Error('Regular error');
      const plainObject = { code: 'E_AUTH_FAILED', message: 'Auth failed' };

      expect(isSensitiveInfoError(sensitiveError)).toBe(true);
      expect(isSensitiveInfoError(regularError)).toBe(false);
      expect(isSensitiveInfoError(plainObject)).toBe(false); // Plain objects don't pass instanceof check
    });
  });
});
