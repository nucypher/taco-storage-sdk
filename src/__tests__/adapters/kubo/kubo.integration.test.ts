/**
 * KuboAdapter Real Integration Tests
 * 
 * These tests run against a real local IPFS node for integration testing.
 * Requires IPFS daemon running at http://localhost:5001
 * 
 * Start IPFS daemon with: ipfs daemon
 */

import { KuboAdapter } from '../../../adapters/ipfs/index';
import {
  StorageMetadata,
  TacoStorageError,
  TacoStorageErrorType,
} from '../../../types';
import { TEST_TIMEOUT } from '../../setup';

describe('KuboAdapter Real Integration Tests', () => {
  let adapter: KuboAdapter;
  let storedData: Array<{ id: string; reference: string }> = []; // Track for cleanup
  let isIPFSAvailable = false;
  
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
    adapter = new KuboAdapter({
      url: 'http://localhost:5001',
      timeout: 10000,
      pin: true,
    });
    
    try {
      await adapter.initialize();
      const health = await adapter.getHealth();
      isIPFSAvailable = health.healthy;
      console.log('✅ Local IPFS node is available and healthy');
    } catch (error) {
      console.warn('⚠️  Local IPFS node not available at http://localhost:5001');
      console.warn('   Please start IPFS daemon with: ipfs daemon');
      console.warn('   Integration tests will be skipped');
      isIPFSAvailable = false;
    }
  });

  beforeEach(async () => {
    if (!isIPFSAvailable) {
      return; // Skip setup if IPFS not available
    }
    
    // Update test metadata ID to be unique for each test
    testMetadata.id = `test-id-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    storedData = [];
  });

  afterEach(async () => {
    if (!isIPFSAvailable || storedData.length === 0) {
      return;
    }
    
    // Clean up stored data
    for (const data of storedData) {
      try {
        await adapter.delete(data.reference);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  afterAll(async () => {
    if (adapter && isIPFSAvailable) {
      await adapter.cleanup();
    }
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      if (!isIPFSAvailable) {
        console.warn('Skipping test: IPFS not available');
        return;
      }
      
      const adapter = new KuboAdapter();
      expect(adapter).toBeInstanceOf(KuboAdapter);
    });

    it('should create instance with custom config', () => {
      if (!isIPFSAvailable) {
        console.warn('Skipping test: IPFS not available');
        return;
      }
      
      const adapter = new KuboAdapter({
        url: 'http://localhost:5001',
        timeout: 5000,
        pin: false,
      });
      expect(adapter).toBeInstanceOf(KuboAdapter);
    });
  });

  describe('store', () => {
    it('should store data and return storage result', async () => {
      if (!isIPFSAvailable) {
        console.warn('Skipping test: IPFS not available');
        return;
      }
      
      const result = await adapter.store(testData, testMetadata);
      
      expect(result).toBeDefined();
      expect(result.reference).toMatch(/^ipfs:\/\/Qm[a-zA-Z0-9]+$/);
      expect(result.metadata.id).toBe(testMetadata.id);
      expect(result.metadata.ipfsHash).toMatch(/^Qm[a-zA-Z0-9]+$/);
      
      // Track for cleanup
      storedData.push({ id: testMetadata.id, reference: result.reference });
    }, TEST_TIMEOUT);
  });

  describe('retrieve', () => {
    it('should retrieve data successfully', async () => {
      if (!isIPFSAvailable) {
        console.warn('Skipping test: IPFS not available');
        return;
      }
      
      // First store some data
      const storeResult = await adapter.store(testData, testMetadata);
      storedData.push({ id: testMetadata.id, reference: storeResult.reference });
      
      // Then retrieve it
      const retrieveResult = await adapter.retrieve(storeResult.reference);
      
      expect(retrieveResult).toBeDefined();
      expect(retrieveResult.encryptedData).toEqual(testData);
      expect(retrieveResult.metadata.id).toBe(testMetadata.id);
    }, TEST_TIMEOUT);

    it('should throw error for invalid reference format', async () => {
      if (!isIPFSAvailable) {
        console.warn('Skipping test: IPFS not available');
        return;
      }
      
      // Real IPFS treats invalid references as retrieval errors, not validation errors
      await expect(adapter.retrieve('invalid-reference')).rejects.toThrow(TacoStorageError);
      await expect(adapter.retrieve('invalid-reference')).rejects.toThrow(
        expect.objectContaining({
          type: TacoStorageErrorType.RETRIEVAL_ERROR,
        })
      );
    }, TEST_TIMEOUT);

    it('should throw error for non-existent IPFS hash', async () => {
      if (!isIPFSAvailable) {
        console.warn('Skipping test: IPFS not available');
        return;
      }
      
      const fakeReference = 'ipfs://QmNonExistentHashThatShouldNotExist123456789';
      await expect(adapter.retrieve(fakeReference)).rejects.toThrow(TacoStorageError);
    }, TEST_TIMEOUT);
  });

  describe('delete', () => {
    it('should delete (unpin) data successfully', async () => {
      if (!isIPFSAvailable) {
        console.warn('Skipping test: IPFS not available');
        return;
      }
      
      // First store some data
      const storeResult = await adapter.store(testData, testMetadata);
      
      // Then delete it
      const deleteResult = await adapter.delete(storeResult.reference);
      expect(deleteResult).toBe(true);
      
      // No need to track for cleanup since it's deleted
    }, TEST_TIMEOUT);

    it('should return true even with invalid reference format', async () => {
      if (!isIPFSAvailable) {
        console.warn('Skipping test: IPFS not available');
        return;
      }
      
      const result = await adapter.delete('invalid-reference');
      expect(result).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('exists', () => {
    it('should return true when content exists', async () => {
      if (!isIPFSAvailable) {
        console.warn('Skipping test: IPFS not available');
        return;
      }
      
      // First store some data
      const storeResult = await adapter.store(testData, testMetadata);
      storedData.push({ id: testMetadata.id, reference: storeResult.reference });
      
      // Then check if it exists
      const exists = await adapter.exists(storeResult.reference);
      expect(exists).toBe(true);
    }, TEST_TIMEOUT);

    it('should return false when content does not exist', async () => {
      if (!isIPFSAvailable) {
        console.warn('Skipping test: IPFS not available');
        return;
      }
      
      const fakeReference = 'ipfs://QmNonExistentHashThatShouldNotExist123456789';
      const exists = await adapter.exists(fakeReference);
      expect(exists).toBe(false);
    }, TEST_TIMEOUT);

    it('should return false for invalid reference format', async () => {
      if (!isIPFSAvailable) {
        console.warn('Skipping test: IPFS not available');
        return;
      }
      
      const exists = await adapter.exists('invalid-reference');
      expect(exists).toBe(false);
    }, TEST_TIMEOUT);
  });

  describe('getHealth', () => {
    it('should return healthy status', async () => {
      if (!isIPFSAvailable) {
        console.warn('Skipping test: IPFS not available');
        return;
      }
      
      const health = await adapter.getHealth();
      expect(health).toBeDefined();
      expect(health.healthy).toBe(true);
      expect(health.details).toBeDefined();
      if (health.details) {
        expect(health.details.nodeId).toBeDefined();
        expect(health.details.version).toBeDefined();
      }
    }, TEST_TIMEOUT);
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      if (!isIPFSAvailable) {
        console.warn('Skipping test: IPFS not available');
        return;
      }
      
      await expect(adapter.cleanup()).resolves.not.toThrow();
    }, TEST_TIMEOUT);
  });
});
