import { act, renderHook } from '@testing-library/react';
import { deleteItem, setItem } from '../core/storage';
import { HookError } from '../hooks/types';
import { useSecret } from '../hooks/useSecret';
import { useSecretItem } from '../hooks/useSecretItem';

jest.mock('../hooks/useSecretItem');

jest.mock('../core/storage', () => ({
  ...jest.requireActual('../core/storage'),
  setItem: jest.fn(),
  deleteItem: jest.fn(),
}));

const mockedUseSecretItem = useSecretItem as jest.MockedFunction<
  typeof useSecretItem
>;
const mockedSetItem = setItem as jest.MockedFunction<typeof setItem>;
const mockedDeleteItem = deleteItem as jest.MockedFunction<typeof deleteItem>;

describe('useSecret', () => {
  const baseResult = {
    data: null,
    error: null,
    isLoading: false,
    isPending: false,
  };

  beforeEach(() => {
    mockedSetItem.mockReset();
    mockedDeleteItem.mockReset();
    mockedUseSecretItem.mockReset();
  });

  it('proxys data from useSecretItem', () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    mockedUseSecretItem.mockReturnValueOnce({
      ...baseResult,
      data: { key: 'token', service: 'auth', metadata: {} as any },
      refetch,
    });

    const { result } = renderHook(() =>
      useSecret('token', { service: 'auth', includeValue: true })
    );

    expect(result.current.data?.key).toBe('token');
    expect(result.current.refetch).toBe(refetch);
  });

  it('saves secrets and triggers refetch', async () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    mockedUseSecretItem.mockReturnValue({ ...baseResult, refetch });
    mockedSetItem.mockResolvedValue({ metadata: {} as any });

    const { result } = renderHook(() =>
      useSecret('token', {
        service: 'auth',
        includeValue: true,
        skip: true,
      })
    );

    await act(async () => {
      const outcome = await result.current.saveSecret('secret');
      expect(outcome).toEqual({ success: true });
    });

    expect(mockedSetItem).toHaveBeenCalledWith('token', 'secret', {
      service: 'auth',
    });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('wraps save errors as HookError', async () => {
    const refetch = jest.fn();
    mockedUseSecretItem.mockReturnValue({ ...baseResult, refetch });
    mockedSetItem.mockRejectedValueOnce(new Error('save failed'));

    const { result } = renderHook(() =>
      useSecret('token', { service: 'auth', includeValue: true })
    );

    let response: { success: boolean; error?: HookError } | undefined;
    await act(async () => {
      response = await result.current.saveSecret('secret');
    });

    expect(response).toEqual({ success: false, error: expect.any(HookError) });
    expect(refetch).not.toHaveBeenCalled();
  });

  it('deletes secrets and triggers refetch', async () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    mockedUseSecretItem.mockReturnValue({ ...baseResult, refetch });
    mockedDeleteItem.mockResolvedValue(true);

    const { result } = renderHook(() =>
      useSecret('token', {
        service: 'auth',
        includeValue: true,
      })
    );

    await act(async () => {
      const outcome = await result.current.deleteSecret();
      expect(outcome).toEqual({ success: true });
    });

    expect(mockedDeleteItem).toHaveBeenCalledWith('token', { service: 'auth' });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('wraps delete errors as HookError', async () => {
    const refetch = jest.fn();
    mockedUseSecretItem.mockReturnValue({ ...baseResult, refetch });
    mockedDeleteItem.mockRejectedValueOnce(new Error('delete failed'));

    const { result } = renderHook(() =>
      useSecret('token', { service: 'auth' })
    );

    let response: { success: boolean; error?: HookError } | undefined;
    await act(async () => {
      response = await result.current.deleteSecret();
    });

    expect(response).toEqual({ success: false, error: expect.any(HookError) });
    expect(refetch).not.toHaveBeenCalled();
  });
});
