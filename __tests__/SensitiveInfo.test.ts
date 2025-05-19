import { SensitiveInfoHybridObject } from '../src/index';

describe('SensitiveInfo', () => {
  it('should store and retrieve a value', async () => {
    await SensitiveInfoHybridObject.setItem('testKey', 'testValue');
    const value = await SensitiveInfoHybridObject.getItem('testKey');
    expect(value).toBe('testValue');
  });

  it('should delete a value', async () => {
    await SensitiveInfoHybridObject.setItem('deleteKey', 'toDelete');
    await SensitiveInfoHybridObject.deleteItem('deleteKey');
    const value = await SensitiveInfoHybridObject.getItem('deleteKey');
    expect(value).toBeNull();
  });

  it('should check biometric availability', async () => {
    const available = await SensitiveInfoHybridObject.isBiometricAvailable();
    expect(typeof available).toBe('boolean');
  });

  it('should support biometric authentication prompt', async () => {
    // This test is a placeholder; biometric prompt requires user interaction
    // and should be tested with e2e/manual tests.
    expect(typeof SensitiveInfoHybridObject.authenticate).toBe('function');
  });
});
