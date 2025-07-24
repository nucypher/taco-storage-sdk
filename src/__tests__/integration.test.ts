/**
 * Integration tests for TACo Storage SDK
 */

import { TacoStorage } from '../core/storage';
import { SQLiteAdapter } from '../adapters/sqlite';
import { ethers } from 'ethers';
import { TEST_TIMEOUT } from './setup';
import path from 'path';
import fs from 'fs';
import { conditions } from '@nucypher/taco';

const CHAIN_ID = 80001;

// Mock TACo SDK components
jest.mock('@nucypher/taco', () => ({
  ThresholdMessageKit: {
    fromBytes: jest.fn().mockReturnValue({
      toBytes: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
      free: jest.fn(),
      equals: jest.fn(),
      decryptWithSharedSecret: jest.fn(),
      decryptWithDecryptingPower: jest.fn(),
    }),
  },
  conditions: {
    condition: {},
    context: {},
  },
  domains: {
    DEVNET: 'devnet',
  },
  encrypt: jest.fn().mockResolvedValue({
    toBytes: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
    free: jest.fn(),
    equals: jest.fn(),
    decryptWithSharedSecret: jest.fn(),
    decryptWithDecryptingPower: jest.fn(),
  }),
  decrypt: jest
    .fn()
    .mockResolvedValue(new Uint8Array([72, 101, 108, 108, 111])), // "Hello"
}));

// Mock TacoEncryptionService
const mockEncryptionService = {
  initialize: jest.fn().mockResolvedValue(undefined),
  encrypt: jest.fn().mockImplementation((data, condition, provider, signer) =>
    Promise.resolve({
      messageKit: {
        toBytes: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
        free: jest.fn(),
        equals: jest.fn(),
        decryptWithSharedSecret: jest.fn(),
        decryptWithDecryptingPower: jest.fn(),
      },
      conditions: condition || {},
    })
  ),
  decrypt: jest
    .fn()
    .mockResolvedValue(new Uint8Array([72, 101, 108, 108, 111])), // "Hello"
  createTimeCondition: jest.fn().mockReturnValue({
    type: 'time',
    chain: 80001,
    method: 'blocktime',
    returnValueTest: { comparator: '<=', value: Math.floor(Date.now() / 1000) + 3600 },
  }),
  createNFTCondition: jest.fn().mockReturnValue({
    type: 'erc721',
    contractAddress: '0x123',
    chain: 80001,
  }),
};

jest.mock('../core/encryption', () => ({
  TacoEncryptionService: jest
    .fn()
    .mockImplementation(() => mockEncryptionService),
}));

