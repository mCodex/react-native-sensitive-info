import { useCallback } from 'react';
import { useSensitiveReducer } from './useSensitiveReducer';
import { authenticate } from './api';

// Rename to useHasBiometricAuth to follow React hook naming convention
export const useHasBiometricAuth = (options?: any) => {
  const [state, dispatch] = useSensitiveReducer<boolean | null>(null);

  const authenticateFn = useCallback(async () => {
    dispatch({ type: 'start' });
    const result = await authenticate(options);
    if (result.error) dispatch({ type: 'error', error: result.error.message });
    else dispatch({ type: 'success', value: result.value?.success ?? false });
    return result;
  }, [options, dispatch]);

  return {
    success: state.value,
    error: state.error,
    loading: state.loading,
    authenticate: authenticateFn,
  };
};
