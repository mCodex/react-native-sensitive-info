import {
  HookError,
  createInitialAsyncState,
  createInitialVoidState,
} from '../hooks/types';

describe('hooks/types', () => {
  it('constructs HookError with metadata', () => {
    const cause = new Error('native failure');
    const error = new HookError('Wrapper message', {
      cause,
      operation: 'useSecret.save',
      hint: 'Check the key.',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.cause).toBe(cause);
    expect(error.operation).toBe('useSecret.save');
    expect(error.hint).toBe('Check the key.');
  });

  it('creates the initial async state', () => {
    const state = createInitialAsyncState<string>();
    expect(state).toEqual({
      data: null,
      error: null,
      isLoading: true,
      isPending: false,
    });
  });

  it('creates the initial void async state', () => {
    const state = createInitialVoidState();
    expect(state).toEqual({
      error: null,
      isLoading: false,
      isPending: false,
    });
  });
});
