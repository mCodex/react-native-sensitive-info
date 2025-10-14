import { NativeModules, Platform } from 'react-native';
import type { Spec } from './NativeSensitiveInfoSpec';

declare global {
  var __turboModuleProxy: object | undefined;
}

const LINKING_ERROR =
  "The package 'react-native-sensitive-info' doesn't seem to be linked.\n" +
  Platform.select({
    ios: "Make sure the Podfile includes use_frameworks! or use_modular_headers! when required, then run 'pod install' in the example/ios directory, and rebuild the app.",
    android:
      "Make sure you have run the Gradle sync (or 'yarn example android' / './gradlew clean && ./gradlew assembleDebug') after installing the package.",
    default:
      'Ensure the native build has been regenerated after installing the dependency.',
  });

const isTurboModuleEnabled = globalThis.__turboModuleProxy != null;

let turboModule: Spec | null = null;

if (isTurboModuleEnabled) {
  try {
    turboModule = require('./NativeSensitiveInfoSpec').default as Spec;
  } catch {
    turboModule = null;
  }
}

const legacyModule = NativeModules.SensitiveInfo as Spec | null | undefined;

const NativeSensitiveInfoModule: Spec =
  turboModule ??
  legacyModule ??
  (new Proxy(
    {},
    {
      get(_target, property) {
        throw new Error(
          `${LINKING_ERROR}\nAttempted to access native method '${String(property)}'.`
        );
      },
    }
  ) as Spec);

if (__DEV__ && Platform.OS === 'android' && NativeModules.SensitiveInfoView) {
  console.warn(
    '[react-native-sensitive-info] Detected legacy SensitiveInfoView export. Please ensure the library is properly linked as a TurboModule.'
  );
}

export const isSensitiveInfoTurboModuleEnabled = turboModule != null;

export default NativeSensitiveInfoModule;
