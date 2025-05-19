import { useCallback, useState } from 'react';
import type {
  SensitiveInfo,
  SensitiveInfoOptions,
} from './SensitiveInfo.nitro';
import type { SensitiveInfoResult } from './types';

import { NitroModules } from 'react-native-nitro-modules';
export const SensitiveInfoHybridObject =
  NitroModules.createHybridObject<SensitiveInfo>('SensitiveInfo');

// Unified API with automatic biometric detection and result objects
export async function setItem(
  key: string,
  value: string,
  options?: SensitiveInfoOptions
): Promise<SensitiveInfoResult<{ success: true }>> {
  try {
    // Store a metadata flag for biometric
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
    // Automatic biometric detection
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
    // Only pass promptOptions to native authenticate
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

// React Hooks
export function useSensitiveInfo(key: string, options?: SensitiveInfoOptions) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // const stableOptions = JSON.stringify(options);
  const get = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getItem(key, options);
    setValue(result.value ?? null);
    if (result.error) setError(result.error.message);
    setLoading(false);
    return result;
  }, [key, options]);

  const set = useCallback(
    async (val: string, opts?: SensitiveInfoOptions) => {
      setLoading(true);
      setError(null);
      const result = await setItem(key, val, opts ?? options);
      if (result.error) setError(result.error.message);
      setLoading(false);
      return result;
    },
    [key, options]
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

export function useBiometricAuth(options?: SensitiveInfoOptions) {
  const [success, setSuccess] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // const stableOptions = JSON.stringify(options);
  const authenticateFn = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await authenticate(options);
    setSuccess(result.value?.success ?? false);
    if (result.error) setError(result.error.message);
    setLoading(false);
    return result;
  }, [options]);

  return { success, error, loading, authenticate: authenticateFn };
}
