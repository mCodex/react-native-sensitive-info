export class MockHybridObject {
  static instances: MockHybridObject[] = []

  constructor() {
    MockHybridObject.instances.push(this)
  }
}

export const getHybridObjectConstructor = jest
  .fn(() => MockHybridObject)
  .mockName('getHybridObjectConstructor')

export const __resetMocks = () => {
  MockHybridObject.instances = []
  getHybridObjectConstructor.mockReset()
  getHybridObjectConstructor.mockReturnValue(MockHybridObject)
}

__resetMocks()

export default {
  getHybridObjectConstructor,
}
