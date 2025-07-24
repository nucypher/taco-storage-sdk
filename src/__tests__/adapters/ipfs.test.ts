/**
 * IPFS Adapter Integration Tests
 * 
 * These tests use a real IPFS node for integration testing.
 * Requires IPFS daemon running at http://localhost:5001
 */

import { IPFSAdapter } from '../../adapters/ipfs/index';
import { StorageMetadata, TacoStorageError, TacoStorageErrorType } from '../../types';
import { TEST_TIMEOUT } from '../setup';

describe('IPFSAdapter Real Integration Tests', () => {
  let adapter: IPFSAdapter;
  let storedData: Array<{ id: string; reference: string }> = []; // Track for cleanup
  
  // Shared test data
  const testData = new Uint8Array([72, 101, 108, 108, 111]); // 'Hello'
  const testMetadata: StorageMetadata = {
    id: `test-id-${Date.now()}`,
    contentType: 'application/octet-stream',
    size: 5,
    createdAt: new Date(),
    encryptionMetadata: {
      messageKit: [1, 2, 3],
      conditions: {},
    },
  };

  beforeAll(async () => {
    // Test if local IPFS node is running
    adapter = new IPFSAdapter({
      url: 'http://localhost:5001',
      timeout: 10000,
      pin: true,
    });
    
    try {
      await adapter.initialize();
    } catch (error) {
      console.warn('⚠️  Local IPFS node not available at http://localhost:5001');
      console.warn('   Please start IPFS daemon with: ipfs daemon');
      console.warn('   Tests will fail if IPFS node is not running');
      throw new Error('IPFS node not available - tests require local IPFS daemon');
    }
  });

  beforeEach(async () => {
    // Update test metadata ID to be unique for each test
    testMetadata.id = `test-id-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    storedData = [];
  });

  afterEach(async () => {
    // Clean up any stored data
    for (const item of storedData) {
      try {
        await adapter.delete(item.reference);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    storedData = [];
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const defaultAdapter = new IPFSAdapter();
      expect(defaultAdapter).toBeInstanceOf(IPFSAdapter);
    });

    it('should create instance with custom config', () => {
      const customAdapter = new IPFSAdapter({
        url: 'http://custom-ipfs:5001',
        timeout: 60000,
        pin: false,
      });
      expect(customAdapter).toBeInstanceOf(IPFSAdapter);
    });
  });

  describe('store', () => {
    it('should store data and return storage result', async () => {
      const result = await adapter.store(testData, testMetadata);
      
      // Track for cleanup
      storedData.push({ id: result.id, reference: result.reference });

      expect(result).toBeDefined();
      expect(result.id).toBe(testMetadata.id);
      expect(result.reference).toMatch(/^ipfs:\/\/(Qm[a-zA-Z0-9]+|baf[a-z0-9]+)$/);
      expect(result.metadata).toEqual({
        ...testMetadata,
        ipfsHash: expect.stringMatching(/^(Qm[a-zA-Z0-9]+|baf[a-z0-9]+)$/),
      });
    });
  });

  describe('retrieve', () => {
    it('should retrieve data successfully', async () => {
      // First store some data to get a valid reference
      const storeResult = await adapter.store(testData, testMetadata);
      storedData.push({ id: storeResult.id, reference: storeResult.reference });

      // Now retrieve the stored data
      const result = await adapter.retrieve(storeResult.reference);

      expect(result.encryptedData).toEqual(testData);
      expect(result.metadata.id).toBe(testMetadata.id);
      expect(result.metadata.contentType).toBe(testMetadata.contentType);
      expect(result.metadata.size).toBe(testMetadata.size);
    });

    it('should throw error for invalid reference format', async () => {
      await expect(adapter.retrieve('invalid-reference')).rejects.toThrow(
        TacoStorageError
      );
    });

    it('should throw error for non-existent IPFS hash', async () => {
      const invalidReference = 'ipfs://QmInvalidHashThatDoesNotExist123456789';
      await expect(adapter.retrieve(invalidReference)).rejects.toThrow(
        TacoStorageError
      );
    });
  });

  describe('delete', () => {
    it('should delete (unpin) data successfully', async () => {
      // First store some data to get a valid reference
      const storeResult = await adapter.store(testData, testMetadata);
      
      const result = await adapter.delete(storeResult.reference);
      expect(result).toBe(true);
    });

    it('should return true even with invalid reference format', async () => {
      // IPFS delete is lenient and will attempt to delete any reference
      const result = await adapter.delete('invalid-reference');
      expect(result).toBe(true);
    });
  });

  describe('exists', () => {
    it('should return true when content exists', async () => {
      // First store some data to get a valid reference
      const storeResult = await adapter.store(testData, testMetadata);
      storedData.push({ id: storeResult.id, reference: storeResult.reference });

      const result = await adapter.exists(storeResult.reference);
      expect(result).toBe(true);
    });

    it('should return false when content does not exist', async () => {
      const nonExistentReference = 'ipfs://QmNonExistentHashThatWillNotBeFound123456789';
      const result = await adapter.exists(nonExistentReference);
      expect(result).toBe(false);
    });

    it('should return false for invalid reference format', async () => {
      const result = await adapter.exists('invalid-reference');
      expect(result).toBe(false);
    });
  });

  // Note: IPFS adapter doesn't implement list method as it's not part of the base interface

  describe('getHealth', () => {
    it('should return healthy status', async () => {
      const health = await adapter.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.details).toBeDefined();
      
      if (health.details) {
        expect(health.details.nodeId).toBeDefined();
        expect(health.details.version).toBeDefined();
        expect(Array.isArray(health.details.addresses)).toBe(true);
      }
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await expect(adapter.cleanup()).resolves.not.toThrow();
    });
  });
});
