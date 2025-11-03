import { act, renderHook } from '@testing-library/react';
import { waitFor } from '@testing-library/dom';
import { HookError } from '../hooks/types';
import { useHasSecret } from '../hooks/useHasSecret';
import { hasItem } from '../core/storage';

jest.mock('../core/storage', () => ({
  ...jest.requireActual('../core/storage'),
  hasItem: jest.fn(),
}));

const mockedHasItem = hasItem as jest.MockedFunction<typeof hasItem>;

describe('useHasSecret', () => {
  beforeEach(() => {
    mockedHasItem.mockReset();
  });

  it('returns the existence flag', async () => {
    mockedHasItem.mockResolvedValueOnce(true);

    const { result } = renderHook(
      ({ opts }: { opts: Parameters<typeof useHasSecret>[1] }) =>
        useHasSecret('token', opts),
      {
        initialProps: { opts: { service: 'auth' } },
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBe(true);
    expect(result.current.error).toBeNull();
    expect(mockedHasItem).toHaveBeenCalledWith('token', { service: 'auth' });
  });

  it('skips querying when requested', async () => {
    const { result } = renderHook(
      ({ opts }: { opts: Parameters<typeof useHasSecret>[1] }) =>
        useHasSecret('token', opts),
      {
        initialProps: { opts: { skip: true } },
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(mockedHasItem).not.toHaveBeenCalled();
  });

  it('wraps errors as HookError', async () => {
    mockedHasItem.mockRejectedValueOnce(new Error('Native failure'));

    const { result } = renderHook(
      ({ opts }: { opts: Parameters<typeof useHasSecret>[1] }) =>
        useHasSecret('token', opts),
      {
        initialProps: { opts: { service: 'auth' } },
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(HookError);
    expect(result.current.error?.message).toContain('useHasSecret.evaluate');
  });

  it('supports manual refetching', async () => {
    mockedHasItem.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const { result } = renderHook(
      ({ opts }: { opts: Parameters<typeof useHasSecret>[1] }) =>
        useHasSecret('token', opts),
      {
        initialProps: { opts: { service: 'auth' } },
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBe(false);

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.data).toBe(true));
    expect(mockedHasItem).toHaveBeenCalledTimes(2);
  });
});
