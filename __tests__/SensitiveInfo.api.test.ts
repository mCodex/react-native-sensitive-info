import * as SensitiveInfo from '../src/index';

describe('SensitiveInfo API', () => {
  it('should store and retrieve a value with result object', async () => {
    const setResult = await SensitiveInfo.setItem('testKey', 'testValue');
    expect(setResult.value?.success).toBe(true);
    const getResult = await SensitiveInfo.getItem('testKey');
    expect(getResult.value).toBe('testValue');
    expect(getResult.error).toBeUndefined();
  });

  it('should delete a value and its metadata', async () => {
    await SensitiveInfo.setItem('deleteKey', 'toDelete');
    const delResult = await SensitiveInfo.deleteItem('deleteKey');
    expect(delResult.value?.success).toBe(true);
    const getResult = await SensitiveInfo.getItem('deleteKey');
    expect(getResult.value).toBeNull();
  });

  it('should handle errors gracefully', async () => {
    // Simulate error by passing invalid key (if native throws)
    const getResult = await SensitiveInfo.getItem(undefined as any);
    expect(getResult.error).toBeDefined();
  });

  it('should check biometric availability', async () => {
    const available = await SensitiveInfo.isBiometricAvailable();
    expect(typeof available).toBe('boolean');
  });

  it('should support biometric authentication prompt', async () => {
    const result = await SensitiveInfo.authenticate({
      promptOptions: { reason: 'Test' },
    });
    expect(typeof result.value?.success).toBe('boolean');
  });
});
