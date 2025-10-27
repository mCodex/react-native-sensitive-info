/**
 * @internal - Native instance management
 * Handles lazy initialization and caching of the Nitro hybrid object
 */
import { getHybridObjectConstructor } from 'react-native-nitro-modules'
import type { SensitiveInfo as SensitiveInfoNativeHandle } from './sensitive-info.nitro'

const SensitiveInfoCtor =
  getHybridObjectConstructor<SensitiveInfoNativeHandle>('SensitiveInfo')

let cachedInstance: SensitiveInfoNativeHandle | null = null

/**
 * Lazily instantiates the underlying Nitro hybrid object.
 * Nitro guarantees this object is shared across the app lifecycle, so we cache it on the JS side as well.
 */
export default function getNativeInstance(): SensitiveInfoNativeHandle {
  if (cachedInstance == null) {
    cachedInstance = new SensitiveInfoCtor()
  }
  return cachedInstance
}
