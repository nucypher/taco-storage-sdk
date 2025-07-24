/**
 * Storage adapters for TACo Storage SDK
 */

export { BaseStorageAdapter } from './base';
export type { IStorageAdapter } from './base';

// IPFS adapters
export { BaseIPFSAdapter, KuboAdapter, IPFSAdapter } from './ipfs/index';
export type { KuboAdapterConfig, IPFSAdapterConfig } from './ipfs/index';

// SQLite adapter
export { SQLiteAdapter } from './sqlite';
export type { SQLiteAdapterConfig } from './sqlite';

// Re-export adapter types for convenience
export type { AdapterConfig } from '../types';
