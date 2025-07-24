module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 30000,
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\.ts$': ['ts-jest', {
      useESM: true
    }]
  },
  // Transform IPFS-related ES modules for Jest compatibility  
  transformIgnorePatterns: [
    'node_modules/(?!(kubo-rpc-client|@helia|@multiformats|multiformats|uint8arrays|ipfs-core-utils|@ipld|blockstore-core|interface-blockstore|interface-datastore|datastore-core|blockstore-fs|it-all|it-map|it-pipe|it-take|merge-options|p-defer|p-queue|timeout-abort-controller|abortable-iterator)/)'
  ],
  moduleNameMapper: {
    '^(\./.*)\.js$': '$1'
  },
  roots: ['<rootDir>/src'],
  // Only run IPFS tests
  testMatch: [
    '**/adapters/ipfs.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ]
};
