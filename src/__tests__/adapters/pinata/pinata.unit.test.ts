/**
 * Pinata adapter integration tests
 * 
 * These tests require a valid Pinata account with JWT token
 * Set environment variables PINATA_URL and PINATA_JWT to run these tests
 */

import { PinataAdapter } from '../../../adapters/pinata';
import { StorageMetadata, TacoStorageError, TacoStorageErrorType } from '../../../types';
import { TEST_TIMEOUT } from '../../setup';

describe('PinataAdapter Integration Tests', () => {
  let adapter: PinataAdapter;
  let storedData: Array<{ id: string; reference: string }> = []; // Track for cleanup
  
  // Shared test data
  const testData = new TextEncoder().encode('Hello, Pinata TACo Storage!');
  const testMetadata: StorageMetadata = {
    id: 'test-id-123',
    contentType: 'text/plain',
    size: testData.length,
    createdAt: new Date(),
    metadata: { test: true, version: '1.0' },
    encryptionMetadata: {
      messageKit: [1, 2, 3, 4, 5],
      conditions: { test: 'condition' },
    },
  };

  beforeAll(async () => {
    const pinataUrl = process.env.PINATA_URL || 'gateway.pinata.cloud';
    const pinataJwt = process.env.PINATA_JWT;
    
    if (!pinataJwt) {
      console.warn('PINATA_JWT environment variable not set. Skipping Pinata integration tests.');
      return;
    }

    // Test if Pinata credentials are valid
    adapter = new PinataAdapter({
      url: pinataUrl,
      jwt: pinataJwt,
    });
    
    try {
      await adapter.initialize();
      const health = await adapter.getHealth();
      if (!health.healthy) {
        console.warn('Pinata service is not healthy. Skipping integration tests.');
        return;
      }
    } catch (error) {
      console.warn('Failed to connect to Pinata service:', error);
      return;
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (!adapter) return;
    
    // Clean up any stored data
    for (const item of storedData) {
      try {
        await adapter.delete(item.id);
      } catch (error) {
        console.warn(`Failed to clean up ${item.id}:`, error);
      }
    }
    
    await adapter.cleanup();
  }, TEST_TIMEOUT);

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      if (!process.env.PINATA_JWT) {
        console.warn('Skipping test: PINATA_JWT not set');
        return;
      }
      
      const testAdapter = new PinataAdapter({
        url: 'gateway.pinata.cloud',
        jwt: 'test-jwt-token',
      });
      expect(testAdapter).toBeInstanceOf(PinataAdapter);
    });

    it('should throw error with missing required config', () => {
      expect(() => {
        new PinataAdapter({
          url: 'gateway.pinata.cloud',
        } as any);
      }).toThrow(TacoStorageError);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with valid credentials', async () => {
      if (!process.env.PINATA_JWT) {
        console.warn('Skipping test: PINATA_JWT not set');
        return;
      }

      await expect(adapter.initialize()).resolves.not.toThrow();
    }, TEST_TIMEOUT);
  });

  describe('getHealth', () => {
    it('should return healthy status when properly configured', async () => {
      if (!adapter) {
        console.warn('Skipping test: Adapter not initialized');
        return;
      }

      const health = await adapter.getHealth();
      expect(health.healthy).toBe(true);
      expect(health.details).toBeDefined();
      expect(health.details?.gateway).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('store', () => {
    it('should store data successfully', async () => {
      if (!adapter) {
        console.warn('Skipping test: Adapter not initialized');
        return;
      }

      const result = await adapter.store(testData, testMetadata);
      
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.reference).toBeDefined();
      expect(result.metadata).toEqual(testMetadata);
      expect(result.reference).toContain('ipfs');
      
      // Track for cleanup
      storedData.push(result);
    }, TEST_TIMEOUT);

    it('should throw error for invalid data', async () => {
      if (!adapter) {
        console.warn('Skipping test: Adapter not initialized');
        return;
      }

      await expect(
        adapter.store(new Uint8Array(0), testMetadata)
      ).rejects.toThrow(TacoStorageError);
    }, TEST_TIMEOUT);
  });

  describe('retrieve', () => {
    it('should retrieve stored data', async () => {
      if (!adapter || storedData.length === 0) {
        console.warn('Skipping test: No data stored');
        return;
      }

      const storedItem = storedData[0];
      const result = await adapter.retrieve(storedItem.id);
      
      expect(result).toBeDefined();
      expect(result.encryptedData).toEqual(testData);
      expect(result.metadata.id).toBe(testMetadata.id);
      expect(result.metadata.contentType).toBe(testMetadata.contentType);
      expect(result.metadata.size).toBe(testMetadata.size);
      expect(result.metadata.encryptionMetadata.messageKit).toEqual(testMetadata.encryptionMetadata.messageKit);
    }, TEST_TIMEOUT);

    it('should throw error for non-existent data', async () => {
      if (!adapter) {
        console.warn('Skipping test: Adapter not initialized');
        return;
      }

      await expect(
        adapter.retrieve('nonexistent-id')
      ).rejects.toThrow(TacoStorageError);
    }, TEST_TIMEOUT);
  });

  describe('exists', () => {
    it('should return true for existing data', async () => {
      if (!adapter || storedData.length === 0) {
        console.warn('Skipping test: No data stored');
        return;
      }

      const storedItem = storedData[0];
      const exists = await adapter.exists(storedItem.id);
      expect(exists).toBe(true);
    }, TEST_TIMEOUT);

    it('should return false for non-existent data', async () => {
      if (!adapter) {
        console.warn('Skipping test: Adapter not initialized');
        return;
      }

      const exists = await adapter.exists('nonexistent-id');
      expect(exists).toBe(false);
    }, TEST_TIMEOUT);
  });

  describe('delete', () => {
    it('should delete existing data', async () => {
      if (!adapter || storedData.length === 0) {
        console.warn('Skipping test: No data stored');
        return;
      }

      const storedItem = storedData.pop()!; // Remove from cleanup list
      const result = await adapter.delete(storedItem.id);
      expect(result).toBe(true);
      
      // Verify deletion
      const exists = await adapter.exists(storedItem.id);
      expect(exists).toBe(false);
    }, TEST_TIMEOUT);

    it('should return true for non-existent data', async () => {
      if (!adapter) {
        console.warn('Skipping test: Adapter not initialized');
        return;
      }

      const result = await adapter.delete('nonexistent-id');
      expect(result).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('error handling', () => {
    it('should handle operations gracefully when not initialized', async () => {
      const uninitializedAdapter = new PinataAdapter({
        url: 'gateway.pinata.cloud',
        jwt: 'test-jwt',
      });

      await expect(
        uninitializedAdapter.store(testData, testMetadata)
      ).rejects.toThrow(TacoStorageError);
    });
  });
});
