import { NitroModules } from 'react-native-nitro-modules';
import type { SensitiveInfo } from './SensitiveInfo.nitro';

const SensitiveInfoHybridObject =
  NitroModules.createHybridObject<SensitiveInfo>('SensitiveInfo');

export function multiply(a: number, b: number): number {
  return SensitiveInfoHybridObject.multiply(a, b);
}
