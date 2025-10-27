/**
 * @internal - Options normalization
 * Handles default values and option resolution
 */
import type {
  AccessControl,
  SensitiveInfoOptions,
} from './sensitive-info.nitro'

export const DEFAULT_SERVICE = 'default'
export const DEFAULT_ACCESS_CONTROL: AccessControl = 'secureEnclaveBiometry'

/**
 * Normalizes user provided options by applying sensible defaults and pruning `undefined` values.
 * Enables tree-shaking by keeping this as a pure function.
 */
export function normalizeOptions(
  options?: SensitiveInfoOptions
): SensitiveInfoOptions {
  if (options == null) {
    return {
      service: DEFAULT_SERVICE,
      accessControl: DEFAULT_ACCESS_CONTROL,
    }
  }
  return {
    service: options.service ?? DEFAULT_SERVICE,
    accessControl: options.accessControl ?? DEFAULT_ACCESS_CONTROL,
    iosSynchronizable: options.iosSynchronizable,
    keychainGroup: options.keychainGroup,
    authenticationPrompt: options.authenticationPrompt,
  }
}
