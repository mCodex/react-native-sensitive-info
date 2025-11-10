import type { AccessControl } from 'react-native-sensitive-info';

export type ModeKey = 'open' | 'biometric';

export interface AccessMode {
  readonly key: ModeKey;
  readonly label: string;
  readonly description: string;
  readonly accessControl: AccessControl;
}

export const ACCESS_MODES: AccessMode[] = [
  {
    key: 'open',
    label: 'No Lock',
    description: 'Stores the value without requiring authentication.',
    accessControl: 'none',
  },
  {
    key: 'biometric',
    label: 'Biometric Lock',
    description: 'Requires the current biometric enrollment to unlock.',
    accessControl: 'biometryCurrentSet',
  },
];

export const DEFAULT_SERVICE = 'demo-safe';
export const DEFAULT_KEY = 'favorite-color';
export const DEFAULT_SECRET = 'ultramarine';
export const INITIAL_STATUS = 'Ready to tuck away a secret.';
