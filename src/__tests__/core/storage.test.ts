/**
 * Tests for TacoStorage
 */

import { TacoStorage } from '../../core/storage';
import { BaseStorageAdapter, IStorageAdapter } from '../../adapters/base';
import { TacoEncryptionService } from '../../core/encryption';
import {
  StorageMetadata,
  StorageResult,
  RetrievalResult,
  TacoStorageError,
  TacoStorageErrorType,
} from '../../types';
import * as ethers from 'ethers';
import { ThresholdMessageKit } from '@nucypher/taco';
import { TEST_TIMEOUT } from '../setup';

// Mock dependencies
jest.mock('../../core/encryption');
jest.mock('../../adapters/sqlite');
jest.mock('../../adapters/ipfs');

// Mock TACo SDK components
jest.mock('@nucypher/taco', () => ({
  ThresholdMessageKit: {
    fromBytes: jest.fn(),
  },
  conditions: {
    condition: {},
    context: {},
  },
  domains: {
    DEVNET: 'devnet',
  },
  encrypt: jest.fn(),
  decrypt: jest.fn(),
}));

describe('TacoStorage', () => {
  let storage: TacoStorage;
  let mockAdapter: jest.Mocked<IStorageAdapter>;
  let mockEncryptionService: jest.Mocked<TacoEncryptionService>;
  let mockProvider: ethers.providers.Provider;
  let mockSigner: ethers.Signer;

  beforeEach(() => {
    // Create mock adapter
    mockAdapter = {
      store: jest.fn(),
      retrieve: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      list: jest.fn().mockResolvedValue([]),
      getHealth: jest.fn(),
      cleanup: jest.fn(),
      initialize: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Create mock encryption service
    mockEncryptionService = {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
      createTimeCondition: jest.fn(),
      createNFTOwnershipCondition: jest.fn(),
      initialize: jest.fn().mockResolvedValue(undefined),
    } as any;

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

    // Mock TacoEncryptionService constructor
    (
      TacoEncryptionService as jest.MockedClass<typeof TacoEncryptionService>
    ).mockImplementation(() => mockEncryptionService);

    // Setup ThresholdMessageKit mock
    const mockMessageKit = createMockMessageKit();
    (ThresholdMessageKit.fromBytes as jest.Mock).mockReturnValue(
      mockMessageKit
    );

    storage = new TacoStorage(
      mockAdapter,
      {
        domain: 'devnet',
        ritualId: 1,
      },
      mockProvider
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createTestMetadata = (id: string): StorageMetadata => {
    return {
      id,
      contentType: 'text/plain',
      size: 100,
      createdAt: new Date(),
      encryptionMetadata: {
        messageKit: [1, 2, 3],
        conditions: [{ type: 'test' }],
      },
    };
  };

  const createMockMessageKit = () =>
    ({
      toBytes: jest.fn().mockReturnValue(new Uint8Array([10, 20, 30])),
      free: jest.fn(),
      equals: jest.fn(),
      decryptWithSharedSecret: jest.fn(),
      decryptWithDecryptingPower: jest.fn(),
    }) as any;

  const createMockCondition = (type = 'time') =>
    ({
      schema: {},
      value: {},
      findParamWithAuthentication: jest.fn(),
      requiresAuthentication: jest.fn().mockReturnValue(false),
      returnValueTest: {},
      asDict: jest.fn().mockReturnValue({}),
      type,
    }) as any;

  describe('constructor', () => {
    it('should create instance with valid parameters', () => {
      expect(storage).toBeDefined();
      expect(TacoEncryptionService).toHaveBeenCalledWith({
        domain: 'devnet',
        ritualId: 1,
      });
    });

    it('should create instance even with null adapter', () => {
      expect(() => {
        new TacoStorage(
          null as any,
          {
            domain: 'devnet',
            ritualId: 1,
          },
          mockProvider
        );
      }).not.toThrow();
    });

    it('should create instance even with null config', () => {
      expect(() => {
        new TacoStorage(mockAdapter, null as any, mockProvider);
      }).not.toThrow();
    });
  });

  describe('store', () => {
    const testData = new TextEncoder().encode('Hello, world!');
    const testDataBytes = testData;

    it(
      'should store data with default time condition',
      async () => {
        const mockMessageKit = {
          toBytes: jest.fn().mockReturnValue(new Uint8Array([10, 20, 30])),
        } as any;

        const mockCondition = {
          schema: {},
          value: {},
          findParamWithAuthentication: jest.fn(),
          requiresAuthentication: jest.fn().mockReturnValue(false),
          returnValueTest: {},
          asDict: jest.fn().mockReturnValue({}),
          type: 'time',
          endTime: Date.now() + 3600000,
        } as any;

        const mockEncryptResult = {
          messageKit: mockMessageKit,
          conditions: [mockCondition],
        };

        const mockStoreResult: StorageResult = {
          id: 'stored-id',
          reference: 'stored-reference',
          metadata: createTestMetadata('stored-id'),
        };

        mockEncryptionService.createTimeCondition.mockReturnValue(
          mockCondition
        );
        mockEncryptionService.encrypt.mockResolvedValue(mockEncryptResult);
        mockAdapter.store.mockResolvedValue(mockStoreResult);

        const result = await storage.store(testData, mockSigner, {
          contentType: 'text/plain',
        });

        expect(result).toBeDefined();
        expect(result.id).toBe('stored-id');
        expect(mockEncryptionService.createTimeCondition).toHaveBeenCalled();
        expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(
          testDataBytes,
          mockCondition,
          mockProvider,
          mockSigner
        );
        expect(mockAdapter.store).toHaveBeenCalled();
      },
      TEST_TIMEOUT
    );

    it(
      'should store data with custom conditions',
      async () => {
        const customCondition = createMockCondition('custom');
        const mockEncryptResult = {
          messageKit: createMockMessageKit(),
          conditions: customCondition,
        };

        const mockStoreResult: StorageResult = {
          id: 'stored-id',
          reference: 'stored-reference',
          metadata: createTestMetadata('stored-id'),
        };

        mockEncryptionService.encrypt.mockResolvedValue(mockEncryptResult);
        mockAdapter.store.mockResolvedValue(mockStoreResult);

        const result = await storage.store(testData, mockSigner, {
          contentType: 'text/plain',
          condition: customCondition,
        });

        expect(result).toBeDefined();
        expect(
          mockEncryptionService.createTimeCondition
        ).not.toHaveBeenCalled();
        expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(
          testDataBytes,
          customCondition,
          mockProvider,
          mockSigner
        );
      },
      TEST_TIMEOUT
    );

    it(
      'should store data with custom metadata',
      async () => {
        const customMetadata = { user: 'test-user', category: 'documents' };
        const mockCondition = createMockCondition('time');
        const mockEncryptResult = {
          messageKit: createMockMessageKit(),
          conditions: [mockCondition],
        };

        mockEncryptionService.createTimeCondition.mockReturnValue(
          mockCondition
        );
        mockEncryptionService.encrypt.mockResolvedValue(mockEncryptResult);
        mockAdapter.store.mockResolvedValue({
          id: 'stored-id',
          reference: 'stored-reference',
          metadata: createTestMetadata('stored-id'),
        });

        await storage.store(testData, mockSigner, {
          contentType: 'text/plain',
          metadata: customMetadata,
        });

        const storeCall = mockAdapter.store.mock.calls[0];
        const storedMetadata = storeCall[1] as StorageMetadata;

        expect(storedMetadata.metadata).toEqual(customMetadata);
      },
      TEST_TIMEOUT
    );

    it(
      'should throw error for empty data',
      async () => {
        await expect(
          storage.store(new Uint8Array([]), mockSigner, {
            contentType: 'text/plain',
          })
        ).rejects.toThrow('Data cannot be empty');
      },
      TEST_TIMEOUT
    );

    it(
      'should throw error when encryption fails',
      async () => {
        mockEncryptionService.createTimeCondition.mockReturnValue(
          createMockCondition('time')
        );
        mockEncryptionService.encrypt.mockRejectedValue(
          new Error('Encryption failed')
        );

        await expect(
          storage.store(testData, mockSigner, { contentType: 'text/plain' })
        ).rejects.toThrow('Encryption failed');
      },
      TEST_TIMEOUT
    );

    it(
      'should throw error when storage fails',
      async () => {
        const mockCondition = createMockCondition('time');
        const mockEncryptResult = {
          messageKit: createMockMessageKit(),
          conditions: [mockCondition],
        };

        mockEncryptionService.createTimeCondition.mockReturnValue(
          mockCondition
        );
        mockEncryptionService.encrypt.mockResolvedValue(mockEncryptResult);
        mockAdapter.store.mockRejectedValue(new Error('Storage failed'));

        await expect(
          storage.store(testData, mockSigner, { contentType: 'text/plain' })
        ).rejects.toThrow('Storage failed');
      },
      TEST_TIMEOUT
    );
  });

  describe('retrieve', () => {
    it(
      'should retrieve and decrypt data successfully',
      async () => {
        const testId = 'test-id';
        const originalData = 'Hello, world!';
        const encryptedData = new Uint8Array([1, 2, 3, 4, 5]);
        const decryptedData = new TextEncoder().encode(originalData);

        const mockRetrieveResult = {
          encryptedData,
          metadata: createTestMetadata(testId),
        };

        mockAdapter.retrieve.mockResolvedValue(mockRetrieveResult);
        mockEncryptionService.decrypt.mockResolvedValue(decryptedData);

        const result = await storage.retrieve(testId, mockSigner);

        expect(result).toBeDefined();
        expect(result.data).toEqual(decryptedData); // Compare Uint8Array
        expect(result.metadata.id).toBe(testId);

        expect(mockAdapter.retrieve).toHaveBeenCalledWith(testId);
        expect(mockEncryptionService.decrypt).toHaveBeenCalledWith(
          expect.any(Object), // ThresholdMessageKit mock
          mockProvider
        );
      },
      TEST_TIMEOUT
    );

    it(
      'should return binary data when requested',
      async () => {
        const testId = 'test-id';
        const encryptedData = new Uint8Array([1, 2, 3, 4, 5]);
        const decryptedData = new Uint8Array([10, 20, 30]);

        const mockRetrieveResult = {
          encryptedData,
          metadata: createTestMetadata(testId),
        };

        mockAdapter.retrieve.mockResolvedValue(mockRetrieveResult);
        mockEncryptionService.decrypt.mockResolvedValue(decryptedData);

        const result = await storage.retrieve(testId, mockSigner);

        expect(result.data).toEqual(decryptedData);
      },
      TEST_TIMEOUT
    );

    it(
      'should throw error when data not found',
      async () => {
        mockAdapter.retrieve.mockRejectedValue(
          new TacoStorageError(TacoStorageErrorType.NOT_FOUND, 'Not found')
        );

        await expect(
          storage.retrieve('non-existent', mockSigner)
        ).rejects.toThrow(TacoStorageError);
      },
      TEST_TIMEOUT
    );

    it(
      'should throw error when decryption fails',
      async () => {
        const mockRetrieveResult = {
          encryptedData: new Uint8Array([1, 2, 3]),
          metadata: createTestMetadata('test-id'),
        };

        mockAdapter.retrieve.mockResolvedValue(mockRetrieveResult);
        mockEncryptionService.decrypt.mockRejectedValue(
          new Error('Decryption failed')
        );

        await expect(storage.retrieve('test-id', mockSigner)).rejects.toThrow(
          'Decryption failed'
        );
      },
      TEST_TIMEOUT
    );
  });

  describe('delete', () => {
    it(
      'should delete data successfully',
      async () => {
        mockAdapter.delete.mockResolvedValue(true);

        const result = await storage.delete('test-id');

        expect(result).toBe(true);
        expect(mockAdapter.delete).toHaveBeenCalledWith('test-id');
      },
      TEST_TIMEOUT
    );

    it(
      'should return false when data does not exist',
      async () => {
        mockAdapter.delete.mockResolvedValue(false);

        const result = await storage.delete('non-existent');

        expect(result).toBe(false);
      },
      TEST_TIMEOUT
    );
  });

  describe('exists', () => {
    it(
      'should return true when data exists',
      async () => {
        mockAdapter.exists.mockResolvedValue(true);

        const result = await storage.exists('test-id');

        expect(result).toBe(true);
        expect(mockAdapter.exists).toHaveBeenCalledWith('test-id');
      },
      TEST_TIMEOUT
    );

    it(
      'should return false when data does not exist',
      async () => {
        mockAdapter.exists.mockResolvedValue(false);

        const result = await storage.exists('non-existent');

        expect(result).toBe(false);
      },
      TEST_TIMEOUT
    );
  });

  describe('list', () => {
    it(
      'should list stored data',
      async () => {
        const mockList = ['id-1', 'id-2'];

        (mockAdapter.list as jest.Mock).mockResolvedValue(mockList);

        const result = await storage.list();

        expect(result).toEqual(mockList);
        expect(mockAdapter.list).toHaveBeenCalledWith(undefined, undefined);
      },
      TEST_TIMEOUT
    );

    it(
      'should list with limit and offset',
      async () => {
        const mockList = ['id-1'];

        (mockAdapter.list as jest.Mock).mockResolvedValue(mockList);

        const result = await storage.list(10, 5);

        expect(result).toEqual(mockList);
        expect(mockAdapter.list).toHaveBeenCalledWith(10, 5);
      },
      TEST_TIMEOUT
    );

    it(
      'should return empty array when no data exists',
      async () => {
        (mockAdapter.list as jest.Mock).mockResolvedValue([]);

        const result = await storage.list();

        expect(result).toEqual([]);
      },
      TEST_TIMEOUT
    );
  });

  describe('getHealth', () => {
    it(
      'should return healthy status',
      async () => {
        const mockHealth = {
          healthy: true,
          details: { adapter: 'working' },
        };

        mockAdapter.getHealth.mockResolvedValue(mockHealth);

        const result = await storage.getHealth();

        expect(result).toEqual(mockHealth);
        expect(mockAdapter.getHealth).toHaveBeenCalled();
      },
      TEST_TIMEOUT
    );

    it(
      'should return unhealthy status when adapter is unhealthy',
      async () => {
        const mockHealth = {
          healthy: false,
          details: { error: 'Connection failed' },
        };

        mockAdapter.getHealth.mockResolvedValue(mockHealth);

        const result = await storage.getHealth();

        expect(result).toEqual(mockHealth);
      },
      TEST_TIMEOUT
    );
  });

  describe('cleanup', () => {
    it(
      'should call adapter cleanup',
      async () => {
        mockAdapter.cleanup.mockResolvedValue(undefined);

        await storage.cleanup();

        expect(mockAdapter.cleanup).toHaveBeenCalled();
      },
      TEST_TIMEOUT
    );

    it(
      'should handle cleanup errors gracefully',
      async () => {
        mockAdapter.cleanup.mockRejectedValue(new Error('Cleanup failed'));

        await expect(storage.cleanup()).rejects.toThrow('Failed to cleanup');
      },
      TEST_TIMEOUT
    );
  });

  describe('factory methods', () => {
    beforeEach(() => {
      // Mock the adapter constructors
      const { SQLiteAdapter } = require('../../adapters/sqlite');

      SQLiteAdapter.mockImplementation(() => mockAdapter);
    });

    it(
      'should create instance with SQLite adapter',
      async () => {
        const instance = await TacoStorage.createWithSQLite(
          { domain: 'devnet', ritualId: 1 },
          mockProvider,
          { databasePath: ':memory:' }
        );

        expect(instance).toBeDefined();
        expect(instance).toBeInstanceOf(TacoStorage);
      },
      TEST_TIMEOUT
    );
  });
});
