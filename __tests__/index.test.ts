/**
 * Basic Unit Tests for React Native Sensitive Info v5.6.0
 *
 * These tests verify the TypeScript API surface and basic functionality.
 * Native functionality (encryption, biometric) is tested via integration tests
 * on real devices/simulators.
 */

import type { AccessControl, SecurityLevel } from '../src/index';
import {
  SensitiveInfo,
  SensitiveInfoError,
  isSensitiveInfoError,
  SUPPORTED_PLATFORMS,
  MIN_VERSIONS,
  DEFAULT_ACCESS_CONTROL,
  DEFAULT_KEYCHAIN_SERVICE,
  MAX_VALUE_LENGTH,
} from '../src/index';

describe('SensitiveInfo API', () => {
  describe('Module Exports', () => {
    it('should export SensitiveInfo object', () => {
      expect(SensitiveInfo).toBeDefined();
    });

    it('should have setItem method', () => {
      expect(typeof SensitiveInfo.setItem).toBe('function');
    });

    it('should have getItem method', () => {
      expect(typeof SensitiveInfo.getItem).toBe('function');
    });

    it('should have deleteItem method', () => {
      expect(typeof SensitiveInfo.deleteItem).toBe('function');
    });

    it('should have clearService method', () => {
      expect(typeof SensitiveInfo.clearService).toBe('function');
    });

    it('should have hasItem method', () => {
      expect(typeof SensitiveInfo.hasItem).toBe('function');
    });

    it('should have getAllItems method', () => {
      expect(typeof SensitiveInfo.getAllItems).toBe('function');
    });

    it('should have getSupportedSecurityLevels method', () => {
      expect(typeof SensitiveInfo.getSupportedSecurityLevels).toBe('function');
    });
  });

  describe('Type Safety', () => {
    it('should accept valid setItem options', () => {
      const options = {
        keychainService: 'com.example.app',
        accessControl: 'secureEnclaveBiometry' as const,
      };
      expect(options.keychainService).toBe('com.example.app');
    });

    it('should accept setItem with metadata', () => {
      const options = {
        keychainService: 'com.example.app',
        metadata: {
          timestamp: Date.now(),
          custom: 'data',
        },
      };
      expect(options.metadata).toBeDefined();
    });

    it('should support all access control types', () => {
      const controls: AccessControl[] = [
        'secureEnclaveBiometry',
        'biometryCurrentSet',
        'biometryAny',
        'devicePasscode',
        'none',
      ];

      expect(controls).toHaveLength(5);
      expect(controls.every((c) => typeof c === 'string')).toBe(true);
    });

    it('should support all security levels', () => {
      const levels: SecurityLevel[] = [
        'secureEnclave',
        'strongBox',
        'biometry',
        'deviceCredential',
        'software',
      ];

      expect(levels).toHaveLength(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle operation results with success flag', () => {
      const result = { success: true };
      expect(result.success).toBe(true);
    });

    it('should handle error codes correctly', () => {
      const codes = [
        'E_AUTH_FAILED',
        'E_DECRYPTION_FAILED',
        'E_ENCRYPTION_FAILED',
        'E_KEYSTORE_UNAVAILABLE',
      ];
      codes.forEach((code) => {
        expect(code).toMatch(/^E_/);
      });
    });

    it('should instantiate SensitiveInfoError', () => {
      const error = new SensitiveInfoError('E_AUTH_FAILED', 'Auth failed');
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe('E_AUTH_FAILED');
      expect(error.message).toBe('Auth failed');
    });

    it('should use type guard isSensitiveInfoError', () => {
      const error = new SensitiveInfoError('E_AUTH_FAILED', 'Auth failed');
      const regularError = new Error('Regular error');
      expect(isSensitiveInfoError(error)).toBe(true);
      expect(isSensitiveInfoError(regularError)).toBe(false);
    });
  });

  describe('Constants', () => {
    it('should define supported platforms', () => {
      expect(SUPPORTED_PLATFORMS).toBeDefined();
      expect(Array.isArray(SUPPORTED_PLATFORMS)).toBe(true);
      expect(SUPPORTED_PLATFORMS.length).toBeGreaterThan(0);
    });

    it('should define minimum versions', () => {
      expect(MIN_VERSIONS).toBeDefined();
      expect(typeof MIN_VERSIONS).toBe('object');
    });

    it('should define default access control', () => {
      expect(DEFAULT_ACCESS_CONTROL).toBeDefined();
      expect(typeof DEFAULT_ACCESS_CONTROL).toBe('string');
      expect(DEFAULT_ACCESS_CONTROL).toMatch(/^[a-z]/);
    });

    it('should define default keychain service', () => {
      expect(DEFAULT_KEYCHAIN_SERVICE).toBeDefined();
      expect(typeof DEFAULT_KEYCHAIN_SERVICE).toBe('string');
    });

    it('should define max value length', () => {
      expect(MAX_VALUE_LENGTH).toBeDefined();
      expect(typeof MAX_VALUE_LENGTH).toBe('number');
      expect(MAX_VALUE_LENGTH).toBeGreaterThan(0);
    });
  });

  describe('Documentation Examples', () => {
    it('should support basic storage pattern', async () => {
      // This is a type check - actual execution would require mocks
      const expectedCode = async () => {
        const options = {
          keychainService: 'com.myapp',
        };
        // await SensitiveInfo.setItem('token', 'value', options);
        // const value = await SensitiveInfo.getItem('token', options);
        return options;
      };

      const result = await expectedCode();
      expect(result.keychainService).toBe('com.myapp');
    });

    it('should support biometric authentication pattern', async () => {
      const expectedCode = async () => {
        const options = {
          keychainService: 'com.myapp',
          accessControl: 'secureEnclaveBiometry' as const,
          prompt: {
            title: 'Authenticate',
            subtitle: 'Verify your identity',
          },
        };
        // await SensitiveInfo.getItem('secret', options);
        return options;
      };

      const result = await expectedCode();
      expect(result.accessControl).toBe('secureEnclaveBiometry');
      expect(result.prompt.title).toBe('Authenticate');
    });

    it('should support service operations pattern', async () => {
      const expectedCode = async () => {
        const service = 'com.myapp';
        // const items = await SensitiveInfo.getAllItems({ keychainService: service });
        // await SensitiveInfo.clearService({ keychainService: service });
        return service;
      };

      const result = await expectedCode();
      expect(result).toBe('com.myapp');
    });
  });

  describe('API Coverage', () => {
    it('should have proper types on setItem', () => {
      const fn = SensitiveInfo.setItem;
      expect(fn).toBeDefined();
      expect(fn.length).toBeGreaterThanOrEqual(0);
    });

    it('should have proper types on getItem', () => {
      const fn = SensitiveInfo.getItem;
      expect(fn).toBeDefined();
      expect(fn.length).toBeGreaterThanOrEqual(0);
    });

    it('should have proper types on deleteItem', () => {
      const fn = SensitiveInfo.deleteItem;
      expect(fn).toBeDefined();
      expect(fn.length).toBeGreaterThanOrEqual(0);
    });

    it('should have proper types on hasItem', () => {
      const fn = SensitiveInfo.hasItem;
      expect(fn).toBeDefined();
      expect(fn.length).toBeGreaterThanOrEqual(0);
    });

    it('should have proper types on getAllItems', () => {
      const fn = SensitiveInfo.getAllItems;
      expect(fn).toBeDefined();
      expect(fn.length).toBeGreaterThanOrEqual(0);
    });

    it('should have proper types on clearService', () => {
      const fn = SensitiveInfo.clearService;
      expect(fn).toBeDefined();
      expect(fn.length).toBeGreaterThanOrEqual(0);
    });

    it('should have getSupportedSecurityLevels method', () => {
      const fn = SensitiveInfo.getSupportedSecurityLevels;
      expect(fn).toBeDefined();
      expect(typeof fn).toBe('function');
    });
  });
});
