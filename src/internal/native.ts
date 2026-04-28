import { getHybridObjectConstructor } from 'react-native-nitro-modules'
import { ErrorCode, SensitiveInfoError } from '../errors'
import type { SensitiveInfo as NativeHandle } from '../sensitive-info.nitro'

type NativeCtor = new () => NativeHandle

let cachedCtor: NativeCtor | null = null
let cachedInstance: NativeHandle | null = null

/**
 * Resolves the Nitro hybrid constructor lazily so the failure path can produce a friendly error
 * (instead of the cryptic Nitro lookup throw at module load).
 */
function loadConstructor(): NativeCtor {
	if (cachedCtor != null) return cachedCtor
	try {
		cachedCtor = getHybridObjectConstructor<NativeHandle>('SensitiveInfo')
	} catch (cause) {
		throw new SensitiveInfoError(
			ErrorCode.Unknown,
			'react-native-sensitive-info native module is not available. ' +
				'This is expected inside Expo Go — use a custom Dev Client (`npx expo run:ios` / ' +
				'`npx expo run:android`) or an EAS Build that bundles the native module.',
			{ cause }
		)
	}
	return cachedCtor
}

/**
 * Lazily instantiates and memoises the Nitro hybrid object.
 */
export default function getNativeInstance(): NativeHandle {
	if (cachedInstance == null) {
		const Ctor = loadConstructor()
		cachedInstance = new Ctor()
	}
	return cachedInstance
}
