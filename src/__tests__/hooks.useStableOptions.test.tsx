import { renderHook } from '@testing-library/react';
import useStableOptions from '../hooks/useStableOptions';

describe('useStableOptions', () => {
  const defaults = { service: 'default', includeValues: false };

  it('merges defaults with provided options', () => {
    const { result } = renderHook(
      ({ options }: { options: Partial<typeof defaults> }) =>
        useStableOptions(defaults, options),
      {
        initialProps: {
          options: { includeValues: true, service: 'custom' },
        },
      }
    );

    expect(result.current).toEqual({
      service: 'custom',
      includeValues: true,
    });
  });

  it('reuses the cached object while options remain stable', () => {
    const { result, rerender } = renderHook(
      ({ options }: { options: Partial<typeof defaults> }) =>
        useStableOptions(defaults, options),
      {
        initialProps: { options: { includeValues: true } },
      }
    );

    const first = result.current;
    rerender({ options: { includeValues: true } });

    expect(result.current).toBe(first);
  });

  it('emits a new object when options change', () => {
    const { result, rerender } = renderHook(
      ({ options }: { options: Partial<typeof defaults> }) =>
        useStableOptions(defaults, options),
      {
        initialProps: { options: { includeValues: true } },
      }
    );

    const first = result.current;
    rerender({ options: { includeValues: false } });

    expect(result.current).not.toBe(first);
    expect(result.current).toEqual({
      service: 'default',
      includeValues: false,
    });
  });
});
