import { renderHook, act } from '@testing-library/react-hooks';
import { useSensitiveInfo, useBiometricAuth } from '../src/hooks';

jest.mock('../src/api', () => ({
  getItem: jest.fn(async (key) => ({
    value: key === 'exists' ? 'value' : null,
  })),
  setItem: jest.fn(async () => ({ value: { success: true } })),
  deleteItem: jest.fn(async () => ({ value: { success: true } })),
  authenticate: jest.fn(async () => ({ value: { success: true } })),
}));

describe('useSensitiveInfo', () => {
  it('should get and set value', async () => {
    const { result } = renderHook(() => useSensitiveInfo('exists'));
    await act(async () => {
      await result.current.get();
    });
    expect(result.current.value).toBe('value');
    await act(async () => {
      await result.current.set('newValue');
    });
    expect(result.current.error).toBeNull();
  });

  it('should delete value', async () => {
    const { result } = renderHook(() => useSensitiveInfo('exists'));
    await act(async () => {
      await result.current.del();
    });
    expect(result.current.value).toBeNull();
  });
});

describe('useBiometricAuth', () => {
  it('should authenticate', async () => {
    const { result } = renderHook(() => useBiometricAuth());
    await act(async () => {
      await result.current.authenticate();
    });
    expect(result.current.success).toBe(true);
  });
});
