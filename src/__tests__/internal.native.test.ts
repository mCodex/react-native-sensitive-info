jest.mock('react-native-nitro-modules');

const {
  __resetMocks,
  getHybridObjectConstructor,
  MockHybridObject,
} = require('react-native-nitro-modules');

describe('internal/native', () => {
  beforeEach(() => {
    jest.resetModules();
    __resetMocks();
  });

  it('memoises the native instance', () => {
    const { default: getNativeInstance } = require('../internal/native');
    const first = getNativeInstance();
    const second = getNativeInstance();

    expect(first).toBe(second);
  });

  it('creates a fresh instance after module reset', () => {
    const { default: loadA } = require('../internal/native');
    const first = loadA();

    jest.resetModules();
    __resetMocks();

    const { default: loadB } = require('../internal/native');
    const second = loadB();

    expect(second).not.toBe(first);
  });
});
