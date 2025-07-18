const path = require('path');
const pkg = require('../package.json');

module.exports = {
  project: {
    ios: {
      automaticPodsInstallation: true,
    },
  },
  dependencies: {
    [pkg.name]: {
      root: path.join(__dirname, '..'),
      platforms: {
        // Codegen script incorrectly fails without this
        // So we explicitly specify the platforms with empty object
        ios: {},
        android: {},
      },
    },
    // Ensure the core Nitro modules package is autolinked
    'react-native-nitro-modules': {
      root: path.resolve(
        __dirname,
        'node_modules',
        'react-native-nitro-modules'
      ),
      platforms: {
        ios: {},
        android: {},
      },
    },
  },
};
