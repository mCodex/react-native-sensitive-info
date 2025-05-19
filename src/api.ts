import type {
  SensitiveInfo,
  SensitiveInfoOptions,
} from './SensitiveInfo.nitro';
import type { SensitiveInfoResult } from './types';
import { NitroModules } from 'react-native-nitro-modules';

export const SensitiveInfoHybridObject =
  NitroModules.createHybridObject<SensitiveInfo>('SensitiveInfo');

export async function setItem(
  key: string,
  value: string,
  options?: SensitiveInfoOptions
): Promise<SensitiveInfoResult<{ success: true }>> {
  try {
    if (options?.biometric) {
      await SensitiveInfoHybridObject.setItem(
        `__meta__${key}`,
        'biometric',
        {}
      );
    } else {
      await SensitiveInfoHybridObject.setItem(`__meta__${key}`, 'none', {});
    }

    await SensitiveInfoHybridObject.setItem(key, value, options);

    return { value: { success: true } };
  } catch (error: any) {
    return {
      error: {
        code: error.code || 'SET_ERROR',
        message: error.message || String(error),
      },
    };
  }
}

export async function getItem(
  key: string,
  options?: SensitiveInfoOptions
): Promise<SensitiveInfoResult<string | null>> {
  try {
    const meta = await SensitiveInfoHybridObject.getItem(`__meta__${key}`);
    const biometric = meta === 'biometric';

    const result = await SensitiveInfoHybridObject.getItem(
      key,
      biometric ? { ...options, biometric: true } : options
    );

    return { value: result };
  } catch (error: any) {
    return {
      error: {
        code: error.code || 'GET_ERROR',
        message: error.message || String(error),
      },
    };
  }
}

export async function deleteItem(
  key: string
): Promise<SensitiveInfoResult<{ success: true }>> {
  try {
    await SensitiveInfoHybridObject.deleteItem(key);
    await SensitiveInfoHybridObject.deleteItem(`__meta__${key}`);

    return { value: { success: true } };
  } catch (error: any) {
    return {
      error: {
        code: error.code || 'DELETE_ERROR',
        message: error.message || String(error),
      },
    };
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  return SensitiveInfoHybridObject.isBiometricAvailable();
}

export async function authenticate(
  options?: SensitiveInfoOptions
): Promise<SensitiveInfoResult<{ success: boolean }>> {
  try {
    const result = await SensitiveInfoHybridObject.authenticate(
      options?.promptOptions
    );

    return { value: { success: result } };
  } catch (error: any) {
    return {
      error: {
        code: error.code || 'AUTH_ERROR',
        message: error.message || String(error),
      },
    };
  }
}
