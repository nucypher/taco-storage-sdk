/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/__tests__/adapters/kubo/kubo.integration.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/node_modules/'],
  collectCoverageFrom: ['src/adapters/ipfs/kubo.ts'],
  testTimeout: 60000, // Longer timeout for real IPFS operations
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  maxWorkers: 1,
  forceExit: true,
  detectOpenHandles: true,
  // NO MOCKING - use real kubo-rpc-client for integration tests
};