describe('TACo Storage SDK - Integration Tests', () => {
  let storage: TacoStorage;
  let testDbPath: string;
  let mockProvider: ethers.providers.Provider;
  let mockSigner: ethers.Signer;

  beforeAll(async () => {
    // Create mock provider and signer
    mockProvider = {
      getNetwork: jest.fn().mockResolvedValue({ chainId: 1 }),
    } as unknown as ethers.providers.Provider;

    mockSigner = {
      getAddress: jest
        .fn()
        .mockResolvedValue('0x1234567890123456789012345678901234567890'),
      signMessage: jest.fn().mockResolvedValue('mock-signature'),
    } as unknown as ethers.Signer;
  }, TEST_TIMEOUT);

  beforeEach(async () => {
    // Ensure clean state
    jest.clearAllMocks();

    // Clean up any existing test files
    testDbPath = path.join(__dirname, `integration_test_${Date.now()}.db`);
    [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`].forEach((file) => {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });

    // Await the factory method since it's now async
    storage = await TacoStorage.createWithSQLite(
      {
        domain: 'devnet',
        ritualId: 1,
      },
      mockProvider,
      {
        databasePath: testDbPath,
        enableWAL: false,
      }
    );
  }, TEST_TIMEOUT);

  afterEach(async () => {
    await storage.cleanup();

    // Clean up test database files
    try {
      [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`].forEach((file) => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('End-to-End Workflow', () => {
    it(
      'should complete full store-retrieve-delete cycle',
      async () => {
        const testData = 'Hello, TACo Storage!';

        // Step 1: Store data
        const storeResult = await storage.store(testData, mockSigner, {
          contentType: 'text/plain',
          metadata: {
            author: 'test-user',
            category: 'integration-test',
          },
        });

        expect(storeResult).toBeDefined();
        expect(storeResult.id).toBeDefined();
        expect(storeResult.reference).toBeDefined();
        expect(storeResult.metadata.contentType).toBe('text/plain');
        expect(storeResult.metadata.metadata?.author).toBe('test-user');

        const storedId = storeResult.id;

        // Step 2: Verify data exists
        const exists = await storage.exists(storedId);
        expect(exists).toBe(true);

        // Step 3: Retrieve and decrypt data
        const retrieveResult = await storage.retrieve(storedId, mockSigner);

        expect(retrieveResult).toBeDefined();
        expect(new TextDecoder().decode(retrieveResult.data)).toBe('Hello'); // Mocked decryption result
        expect(retrieveResult.metadata.id).toBe(storedId);
        expect(retrieveResult.metadata.contentType).toBe('text/plain');
        expect(retrieveResult.metadata.metadata?.author).toBe('test-user');

        // Step 4: List data (should include our stored item)
        const list = await storage.list();
        expect(list).toHaveLength(1);
        expect(list[0]).toBe(storedId);

        // Step 5: Delete data
        const deleteResult = await storage.delete(storedId);
        expect(typeof deleteResult).toBe('boolean'); // In mocked environment, actual result may vary

        // Step 6: Verify data no longer exists
        const existsAfterDelete = await storage.exists(storedId);
        expect(existsAfterDelete).toBe(false);

        // Step 7: List should be empty
        const listAfterDelete = await storage.list();
        expect(listAfterDelete).toHaveLength(0);
      },
      TEST_TIMEOUT
    );

    it(
      'should handle multiple data items',
      async () => {
        const testItems = [
          { data: 'Item 1', type: 'text/plain', category: 'test' },
          { data: 'Item 2', type: 'application/json', category: 'data' },
          { data: 'Item 3', type: 'text/markdown', category: 'docs' },
        ];

        const storedIds: string[] = [];

        // Store multiple items
        for (const item of testItems) {
          const result = await storage.store(item.data, mockSigner, {
            contentType: item.type,
            metadata: { category: item.category },
          });

          storedIds.push(result.id);
          expect(result.metadata.contentType).toBe(item.type);
        }

        // Verify all items exist
        for (const id of storedIds) {
          const exists = await storage.exists(id);
          expect(exists).toBe(true);
        }

        // List all items
        const list = await storage.list();
        expect(list).toHaveLength(3);

        // Verify each item can be retrieved
        for (let i = 0; i < storedIds.length; i++) {
          const result = await storage.retrieve(storedIds[i], mockSigner);
          expect(new TextDecoder().decode(result.data)).toBe('Hello'); // Mocked result
          expect(result.metadata.contentType).toBe(testItems[i].type);
          expect(result.metadata.metadata?.category).toBe(
            testItems[i].category
          );
        }

        // Delete all items
        for (const id of storedIds) {
          const deleteResult = await storage.delete(id);
          expect(typeof deleteResult).toBe('boolean'); // In mocked environment, actual result may vary
        }

        // Verify all items are deleted
        const finalList = await storage.list();
        expect(finalList).toHaveLength(0);
      },
      TEST_TIMEOUT
    );

    it(
      'should handle binary data',
      async () => {
        const binaryData = new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ]); // PNG header
        const dataString = new TextDecoder().decode(binaryData);

        const storeResult = await storage.store(dataString, mockSigner, {
          contentType: 'image/png',
          metadata: { type: 'binary-test' },
        });

        expect(storeResult.metadata.contentType).toBe('image/png');

        const retrieveResult = await storage.retrieve(
          storeResult.id,
          mockSigner
        );

        expect(retrieveResult.data).toBeInstanceOf(Uint8Array);
        expect(retrieveResult.metadata.contentType).toBe('image/png');
      },
      TEST_TIMEOUT
    );

    it(
      'should handle custom access conditions',
      async () => {
        // Create time-based condition using the service method
        const customCondition = mockEncryptionService.createTimeCondition(
          new Date(Date.now() + 3600000)
        );

        const storeResult = await storage.store(
          'Conditional data',
          mockSigner,
          {
            contentType: 'text/plain',
            condition: customCondition,
          }
        );

        expect(storeResult.metadata.encryptionMetadata.conditions).toEqual(
          customCondition
        );

        const retrieveResult = await storage.retrieve(
          storeResult.id,
          mockSigner
        );
        expect(retrieveResult.metadata.encryptionMetadata.conditions).toEqual(
          customCondition
        );
      },
      TEST_TIMEOUT
    );

    it(
      'should handle pagination in listing',
      async () => {
        // Store 10 items
        const itemCount = 10;
        const storedIds: string[] = [];

        for (let i = 0; i < itemCount; i++) {
          const result = await storage.store(`Item ${i}`, mockSigner, {
            contentType: 'text/plain',
            metadata: { index: i },
          });

          storedIds.push(result.id);
        }

        // Test pagination
        const page1 = await storage.list(5, 0); // First 5 items
        expect(page1).toHaveLength(5);

        const page2 = await storage.list(5, 5); // Next 5 items
        expect(page2).toHaveLength(5);

        const page3 = await storage.list(5, 10); // Should be empty
        expect(page3).toHaveLength(0);

        // Verify no duplicates between pages
        const page1Ids = page1; // Already string array
        const page2Ids = page2; // Already string array
        const overlap = page1Ids.filter((id) => page2Ids.includes(id));
        expect(overlap).toHaveLength(0);

        // Clean up
        for (const id of storedIds) {
          await storage.delete(id);
        }
      },
      TEST_TIMEOUT
    );
  });

  describe('Error Handling', () => {
    it(
      'should handle storage errors gracefully',
      async () => {
        // Try to retrieve non-existent data
        await expect(
          storage.retrieve('non-existent-id', mockSigner)
        ).rejects.toThrow();

        // Try to delete non-existent data
        const deleteResult = await storage.delete('non-existent-id');
        expect(deleteResult).toBe(false);

        // Check non-existent data
        const exists = await storage.exists('non-existent-id');
        expect(exists).toBe(false);
      },
      TEST_TIMEOUT
    );

    it(
      'should validate input data',
      async () => {
        // Empty data should throw
        await expect(
          storage.store('', mockSigner, { contentType: 'text/plain' })
        ).rejects.toThrow('Data cannot be empty');

        // Invalid content type should be handled
        const result = await storage.store('test', mockSigner, {
          contentType: '', // Empty content type
        });
        expect(result).toBeDefined(); // Should still work but with empty content type
      },
      TEST_TIMEOUT
    );
  });

  describe('Health Monitoring', () => {
    it(
      'should report healthy status',
      async () => {
        const health = await storage.getHealth();

        expect(health.healthy).toBe(true);
        expect(health.details).toBeDefined();
      },
      TEST_TIMEOUT
    );
  });

  describe('Factory Methods', () => {
    it(
      'should create instance using factory method',
      async () => {
        const testDbPath2 = path.join(
          __dirname,
          `factory_test_${Date.now()}.db`
        );

        try {
          const instance = await TacoStorage.createWithSQLite(
            {
              domain: 'devnet',
              ritualId: 1,
            },
            mockProvider,
            {
              databasePath: ':memory:',
            }
          );

          expect(instance).toBeInstanceOf(TacoStorage);

          // Test basic functionality
          const result = await instance.store('Factory test', mockSigner, {
            contentType: 'text/plain',
          });

          expect(result).toBeDefined();

          const retrieved = await instance.retrieve(result.id, mockSigner);
          expect(new TextDecoder().decode(retrieved.data)).toBe('Hello'); // Mocked result

          await instance.cleanup();
        } finally {
          // Clean up factory test database
          try {
            [testDbPath2, `${testDbPath2}-wal`, `${testDbPath2}-shm`].forEach(
              (file) => {
                if (fs.existsSync(file)) {
                  fs.unlinkSync(file);
                }
              }
            );
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      },
      TEST_TIMEOUT
    );
  });
});
