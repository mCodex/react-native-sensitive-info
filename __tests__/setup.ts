/**
 * __tests__/setup.ts
 *
 * Jest setup file for test configuration
 * Runs before all tests
 */

// Mock React Native
jest.mock('react-native', () => ({
  NativeModules: {
    SensitiveInfo: {
      setItem: jest.fn(),
      getItem: jest.fn(),
      hasItem: jest.fn(),
      deleteItem: jest.fn(),
      getAllItems: jest.fn(),
      clearService: jest.fn(),
      getSupportedSecurityLevels: jest.fn(),
    },
  },
}));

// Set test environment variable
process.env.NODE_ENV = 'test';
