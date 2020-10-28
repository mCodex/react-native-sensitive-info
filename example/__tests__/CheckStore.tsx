import { driver, By2 } from 'selenium-appium'
import { until } from 'selenium-webdriver';

const setup = require('../jest-setups/jest.setup');
jest.setTimeout(60000);

beforeAll(() => {
  return driver.startWithCapabilities(setup.capabilites);
});

afterAll(() => {
  return driver.quit();
});

describe('Test App', () => {

  test('Log present', async () => {
    // Get the element by label, will fail if the element is not present
    // We will look for the expected log from the app
    await driver.wait(until.elementLocated(By2.nativeName('setItem(key1, value1): value1\nsetItem(key2, value2): value2\nsetItem(key3, value3): value3\ngetItem(key2): value2\ndelItem(key2): key2\ngetAllItems():\n - key1 : value1\n - key3 : value3\n')));
  });

})