/**
 * Storage adapters for TACo Storage SDK
 */

export { BaseStorageAdapter } from './base';
export type { IStorageAdapter } from './base';
export { IPFSAdapter } from './ipfs';
export type { IPFSAdapterConfig } from './ipfs';
export { SQLiteAdapter } from './sqlite';
export type { SQLiteAdapterConfig } from './sqlite';

// Re-export adapter types for convenience
export type { AdapterConfig } from '../types';
