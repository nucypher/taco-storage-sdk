/**
 * TACo Storage SDK - Professional SDK for encrypted data storage and retrieval
 * 
 * This SDK provides a high-level interface for storing and retrieving encrypted data
 * using TACo (Threshold Access Control) with multiple storage provider adapters.
 * 
 * @example
 * ```typescript
 * import { TacoStorage, KuboAdapter } from 'nucypher-experimental-taco-storage';
 * import { ethers } from 'ethers';
 * 
 * // Create storage instance with Kubo IPFS adapter
 * const storage = TacoStorage.createWithKubo({
 *   domain: 'devnet',
 *   ritualId: 123,
 * });
 * 
 * // Store encrypted data
 * const signer = new ethers.Wallet('...');
 * const data = new TextEncoder().encode('Hello, encrypted world!');
 * const result = await storage.store(data, signer, {
 *   contentType: 'text/plain',
 *   expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
 * });
 * 
 * // Retrieve and decrypt data
 * const retrieved = await storage.retrieve(result.id, signer);
 * console.log(new TextDecoder().decode(retrieved.data));
 * ```
 */

// Core exports
export { TacoStorage } from './core/storage';
export { TacoEncryptionService } from './core/encryption';

// Storage adapters
export {
  BaseStorageAdapter,
  BaseIPFSAdapter,
  KuboAdapter,
  HeliaAdapter,
  SQLiteAdapter,
} from './adapters';

export type {
  IStorageAdapter,
} from './adapters';

export type {
  KuboAdapterConfig,
  HeliaAdapterConfig,
  SQLiteAdapterConfig,
} from './adapters';

// Types and interfaces
export type {
  TacoConfig,
  StorageMetadata,
  StorageResult,
  RetrievalResult,
  AdapterConfig,
} from './types';

export type { StoreOptions } from './core/storage';

// Error handling
export {
  TacoStorageError,
  TacoStorageErrorType,
} from './types';

// Version information
export const VERSION = '0.1.0';
