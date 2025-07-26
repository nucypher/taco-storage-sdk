/**
 * Helia IPFS adapter integration tests
 * Tests the HeliaAdapter with embedded Helia IPFS node
 */

// Polyfill for Promise.withResolvers (Node.js < 22)
declare global {
  interface PromiseConstructor {
    withResolvers?<T>(): {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: any) => void;
    };
  }
}

if (!(Promise as any).withResolvers) {
  (Promise as any).withResolvers = function <T>() {
    let resolve: (value: T | PromiseLike<T>) => void;
    let reject: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve: resolve!, reject: reject! };
  };
}

import { HeliaAdapter } from '../../../adapters/ipfs/helia';
import {
  StorageMetadata,
  TacoStorageError,
  TacoStorageErrorType,
} from '../../../types';
import { TEST_TIMEOUT } from '../../setup';

// Skip Helia tests in regular Jest runs to avoid ES module conflicts
const skipInRegularJest =
  process.env.JEST_WORKER_ID &&
  !process.env.NODE_OPTIONS?.includes('experimental-vm-modules');

// Check if we should skip all tests
const shouldSkipTests =
  process.env.SKIP_HELIA_TESTS === 'true' || skipInRegularJest;

describe('HeliaAdapter Integration Tests', () => {
  let adapter: HeliaAdapter;

  // Extended timeout for Helia node startup
  const HELIA_TIMEOUT = 90000; // 90 seconds

  beforeAll(async () => {
    // Skip if this is a quick test run
    if (shouldSkipTests) {
      console.log('Skipping Helia tests (environment not suitable)');
      return;
    }

    console.log('Starting Helia IPFS node...');
    adapter = new HeliaAdapter({
      timeout: 15000,
      autoStart: true,
      heliaOptions: {
        libp2p: {
          addresses: {
            listen: ['/ip4/127.0.0.1/tcp/0'],
          },
          connectionGater: {
            denyDialMultiaddr: () => false,
          },
        },
      },
    });

    await adapter.initialize();
    console.log('Helia node started successfully');
  }, HELIA_TIMEOUT);

  afterAll(async () => {
    if (adapter) {
      console.log('Stopping Helia IPFS node...');
      await adapter.cleanup();
      console.log('Helia node stopped');
    }
  }, 30000);

  beforeEach(() => {
    if (shouldSkipTests) {
      pending('Helia tests are skipped');
    }
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const defaultAdapter = new HeliaAdapter();
      expect(defaultAdapter).toBeInstanceOf(HeliaAdapter);
    });

    it('should create instance with custom config', () => {
      const customAdapter = new HeliaAdapter({
        timeout: 10000,
        autoStart: false,
        heliaOptions: {
          // Custom Helia options can be added here
        },
      });
      expect(customAdapter).toBeInstanceOf(HeliaAdapter);
    });
  });

  describe('store', () => {
    it(
      'should store data and return storage result',
      async () => {
        const testData = new Uint8Array([1, 2, 3, 4, 5]);
        const metadata: StorageMetadata = {
          id: 'test-id-helia-store',
          contentType: 'application/octet-stream',
          size: testData.length,
          createdAt: new Date(),
          encryptionMetadata: {
            messageKit: Array.from(new Uint8Array([1, 2, 3])),
            conditions: { test: 'condition' },
          },
        };

        const result = await adapter.store(testData, metadata);

        expect(result.id).toBe(metadata.id);
        expect(result.reference).toMatch(/^ipfs:\/\/[a-zA-Z0-9]+$/);
        expect(result.metadata.ipfsHash).toBeDefined();
        expect(result.metadata.id).toBe(metadata.id);
      },
      TEST_TIMEOUT
    );
  });

  describe('retrieve', () => {
    let storageResult: any;

    beforeAll(async () => {
      if (process.env.SKIP_HELIA_TESTS === 'true') return;

      const testData = new Uint8Array([6, 7, 8, 9, 10]);
      const metadata: StorageMetadata = {
        id: 'test-id-helia-retrieve',
        contentType: 'application/octet-stream',
        size: testData.length,
        createdAt: new Date(),
        encryptionMetadata: {
          messageKit: Array.from(new Uint8Array([4, 5, 6])),
          conditions: { test: 'retrieve-condition' },
        },
      };

      storageResult = await adapter.store(testData, metadata);
    }, TEST_TIMEOUT);

    it(
      'should retrieve data successfully',
      async () => {
        const { encryptedData, metadata } = await adapter.retrieve(
          storageResult.reference
        );

        expect(encryptedData).toEqual(new Uint8Array([6, 7, 8, 9, 10]));
        expect(metadata.id).toBe('test-id-helia-retrieve');
        expect(metadata.contentType).toBe('application/octet-stream');
        expect(metadata.encryptionMetadata.messageKit).toEqual(
          Array.from(new Uint8Array([4, 5, 6]))
        );
      },
      TEST_TIMEOUT
    );

    it('should throw error for invalid reference format', async () => {
      await expect(adapter.retrieve('invalid-reference')).rejects.toThrow(
        TacoStorageError
      );
    });

    it('should throw error for non-existent IPFS hash', async () => {
      const fakeHash =
        'ipfs://bafybeiabc123fake456hash789nonexistent012345678901234567890abcd';
      await expect(adapter.retrieve(fakeHash)).rejects.toThrow(
        TacoStorageError
      );
    });
  });

  describe('delete', () => {
    it(
      'should delete (unpin) data successfully',
      async () => {
        const testData = new Uint8Array([11, 12, 13]);
        const metadata: StorageMetadata = {
          id: 'test-id-helia-delete',
          contentType: 'application/octet-stream',
          size: testData.length,
          createdAt: new Date(),
          encryptionMetadata: {
            messageKit: Array.from(new Uint8Array([7, 8, 9])),
            conditions: { test: 'delete-condition' },
          },
        };

        const result = await adapter.store(testData, metadata);
        const deleted = await adapter.delete(result.reference);

        expect(deleted).toBe(true);
      },
      TEST_TIMEOUT
    );

    it('should return true even with invalid reference format', async () => {
      const result = await adapter.delete('invalid-reference');
      expect(result).toBe(true);
    });
  });

  describe('exists', () => {
    let existingReference: string;

    beforeAll(async () => {
      if (process.env.SKIP_HELIA_TESTS === 'true') return;

      const testData = new Uint8Array([14, 15, 16]);
      const metadata: StorageMetadata = {
        id: 'test-id-helia-exists',
        contentType: 'application/octet-stream',
        size: testData.length,
        createdAt: new Date(),
        encryptionMetadata: {
          messageKit: Array.from(new Uint8Array([10, 11, 12])),
          conditions: { test: 'exists-condition' },
        },
      };

      const result = await adapter.store(testData, metadata);
      existingReference = result.reference;
    }, TEST_TIMEOUT);

    it(
      'should return true when content exists',
      async () => {
        const exists = await adapter.exists(existingReference);
        expect(exists).toBe(true);
      },
      TEST_TIMEOUT
    );

    it('should return false when content does not exist', async () => {
      const fakeHash =
        'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
      const exists = await adapter.exists(fakeHash);
      expect(exists).toBe(false);
    });

    it('should return false for invalid reference format', async () => {
      const exists = await adapter.exists('invalid-reference');
      expect(exists).toBe(false);
    });
  });

  describe('getHealth', () => {
    it('should return healthy status', async () => {
      const health = await adapter.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.details).toBeDefined();
      expect(health.details?.nodeId).toBeDefined();
      expect(health.details?.isStarted).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      // Create a separate adapter for cleanup testing
      const testAdapter = new HeliaAdapter();
      await testAdapter.initialize();

      // Should not throw
      await expect(testAdapter.cleanup()).resolves.not.toThrow();
    }, 30000);
  });
});
