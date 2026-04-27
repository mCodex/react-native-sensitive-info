const path = require('node:path')
const pak = require('../package.json')

module.exports = (api) => {
	api.cache(true)
	return {
		presets: ['module:@react-native/babel-preset'],
		plugins: [
			[
				'module-resolver',
				{
					extensions: ['.js', '.ts', '.json', '.jsx', '.tsx'],
					alias: {
						// Map to the source directory (not `src/index`) so that subpath
						// imports like `react-native-sensitive-info/hooks` resolve to
						// `src/hooks/index.ts` instead of `src/index/hooks`.
						[pak.name]: path.join(__dirname, '..', 'src'),
					},
				},
			],
		],
	}
}
