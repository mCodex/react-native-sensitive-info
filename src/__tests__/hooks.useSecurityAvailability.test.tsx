import { act, renderHook } from '@testing-library/react';
import { waitFor } from '@testing-library/dom';
import { getSupportedSecurityLevels } from '../core/storage';
import { useSecurityAvailability } from '../hooks/useSecurityAvailability';
import { HookError } from '../hooks/types';

jest.mock('../core/storage', () => ({
  ...jest.requireActual('../core/storage'),
  getSupportedSecurityLevels: jest.fn(),
}));

const mockedGetSupportedSecurityLevels =
  getSupportedSecurityLevels as jest.MockedFunction<
    typeof getSupportedSecurityLevels
  >;

describe('useSecurityAvailability', () => {
  beforeEach(() => {
    mockedGetSupportedSecurityLevels.mockReset();
  });

  it('loads and caches the security capabilities', async () => {
    mockedGetSupportedSecurityLevels.mockResolvedValueOnce({
      secureEnclave: true,
      strongBox: false,
      biometry: true,
      deviceCredential: true,
    });

    const { result } = renderHook(() => useSecurityAvailability());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual({
      secureEnclave: true,
      strongBox: false,
      biometry: true,
      deviceCredential: true,
    });
    expect(result.current.error).toBeNull();
    expect(mockedGetSupportedSecurityLevels).toHaveBeenCalledTimes(1);
  });

  it('wraps native errors as HookError', async () => {
    mockedGetSupportedSecurityLevels.mockRejectedValueOnce(
      new Error('native failure')
    );

    const { result } = renderHook(() => useSecurityAvailability());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(HookError);
    expect(result.current.error?.message).toContain(
      'useSecurityAvailability.fetch'
    );
  });

  it('refetch forces a fresh request even when cached', async () => {
    mockedGetSupportedSecurityLevels
      .mockResolvedValueOnce({
        secureEnclave: true,
        strongBox: false,
        biometry: true,
        deviceCredential: true,
      })
      .mockResolvedValueOnce({
        secureEnclave: false,
        strongBox: true,
        biometry: true,
        deviceCredential: true,
      });

    const { result } = renderHook(() => useSecurityAvailability());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.strongBox).toBe(false);

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.data?.strongBox).toBe(true));
    expect(mockedGetSupportedSecurityLevels).toHaveBeenCalledTimes(2);
  });
});
