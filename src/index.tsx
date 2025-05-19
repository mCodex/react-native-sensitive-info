import { useCallback, useState } from 'react';
import type { SensitiveInfo } from './SensitiveInfo.nitro';
import type { SensitiveInfoResult } from './types';

import { NitroModules } from 'react-native-nitro-modules';

export const SensitiveInfoHybridObject =
  NitroModules.createHybridObject<SensitiveInfo>('SensitiveInfo');

export async function setItem(
  key: string,
  value: string,
  biometric?: boolean,
  sharedPreferencesName?: string,
  keychainService?: string
): Promise<SensitiveInfoResult<{ success: true }>> {
  try {
    // Store a metadata flag for biometric
    await SensitiveInfoHybridObject.setItem(
      `__meta__${key}`,
      biometric ? 'biometric' : 'none',
      false,
      sharedPreferencesName ?? '',
      keychainService ?? ''
    );
    await SensitiveInfoHybridObject.setItem(
      key,
      value,
      biometric ?? false,
      sharedPreferencesName ?? '',
      keychainService ?? ''
    );
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
  sharedPreferencesName?: string,
  keychainService?: string
): Promise<SensitiveInfoResult<string | null>> {
  try {
    // Automatic biometric detection
    const meta = await SensitiveInfoHybridObject.getItem(
      `__meta__${key}`,
      false,
      sharedPreferencesName ?? '',
      keychainService ?? ''
    );
    const biometricFlag = meta === 'biometric';
    const result = await SensitiveInfoHybridObject.getItem(
      key,
      biometricFlag,
      sharedPreferencesName ?? '',
      keychainService ?? ''
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
  prompt?: string
): Promise<SensitiveInfoResult<{ success: boolean }>> {
  try {
    const result = await SensitiveInfoHybridObject.authenticate(prompt ?? '');
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

// React Hooks
export function useSensitiveInfo(
  key: string,
  biometric?: boolean,
  sharedPreferencesName?: string,
  keychainService?: string
) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const get = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await getItem(key);

    setValue(result.value ?? null);
    if (result.error) setError(result.error.message);
    setLoading(false);
    return result;
  }, [key]);

  const set = useCallback(
    async (
      val: string,
      biometricArg?: boolean,
      sharedPreferencesNameArg?: string,
      keychainServiceArg?: string
    ) => {
      setLoading(true);
      setError(null);
      const result = await setItem(
        key,
        val,
        biometricArg ?? biometric,
        sharedPreferencesNameArg ?? sharedPreferencesName,
        keychainServiceArg ?? keychainService
      );
      if (result.error) setError(result.error.message);
      setLoading(false);
      return result;
    },
    [key, biometric, sharedPreferencesName, keychainService]
  );

  const del = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await deleteItem(key);

    if (result.error) setError(result.error.message);
    setLoading(false);
    setValue(null);
    return result;
  }, [key]);

  return { value, error, loading, get, set, del };
}

export function useBiometricAuth(prompt?: string) {
  const [success, setSuccess] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const authenticateFn = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await authenticate(prompt);
    setSuccess(result.value?.success ?? false);
    if (result.error) setError(result.error.message);
    setLoading(false);
    return result;
  }, [prompt]);

  return { success, error, loading, authenticate: authenticateFn };
}
