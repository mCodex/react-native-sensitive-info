import * as Storage from '../index';

// Mock native hybrid object
const mockHybrid = {
  getItem: jest.fn(async (key: string) => (key === 'foo' ? 'bar' : null)),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
  getAllItems: jest.fn(async () => ({ foo: 'bar' })),
  clear: jest.fn(async () => {}),
};
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: { createHybridObject: () => mockHybrid },
}));

describe('react-native-sensitive-info API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retrieves stored value', async () => {
    const result = await Storage.getItem('foo');
    expect(mockHybrid.getItem).toHaveBeenCalledWith('foo');
    expect(result).toBe('bar');
  });

  it('sets a value', async () => {
    await Storage.setItem('key', 'value');
    expect(mockHybrid.setItem).toHaveBeenCalledWith('key', 'value');
  });

  it('removes a value', async () => {
    await Storage.removeItem('key');
    expect(mockHybrid.removeItem).toHaveBeenCalledWith('key');
  });

  it('gets all items', async () => {
    const all = await Storage.getAllItems();
    expect(mockHybrid.getAllItems).toHaveBeenCalled();
    expect(all).toEqual({ foo: 'bar' });
  });

  it('clears storage', async () => {
    await Storage.clear();
    expect(mockHybrid.clear).toHaveBeenCalled();
  });
});
