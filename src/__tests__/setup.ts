/**
 * Test setup and utilities
 */

import { ethers } from 'ethers';

// Global test setup
beforeAll(async () => {
  // Setup global mocks
});

afterAll(async () => {
  // Any global cleanup needed for tests
});

// Test utilities
export const TEST_TIMEOUT = 30000; // 30 seconds

export const createMockProvider = (): ethers.providers.Provider => ({
  getNetwork: jest.fn().mockResolvedValue({ chainId: 1 }),
  getBlockNumber: jest.fn().mockResolvedValue(12345),
  getBalance: jest.fn().mockResolvedValue(ethers.utils.parseEther('1.0')),
} as unknown as ethers.providers.Provider);

export const createMockSigner = (): ethers.Signer => ({
  getAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
  signMessage: jest.fn().mockResolvedValue('mock-signature'),
  connect: jest.fn().mockReturnThis(),
} as unknown as ethers.Signer);

export const createMockEncryptionResult = () => ({
  messageKit: [1, 2, 3, 4, 5, 6, 7, 8],
  conditions: [{
    type: 'time',
    endTime: Math.floor(Date.now() / 1000) + 3600,
  }],
});

// Mock data generators
export const generateTestData = (size: number = 100): string => {
  return 'x'.repeat(size);
};

export const generateBinaryTestData = (size: number = 100): Uint8Array => {
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    data[i] = i % 256;
  }
  return data;
};

// Common test constants
export const TEST_ADDRESSES = {
  VALID_ETH_ADDRESS: '0x1234567890123456789012345678901234567890',
  VALID_CONTRACT_ADDRESS: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
};

export const MOCK_IPFS_HASH = 'QmTestHash1234567890';
export const MOCK_IPFS_REFERENCE = `ipfs://${MOCK_IPFS_HASH}`;

// Cleanup helper
export const cleanupTempFiles = (files: string[]) => {
  files.forEach(file => {
    try {
      const fs = require('fs');
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });
};

export const createTestData = (size = 1024): Uint8Array => {
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    data[i] = i % 256;
  }
  return data;
};
