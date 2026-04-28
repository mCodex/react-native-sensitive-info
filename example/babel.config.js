const path = require('node:path')
const pak = require('../package.json')

module.exports = (api) => {
	api.cache(true)
	return {
		presets: ['module:@react-native/babel-preset'],
		plugins: [
			// Run the React Compiler first so it sees the original source before any
			// other transforms rewrite it. Default target is React 19, which matches
			// the RN 0.85 / React 19.2 runtime shipped by this example.
			'babel-plugin-react-compiler',
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
