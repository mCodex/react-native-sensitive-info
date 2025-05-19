import { useReducer } from 'react';

export type SensitiveState<T = any> = {
  value: T;
  error: string | null;
  loading: boolean;
};

export type SensitiveAction<T = any> =
  | { type: 'start' }
  | { type: 'success'; value: T }
  | { type: 'error'; error: string }
  | { type: 'reset' };

export function sensitiveReducer<T = any>(
  state: SensitiveState<T>,
  action: SensitiveAction<T>
): SensitiveState<T> {
  switch (action.type) {
    case 'start':
      return { ...state, loading: true, error: null };
    case 'success':
      return { value: action.value, error: null, loading: false };
    case 'error':
      return { ...state, error: action.error, loading: false };
    case 'reset':
      return { value: null as any, error: null, loading: false };
    default:
      return state;
  }
}

export function useSensitiveReducer<T = any>(initialValue: T) {
  return useReducer(sensitiveReducer<T>, {
    value: initialValue,
    error: null,
    loading: false,
  });
}
