const path = require('path');

const extraNodeModules = {
  'react-native-sensitive-info': path.resolve(__dirname + '/../'),
};
const watchFolders = [path.resolve(__dirname + '/../')];

module.exports = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  },
  resolver: {
    extraNodeModules,
  },
  watchFolders,
};
