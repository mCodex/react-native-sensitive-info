#!/usr/bin/env node
/**
 * End-to-end pre-release smoke test.
 *
 * Packs the package with `npm pack`, installs the tarball into a throwaway
 * project, and verifies the consumer-facing surface:
 *   1. The published tarball contains nitrogen native bindings + JS subpath
 *      proxy `package.json` files (catches "missing autolinking.rb" type bugs).
 *   2. Node's CJS resolver (which honors the package `exports` map) can
 *      resolve every documented entry point.
 *   3. The same subpaths also resolve via the legacy `main`/`module`/
 *      `react-native` fields in the proxy directories — this is what bundlers
 *      that ignore `exports` (older Re.Pack/rspack/Metro setups) rely on.
 *   4. The podspec and the generated iOS autolinking.rb have valid Ruby
 *      syntax, so `pod install` will not blow up at parse time.
 *
 * Designed to run inside `release-it`'s `before:init` hook so a broken
 * release is caught before the npm publish + git push.
 */
const { execSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const PKG = require(path.join(ROOT, 'package.json'))

const REQUIRED_TARBALL_ENTRIES = [
	'package/nitrogen/generated/ios/SensitiveInfo+autolinking.rb',
	'package/nitrogen/generated/android/SensitiveInfo+autolinking.gradle',
	'package/hooks/package.json',
	'package/errors/package.json',
	'package/lib/commonjs/index.js',
	'package/lib/module/index.js',
	'package/lib/commonjs/hooks/index.js',
	'package/lib/module/hooks/index.js',
	'package/lib/commonjs/errors.js',
	'package/lib/module/errors.js',
]

const SUBPATHS = [
	'react-native-sensitive-info',
	'react-native-sensitive-info/hooks',
	'react-native-sensitive-info/errors',
	'react-native-sensitive-info/package.json',
]

const PROXY_DIRS = ['hooks', 'errors']

const run = (cmd, opts = {}) =>
	execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], ...opts })
		.toString()
		.trim()

const fail = (msg) => {
	console.error(`\n[smoke-test-release] ❌ ${msg}\n`)
	process.exit(1)
}

const log = (msg) => console.log(`[smoke-test-release] ${msg}`)

// 1. Pack the tarball.
log('Packing tarball with `npm pack`…')
const tarballName = run('npm pack --silent', { cwd: ROOT }).split('\n').pop()
const tarballPath = path.join(ROOT, tarballName)

try {
	// 2. Verify required entries are present.
	const entries = run(`tar -tzf ${tarballName}`, { cwd: ROOT }).split('\n')
	const missing = REQUIRED_TARBALL_ENTRIES.filter((e) => !entries.includes(e))
	if (missing.length > 0) {
		fail(
			`Tarball is missing required entries:\n  - ${missing.join('\n  - ')}\n\nRun \`npm run codegen\` and rebuild before releasing.`
		)
	}
	log(
		`Tarball contains all ${REQUIRED_TARBALL_ENTRIES.length} required entries.`
	)

	// 3. Install the tarball into a throwaway project.
	const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'rnsi-smoke-'))
	fs.writeFileSync(
		path.join(sandbox, 'package.json'),
		JSON.stringify({ name: 'rnsi-smoke', version: '0.0.0', private: true })
	)
	log(`Installing tarball into ${sandbox}…`)
	run(`npm install --silent --no-save ${tarballPath}`, { cwd: sandbox })

	// 4. Verify Node's CJS resolver finds every documented subpath
	//    (this exercises the `exports` map).
	for (const subpath of SUBPATHS) {
		try {
			run(`node -e "require.resolve('${subpath}')"`, { cwd: sandbox })
			log(`exports map resolves: ${subpath}`)
		} catch (err) {
			fail(`exports map cannot resolve "${subpath}":\n${err.message}`)
		}
	}

	// 5. Verify the legacy main/module/react-native proxies still point at
	//    real files. Bundlers that ignore `exports` rely on these.
	for (const sub of PROXY_DIRS) {
		const proxyPath = path.join(
			sandbox,
			'node_modules',
			PKG.name,
			sub,
			'package.json'
		)
		const proxy = JSON.parse(fs.readFileSync(proxyPath, 'utf8'))
		for (const field of ['main', 'module', 'react-native']) {
			const target = proxy[field]
			if (typeof target !== 'string') {
				fail(`Proxy ${sub}/package.json missing string "${field}" field.`)
			}
			const resolved = path.resolve(path.dirname(proxyPath), target)
			if (!fs.existsSync(resolved)) {
				fail(
					`Proxy ${sub}/package.json "${field}" → ${target} does not resolve to a file (${resolved}).`
				)
			}
		}
		log(`legacy field proxy resolves: ${sub}/`)
	}

	// 6. Validate Ruby syntax for podspec + autolinking.rb so `pod install`
	//    won't fail with a parse error on consumer machines.
	const podspecPath = path.join(ROOT, 'SensitiveInfo.podspec')
	const autolinkingPath = path.join(
		sandbox,
		'node_modules',
		PKG.name,
		'nitrogen/generated/ios/SensitiveInfo+autolinking.rb'
	)
	try {
		run(`ruby -c "${podspecPath}"`)
		run(`ruby -c "${autolinkingPath}"`)
		log('podspec + autolinking.rb pass `ruby -c`.')
	} catch (err) {
		fail(`Ruby syntax check failed:\n${err.stderr?.toString() ?? err.message}`)
	}

	// 7. Cleanup sandbox.
	fs.rmSync(sandbox, { recursive: true, force: true })

	console.log('\n[smoke-test-release] ✅ Release candidate looks healthy.\n')
} finally {
	// Always remove the local tarball — release-it will pack again at publish time.
	if (fs.existsSync(tarballPath)) fs.unlinkSync(tarballPath)
}
