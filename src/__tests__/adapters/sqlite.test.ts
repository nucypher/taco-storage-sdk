/**
 * Tests for SQLiteAdapter
 */

import { SQLiteAdapter } from '../../adapters/sqlite';
import { StorageMetadata, TacoStorageError, TacoStorageErrorType } from '../../types';
import { TEST_TIMEOUT } from '../setup';
import path from 'path';
import fs from 'fs';

describe('SQLiteAdapter', () => {
  let adapter: SQLiteAdapter;
  let testDbPath: string;

  beforeEach(async () => {
    // Create a temporary database file for testing
    testDbPath = path.join(__dirname, `test_${Date.now()}.db`);
    
    adapter = new SQLiteAdapter({
      databasePath: testDbPath,
      enableWAL: false, // Disable WAL for tests to avoid file locks
    });
    
    // Initialize the adapter to create the database schema
    await adapter.initialize();
  });

  afterEach(async () => {
    await adapter.cleanup();
    
    // Clean up test database files
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      if (fs.existsSync(`${testDbPath}-wal`)) {
        fs.unlinkSync(`${testDbPath}-wal`);
      }
      if (fs.existsSync(`${testDbPath}-shm`)) {
        fs.unlinkSync(`${testDbPath}-shm`);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  const createTestMetadata = (id: string = 'test-id'): StorageMetadata => ({
    id,
    contentType: 'text/plain',
    size: 100,
    createdAt: new Date(),
    encryptionMetadata: {
      messageKit: [1, 2, 3, 4, 5],
      conditions: [{ type: 'time', endTime: Date.now() + 3600000 }],
    },
    metadata: { custom: 'data' },
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const initTestDbPath = path.join(__dirname, `init_test_${Date.now()}.db`);
      const newAdapter = new SQLiteAdapter({
        databasePath: initTestDbPath,
      });

      expect(newAdapter).toBeDefined();
      await newAdapter.cleanup();
      
      // Clean up the test database file
      try {
        if (fs.existsSync(initTestDbPath)) {
          fs.unlinkSync(initTestDbPath);
        }
        if (fs.existsSync(`${initTestDbPath}-wal`)) {
          fs.unlinkSync(`${initTestDbPath}-wal`);
        }
        if (fs.existsSync(`${initTestDbPath}-shm`)) {
          fs.unlinkSync(`${initTestDbPath}-shm`);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }, TEST_TIMEOUT);

    it('should handle initialization with default in-memory database', async () => {
      // Test with no config - should use in-memory database
      const memoryAdapter = new SQLiteAdapter();
      
      await memoryAdapter.initialize();
      expect(memoryAdapter).toBeDefined();
      
      const health = await memoryAdapter.getHealth();
      expect(health.healthy).toBe(true);
      
      await memoryAdapter.cleanup();
    }, TEST_TIMEOUT);
  });

  describe('store', () => {
    it('should store data successfully', async () => {
      const testData = new Uint8Array([10, 20, 30, 40, 50]);
      const metadata = createTestMetadata();

      const result = await adapter.store(testData, metadata);

      expect(result).toBeDefined();
      expect(result.id).toBe(metadata.id);
      expect(result.reference).toBe(`sqlite://${testDbPath}#${metadata.id}`);
      expect(result.metadata.id).toBe(metadata.id);
      expect(result.metadata.size).toBe(metadata.size);
    }, TEST_TIMEOUT);

    it('should overwrite existing data with same ID', async () => {
      const testData1 = new Uint8Array([1, 2, 3]);
      const testData2 = new Uint8Array([4, 5, 6]);
      const metadata1 = createTestMetadata('same-id');
      const metadata2 = { ...createTestMetadata('same-id'), size: 200 };

      await adapter.store(testData1, metadata1);
      const result = await adapter.store(testData2, metadata2);

      expect(result.metadata.size).toBe(200);
    }, TEST_TIMEOUT);

    it('should throw error for invalid data', async () => {
      const metadata = createTestMetadata();

      await expect(
        adapter.store(null as any, metadata)
      ).rejects.toThrow();
    }, TEST_TIMEOUT);
  });

  describe('retrieve', () => {
    it('should retrieve stored data successfully', async () => {
      const testData = new Uint8Array([10, 20, 30, 40, 50]);
      const metadata = createTestMetadata();

      await adapter.store(testData, metadata);
      const result = await adapter.retrieve(metadata.id);

      expect(result).toBeDefined();
      expect(result.encryptedData).toEqual(testData);
      expect(result.metadata.id).toBe(metadata.id);
      expect(result.metadata.contentType).toBe(metadata.contentType);
      expect(result.metadata.size).toBe(metadata.size);
      expect(result.metadata.encryptionMetadata.messageKit).toEqual(metadata.encryptionMetadata.messageKit);
      expect(result.metadata.metadata).toEqual(metadata.metadata);
    }, TEST_TIMEOUT);

    it('should throw NOT_FOUND error for non-existent data', async () => {
      await expect(
        adapter.retrieve('non-existent-id')
      ).rejects.toThrow(TacoStorageError);

      try {
        await adapter.retrieve('non-existent-id');
      } catch (error) {
        expect(error).toBeInstanceOf(TacoStorageError);
        expect((error as TacoStorageError).type).toBe(TacoStorageErrorType.NOT_FOUND);
      }
    }, TEST_TIMEOUT);

    it('should handle metadata without custom data', async () => {
      const testData = new Uint8Array([1, 2, 3]);
      const metadata = {
        ...createTestMetadata(),
        metadata: undefined,
      };

      await adapter.store(testData, metadata);
      const result = await adapter.retrieve(metadata.id);

      expect(result.metadata.metadata).toBeUndefined();
    }, TEST_TIMEOUT);
  });

  describe('delete', () => {
    it('should delete existing data successfully', async () => {
      const testData = new Uint8Array([1, 2, 3]);
      const metadata = createTestMetadata();

      await adapter.store(testData, metadata);
      const deleteResult = await adapter.delete(metadata.id);

      expect(deleteResult).toBe(true);

      // Verify data is actually deleted
      await expect(adapter.retrieve(metadata.id)).rejects.toThrow(TacoStorageError);
    }, TEST_TIMEOUT);

    it('should return false for non-existent data', async () => {
      const result = await adapter.delete('non-existent-id');
      expect(result).toBe(false);
    }, TEST_TIMEOUT);
  });

  describe('exists', () => {
    it('should return true for existing data', async () => {
      const testData = new Uint8Array([1, 2, 3]);
      const metadata = createTestMetadata();

      await adapter.store(testData, metadata);
      const exists = await adapter.exists(metadata.id);

      expect(exists).toBe(true);
    }, TEST_TIMEOUT);

    it('should return false for non-existent data', async () => {
      const exists = await adapter.exists('non-existent-id');
      expect(exists).toBe(false);
    }, TEST_TIMEOUT);
  });

  describe('list', () => {
    it('should list stored data', async () => {
      const testData = new Uint8Array([1, 2, 3]);
      const metadata1 = createTestMetadata('id-1');
      const metadata2 = createTestMetadata('id-2');

      await adapter.store(testData, metadata1);
      await adapter.store(testData, metadata2);

      const list = await adapter.list();

      expect(list).toHaveLength(2);
      expect(list).toContain('id-1');
      expect(list).toContain('id-2');
      expect(typeof list[0]).toBe('string');
    }, TEST_TIMEOUT);

    it('should respect limit parameter', async () => {
      const testData = new Uint8Array([1, 2, 3]);
      
      for (let i = 0; i < 5; i++) {
        await adapter.store(testData, createTestMetadata(`id-${i}`));
      }

      const list = await adapter.list(3);

      expect(list).toHaveLength(3);
    }, TEST_TIMEOUT);

    it('should respect offset parameter', async () => {
      const testData = new Uint8Array([1, 2, 3]);
      
      for (let i = 0; i < 5; i++) {
        await adapter.store(testData, createTestMetadata(`id-${i}`));
      }

      const list = await adapter.list(10, 2);

      expect(list).toHaveLength(3); // 5 total - 2 offset = 3
    }, TEST_TIMEOUT);

    it('should return empty array when no data exists', async () => {
      const list = await adapter.list();
      expect(list).toHaveLength(0);
    }, TEST_TIMEOUT);
  });

  describe('getHealth', () => {
    it('should return healthy status when database is accessible', async () => {
      const health = await adapter.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.details).toBeDefined();
      expect(health.details?.databasePath).toBe(testDbPath);
    }, TEST_TIMEOUT);
  });

  describe('cleanup', () => {
    it('should cleanup resources successfully', async () => {
      await expect(adapter.cleanup()).resolves.not.toThrow();
    }, TEST_TIMEOUT);

    it('should handle multiple cleanup calls gracefully', async () => {
      await adapter.cleanup();
      await expect(adapter.cleanup()).resolves.not.toThrow();
    }, TEST_TIMEOUT);
  });

  describe('edge cases', () => {
    it('should handle large data', async () => {
      const largeData = new Uint8Array(1024 * 1024); // 1MB
      largeData.fill(42);
      
      const metadata = {
        ...createTestMetadata(),
        size: largeData.length,
      };

      const result = await adapter.store(largeData, metadata);
      expect(result.metadata.size).toBe(largeData.length);

      const retrieved = await adapter.retrieve(metadata.id);
      expect(retrieved.encryptedData).toEqual(largeData);
    }, TEST_TIMEOUT);

    it('should handle special characters in metadata', async () => {
      const testData = new Uint8Array([1, 2, 3]);
      const metadata = {
        ...createTestMetadata(),
        metadata: {
          emoji: '🔒',
          unicode: 'こんにちは',
          special: '<>&"\'',
        },
      };

      await adapter.store(testData, metadata);
      const result = await adapter.retrieve(metadata.id);

      expect(result.metadata.metadata).toEqual(metadata.metadata);
    }, TEST_TIMEOUT);
  });
});
