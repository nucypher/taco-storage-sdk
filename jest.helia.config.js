/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/__tests__/adapters/helia/helia.test.ts'],
  collectCoverageFrom: [
    'src/adapters/ipfs/helia.ts',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(helia|@helia|@libp2p|@multiformats|multiformats|uint8arrays|protons|it-|ipfs-utils)/)',
  ],
  testTimeout: 120000, // 2 minutes for Helia node startup
  moduleNameMapping: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
};
