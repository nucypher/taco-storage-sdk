const { pathsToModuleNameMapper } = require('ts-jest');
const { resolve } = require('path');

module.exports = (path, options) => {
  // Handle ES modules
  if (path.startsWith('multiformats/')) {
    return options.defaultResolver(path, {
      ...options,
      packageFilter: (pkg) => {
        if (pkg.name === 'multiformats') {
          pkg.main = pkg.exports?.['.'] || pkg.main;
        }
        return pkg;
      },
    });
  }

  return options.defaultResolver(path, options);
};
