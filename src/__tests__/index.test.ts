import defaultExport, {
  SensitiveInfo,
  clearService,
  getAllItems,
  getItem,
  getSupportedSecurityLevels,
  hasItem,
  setItem,
  useHasSecret,
  useSecret,
  useSecretItem,
  useSecureOperation,
  useSecureStorage,
  useSecurityAvailability,
} from '../index';

describe('package entrypoint', () => {
  it('re-exports the storage helpers', () => {
    expect(defaultExport).toBe(SensitiveInfo);
    expect(typeof setItem).toBe('function');
    expect(typeof getItem).toBe('function');
    expect(typeof getAllItems).toBe('function');
    expect(typeof clearService).toBe('function');
    expect(typeof getSupportedSecurityLevels).toBe('function');
    expect(typeof hasItem).toBe('function');
  });

  it('exposes the hook surface area', () => {
    expect(typeof useSecretItem).toBe('function');
    expect(typeof useHasSecret).toBe('function');
    expect(typeof useSecret).toBe('function');
    expect(typeof useSecureStorage).toBe('function');
    expect(typeof useSecureOperation).toBe('function');
    expect(typeof useSecurityAvailability).toBe('function');
  });
});
