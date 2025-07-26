/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/__tests__/adapters/helia/helia.integration.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/node_modules/'],
  collectCoverageFrom: ['src/adapters/ipfs/helia.ts'],
  testTimeout: 90000, // Extended timeout for Helia node operations
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  maxWorkers: 1,
  forceExit: true,
  detectOpenHandles: true,
  // ES Module support
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  // NO MOCKING - use real Helia for integration tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  // Ignore mocks directory for integration tests
  modulePathIgnorePatterns: [
    '<rootDir>/src/__tests__/__mocks__'
  ]
};
