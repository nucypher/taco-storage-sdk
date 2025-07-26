/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/__tests__/adapters/kubo/kubo.unit.test.ts'],
  collectCoverageFrom: ['src/adapters/ipfs/kubo.ts'],
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  maxWorkers: 1,
  forceExit: true,
  detectOpenHandles: true,
  // Mock ES modules for unit testing
  moduleNameMapper: {
    '^kubo-rpc-client$': '<rootDir>/src/__tests__/__mocks__/kubo-rpc-client.ts',
  },
};
