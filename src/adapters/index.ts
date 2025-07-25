/**
 * Storage adapters for TACo Storage SDK
 */

export { BaseStorageAdapter } from './base';
export type { IStorageAdapter } from './base';

// IPFS adapters
export { BaseIPFSAdapter, KuboAdapter, HeliaAdapter } from './ipfs/index';
export type { KuboAdapterConfig, HeliaAdapterConfig } from './ipfs/index';

// Pinata adapter
export { PinataAdapter } from './pinata';
export type { PinataAdapterConfig } from './pinata';

// SQLite adapter
export { SQLiteAdapter } from './sqlite';
export type { SQLiteAdapterConfig } from './sqlite';

// Re-export adapter types for convenience
export type { AdapterConfig } from '../types';
