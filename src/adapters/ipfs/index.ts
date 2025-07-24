/**
 * IPFS storage adapters
 */

export { BaseIPFSAdapter } from './base';
export { KuboAdapter, type KuboAdapterConfig } from './kubo';
export { HeliaAdapter, type HeliaAdapterConfig } from './helia';

// For backward compatibility, export KuboAdapter as IPFSAdapter
export { KuboAdapter as IPFSAdapter } from './kubo';
export type { KuboAdapterConfig as IPFSAdapterConfig } from './kubo';
