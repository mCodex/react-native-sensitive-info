const path = require('path');

module.exports = {
  dependencies: {
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
