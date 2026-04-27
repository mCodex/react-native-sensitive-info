const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
	watchFolders: [root],
	resolver: {
		// Honor the `exports` map in package.json so subpath imports like
		// `react-native-sensitive-info/hooks` and `/errors` resolve correctly.
		unstable_enablePackageExports: true,
	},
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)
