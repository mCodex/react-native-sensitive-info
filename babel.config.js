/**
 * The library's babel config has a single job: ensure
 * `babel-plugin-react-compiler` runs on every code path that produces
 * shipped JavaScript.
 *
 * - When `react-native-builder-bob` invokes us (bob targets set
 *   `configFile: true` so they pick up this file), we extend bob's own
 *   preset — it already takes care of `@babel/preset-env`, JSX, TS, and
 *   import-extension rewriting. Adding our own RN preset would mis-target
 *   the published bundle for Hermes only.
 * - For any other caller (jest is ts-jest only and ignores this file, but
 *   IDE tooling and `metro` in the example app may load it), fall back to
 *   the standard React Native preset.
 *
 * The compiler plugin is listed BEFORE other plugins so it operates on
 * pristine source.
 */
module.exports = (api) => {
	const isBob = api.caller((caller) =>
		caller != null ? caller.name === 'react-native-builder-bob' : false
	)

	const plugins = ['babel-plugin-react-compiler']

	if (isBob) {
		return {
			presets: [require.resolve('react-native-builder-bob/babel-preset')],
			plugins,
		}
	}

	return {
		presets: ['module:@react-native/babel-preset'],
		plugins,
	}
}
