/** @type {import('jest').Config} */
const config = {
	preset: 'ts-jest',
	testEnvironment: 'jsdom',
	// setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
	transform: {
		'^.+\\.(ts|tsx)$': [
			'ts-jest',
			{
				tsconfig: '<rootDir>/tsconfig.test.json',
				isolatedModules: false,
			},
		],
	},
	moduleNameMapper: {
		'^react-native$': '<rootDir>/src/__tests__/__mocks__/react-native.ts',
	},
	collectCoverage: true,
	collectCoverageFrom: [
		'src/**/*.{ts,tsx}',
		'!src/**/__tests__/**',
		'!src/**/*.nitro.ts',
	],
	coverageThreshold: {
		global: {
			statements: 90,
			branches: 80,
			functions: 80,
			lines: 90,
		},
	},
	testMatch: ['<rootDir>/src/**/?(*.)+(spec|test).ts?(x)'],
}

module.exports = config
