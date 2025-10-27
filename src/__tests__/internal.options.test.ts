import {
  DEFAULT_ACCESS_CONTROL,
  DEFAULT_SERVICE,
  normalizeOptions,
} from '../internal/options'

describe('internal/options', () => {
  it('returns defaults when no options are provided', () => {
    expect(normalizeOptions()).toEqual({
      service: DEFAULT_SERVICE,
      accessControl: DEFAULT_ACCESS_CONTROL,
    })
  })

  it('applies defaults while preserving provided values', () => {
    expect(
      normalizeOptions({
        service: 'custom',
        iosSynchronizable: true,
      })
    ).toEqual({
      service: 'custom',
      accessControl: DEFAULT_ACCESS_CONTROL,
      iosSynchronizable: true,
    })
  })

  it('propagates optional fields verbatim', () => {
    const prompt = {
      title: 'Authenticate',
      description: 'Custom prompt',
      cancel: 'Abort',
    }
    expect(
      normalizeOptions({
        accessControl: 'biometryAny',
        keychainGroup: 'group.shared',
        authenticationPrompt: prompt,
      })
    ).toEqual({
      service: DEFAULT_SERVICE,
      accessControl: 'biometryAny',
      keychainGroup: 'group.shared',
      authenticationPrompt: prompt,
    })
  })
})
