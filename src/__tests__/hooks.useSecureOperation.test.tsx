import { act, renderHook } from '@testing-library/react';
import { HookError } from '../hooks/types';
import { useSecureOperation } from '../hooks/useSecureOperation';

describe('useSecureOperation', () => {
  it('reports success when the callback resolves', async () => {
    const { result } = renderHook(() => useSecureOperation());

    await act(async () => {
      await result.current.execute(async () => {
        await Promise.resolve();
      });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPending).toBe(false);
  });

  it('wraps thrown errors in HookError', async () => {
    const { result } = renderHook(() => useSecureOperation());

    await act(async () => {
      await result.current.execute(async () => {
        throw new Error('boom');
      });
    });

    expect(result.current.error).toBeInstanceOf(HookError);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPending).toBe(false);
    expect(result.current.error?.message).toContain(
      'useSecureOperation.execute'
    );
  });
});
