import { getHybridObjectConstructor } from 'react-native-nitro-modules';
import type { SensitiveInfo as NativeHandle } from '../sensitive-info.nitro';

type NativeCtor = new () => NativeHandle;

const SensitiveInfoCtor: NativeCtor =
  getHybridObjectConstructor<NativeHandle>('SensitiveInfo');

let cachedInstance: NativeHandle | null = null;

/**
 * Lazily instantiates and memoises the Nitro hybrid object.
 */
export default function getNativeInstance(): NativeHandle {
  if (cachedInstance == null) {
    cachedInstance = new SensitiveInfoCtor();
  }
  return cachedInstance;
}
