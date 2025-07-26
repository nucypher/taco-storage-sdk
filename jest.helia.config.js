/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/__tests__/adapters/helia/helia-unit.test.ts'],
  collectCoverageFrom: ['src/adapters/ipfs/helia.ts'],
  testTimeout: 60000,
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  maxWorkers: 1,
  forceExit: true,
  detectOpenHandles: true,
  // Mock ES modules
  moduleNameMapper: {
    '^multiformats/cid$':
      '<rootDir>/src/__tests__/__mocks__/multiformats/cid.ts',
    '^helia$': '<rootDir>/src/__tests__/__mocks__/helia.ts',
    '^@helia/unixfs$': '<rootDir>/src/__tests__/__mocks__/@helia/unixfs.ts',
  },
  // Skip problematic modules for now
  modulePathIgnorePatterns: [
    '<rootDir>/src/__tests__/adapters/helia/helia.test.ts',
  ],
};
