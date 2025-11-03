import type {
  AccessControl,
  SensitiveInfoOptions,
} from '../sensitive-info.nitro';

export const DEFAULT_SERVICE = 'default';
export const DEFAULT_ACCESS_CONTROL: AccessControl = 'secureEnclaveBiometry';

/**
 * Normalises user supplied options by applying defaults and pruning `undefined` fields.
 */
export function normalizeOptions(
  options?: SensitiveInfoOptions
): SensitiveInfoOptions {
  if (options == null) {
    return {
      service: DEFAULT_SERVICE,
      accessControl: DEFAULT_ACCESS_CONTROL,
    };
  }

  const {
    service = DEFAULT_SERVICE,
    accessControl = DEFAULT_ACCESS_CONTROL,
    iosSynchronizable,
    keychainGroup,
    authenticationPrompt,
  } = options;

  return {
    service,
    accessControl,
    iosSynchronizable,
    keychainGroup,
    authenticationPrompt,
  };
}
