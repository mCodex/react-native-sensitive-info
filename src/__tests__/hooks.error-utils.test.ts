import createHookError from '../hooks/error-utils'

describe('hooks/error-utils', () => {
  it('wraps errors with helpful context', () => {
    const cause = new Error('Access denied')
    const error = createHookError(
      'useSecureStorage.fetchItems',
      cause,
      'Provide a valid service name.'
    )

    expect(error.name).toBe('HookError')
    expect(error.message).toContain('useSecureStorage.fetchItems')
    expect(error.cause).toBe(cause)
    expect(error.hint).toBe('Provide a valid service name.')
  })
})
