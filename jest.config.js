/** @type {import('jest').Config} */
const config = {
	testEnvironment: 'jsdom',
	transform: {
		'^.+\\.(ts|tsx)$': [
			'babel-jest',
			{
				configFile: false,
				babelrc: false,
				presets: [
					['@babel/preset-env', { targets: { node: 'current' } }],
					['@babel/preset-react', { runtime: 'automatic' }],
					'@babel/preset-typescript',
				],
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
	testMatch: [
		'<rootDir>/src/**/?(*.)+(spec|test).ts?(x)',
		'<rootDir>/__tests__/**/?(*.)+(spec|test).ts?(x)',
	],
}

module.exports = config
