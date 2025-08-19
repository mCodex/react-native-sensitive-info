// Mock NitroModules before importing the module under test.
// Define the mock within the factory to avoid TDZ issues, and re-export it for assertions.
jest.mock('react-native-nitro-modules', () => {
  const mockHybrid = {
    getItem: jest.fn(async (key: string) => (key === 'foo' ? 'bar' : null)),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
    getAllItems: jest.fn(async () => ({ foo: 'bar' })),
    clear: jest.fn(async () => {}),
  };

  return {
    NitroModules: { createHybridObject: () => mockHybrid },
    __mockHybrid: mockHybrid,
  };
});

import * as Storage from '../index';

describe('react-native-sensitive-info API', () => {
  beforeEach(() => {
    const { __mockHybrid } = jest.requireMock('react-native-nitro-modules');
    jest.clearAllMocks();
    // Ensure all mock functions are reset between tests
    __mockHybrid.getItem.mockClear();
    __mockHybrid.setItem.mockClear();
    __mockHybrid.removeItem.mockClear();
    __mockHybrid.getAllItems.mockClear();
    __mockHybrid.clear.mockClear();
  });

  it('retrieves stored value', async () => {
    const { __mockHybrid: mockHybrid } = jest.requireMock(
      'react-native-nitro-modules'
    );
    const result = await Storage.getItem('foo');
    expect(mockHybrid.getItem).toHaveBeenCalledWith('foo', undefined);
    expect(result).toBe('bar');
  });

  it('sets a value', async () => {
    const { __mockHybrid: mockHybrid } = jest.requireMock(
      'react-native-nitro-modules'
    );
    await Storage.setItem('key', 'value');
    expect(mockHybrid.setItem).toHaveBeenCalledWith('key', 'value', undefined);
  });

  it('removes a value', async () => {
    const { __mockHybrid: mockHybrid } = jest.requireMock(
      'react-native-nitro-modules'
    );
    await Storage.removeItem('key');
    expect(mockHybrid.removeItem).toHaveBeenCalledWith('key', undefined);
  });

  it('gets all items', async () => {
    const { __mockHybrid: mockHybrid } = jest.requireMock(
      'react-native-nitro-modules'
    );
    const all = await Storage.getAllItems();
    expect(mockHybrid.getAllItems).toHaveBeenCalledWith(undefined);
    expect(all).toEqual({ foo: 'bar' });
  });

  it('clears storage', async () => {
    const { __mockHybrid: mockHybrid } = jest.requireMock(
      'react-native-nitro-modules'
    );
    await Storage.clear();
    expect(mockHybrid.clear).toHaveBeenCalledWith(undefined);
  });
});
