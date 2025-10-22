/**
 * Jest Configuration for React Native Sensitive Info v5.6.0
 *
 * Configuration for comprehensive test suite with coverage reporting
 */
module.exports = {
  // Use React Native preset
  preset: 'react-native',

  // Test environment
  testEnvironment: 'node',

  // Module name mapper for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/types$': '<rootDir>/src/types/index.ts',
  },

  // Transform files using babel-jest (React Native preset)
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.tsx',
    '!src/views/**',
    '!src/SensitiveInfoViewNativeComponent.ts',
  ],

  // Coverage thresholds
  // Note: Set to 5% for hybrid native/JS library (most logic in native code)
  // JavaScript tests cover API surface and type safety, not native implementations
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 5,
      statements: 5,
    },
  },

  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.{test,spec}.{ts,tsx,js}',
    '!**/__tests__/**/setup.ts',
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/lib/',
    '/example/',
  ],

  // Verbose output
  verbose: true,

  // Test timeout
  testTimeout: 10000,

  // No setup file (since we haven't created one yet)
  setupFilesAfterEnv: [],
};
