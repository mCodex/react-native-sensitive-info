import { NativeModules, Platform } from 'react-native';
import NativeSensitiveInfoTurboModule from './NativeSensitiveInfoSpec';
import type { Spec } from './NativeSensitiveInfoSpec';

declare global {
  var __turboModuleProxy: object | undefined;
}

const isTurboModuleEnabled = globalThis.__turboModuleProxy != null;

const NativeSensitiveInfoModule: Spec = isTurboModuleEnabled
  ? NativeSensitiveInfoTurboModule
  : (NativeModules.SensitiveInfo as Spec);

if (__DEV__ && Platform.OS === 'android' && NativeModules.SensitiveInfoView) {
  console.warn(
    '[react-native-sensitive-info] Detected legacy SensitiveInfoView export. Please ensure the library is properly linked as a TurboModule.'
  );
}

export default NativeSensitiveInfoModule;
