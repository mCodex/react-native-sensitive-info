import type {
  HybridView,
  HybridViewMethods,
  HybridViewProps,
} from 'react-native-nitro-modules';

export interface BiometricPromptProps extends HybridViewProps {
  promptTitle?: string;
  promptSubtitle?: string;
  promptDescription?: string;
  cancelButtonText?: string;
  allowDeviceCredential?: boolean;
}

export interface BiometricPromptMethods extends HybridViewMethods {
  show(): Promise<boolean>;
}

export type BiometricPromptView = HybridView<
  BiometricPromptProps,
  BiometricPromptMethods
>;
