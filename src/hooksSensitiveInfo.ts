import { useCallback, useReducer } from 'react';
import type { SensitiveInfoOptions } from './SensitiveInfo.nitro';
import { getItem, setItem, deleteItem } from './api';

type State = {
  value: string | null;
  error: string | null;
  loading: boolean;
};

type Action =
  | { type: 'start' }
  | { type: 'success'; value: string | null }
  | { type: 'error'; error: string }
  | { type: 'reset' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'start':
      return { ...state, loading: true, error: null };
    case 'success':
      return { value: action.value, error: null, loading: false };
    case 'error':
      return { ...state, error: action.error, loading: false };
    case 'reset':
      return { value: null, error: null, loading: false };
    default:
      return state;
  }
}

export function useSensitiveInfo(key: string, options?: SensitiveInfoOptions) {
  const [state, dispatch] = useReducer(reducer, {
    value: null,
    error: null,
    loading: false,
  });

  const get = useCallback(async () => {
    dispatch({ type: 'start' });
    const result = await getItem(key, options);
    if (result.error) dispatch({ type: 'error', error: result.error.message });
    else dispatch({ type: 'success', value: result.value ?? null });
    return result;
  }, [key, options]);

  const set = useCallback(
    async (val: string, opts?: SensitiveInfoOptions) => {
      dispatch({ type: 'start' });
      const result = await setItem(key, val, opts ?? options);
      if (result.error)
        dispatch({ type: 'error', error: result.error.message });
      else dispatch({ type: 'success', value: val });
      return result;
    },
    [key, options]
  );

  const del = useCallback(async () => {
    dispatch({ type: 'start' });
    const result = await deleteItem(key);
    if (result.error) dispatch({ type: 'error', error: result.error.message });
    else dispatch({ type: 'reset' });
    return result;
  }, [key]);

  return { ...state, get, set, del };
}
