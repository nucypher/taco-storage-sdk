/**
 * Core types and interfaces for the TACo Storage SDK
 */

/**
 * Configuration for TACo encryption and decryption
 */
export interface TacoConfig {
  /** Domain for condition context */
  domain: string;
  /** RPC provider URL for blockchain interaction */
  ritualId: number;
  /** Optional custom condition context */
  conditionContext?: Record<string, unknown>;
}

/**
 * Metadata associated with stored encrypted data
 */
export interface StorageMetadata {
  /** Unique identifier for the stored data */
  id: string;
  /** MIME type of the original data */
  contentType: string;
  /** Size of the original data in bytes */
  size: number;
  /** Timestamp when the data was stored */
  createdAt: Date;
  /** Optional custom metadata */
  metadata?: Record<string, unknown>;
  /** TACo-specific encryption metadata */
  encryptionMetadata: {
    /** Serialized ThresholdMessageKit */
    messageKit: number[];
    /** Conditions for access control */
    conditions: any;
  };
  /** IPFS hash (when using IPFS adapter) */
  ipfsHash?: string;
}

/**
 * Result of a storage operation
 */
export interface StorageResult {
  /** Unique identifier for the stored data */
  id: string;
  /** Provider-specific reference (e.g., IPFS hash, database row ID) */
  reference: string;
  /** Storage metadata */
  metadata: StorageMetadata;
}

/**
 * Result of a retrieval operation
 */
export interface RetrievalResult {
  /** The decrypted data */
  data: Uint8Array;
  /** Storage metadata */
  metadata: StorageMetadata;
}

/**
 * Configuration for storage adapters
 */
export interface AdapterConfig {
  /** Adapter-specific configuration */
  [key: string]: unknown;
}

/**
 * Error types for the SDK
 */
export enum TacoStorageErrorType {
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  RETRIEVAL_ERROR = 'RETRIEVAL_ERROR',
  DECRYPTION_ERROR = 'DECRYPTION_ERROR',
  INVALID_CONFIG = 'INVALID_CONFIG',
  ADAPTER_ERROR = 'ADAPTER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
}

/**
 * Custom error class for TACo Storage operations
 */
export class TacoStorageError extends Error {
  public readonly type: TacoStorageErrorType;
  public readonly originalError: Error | undefined;

  constructor(type: TacoStorageErrorType, message: string, originalError?: Error) {
    super(message);
    this.name = 'TacoStorageError';
    this.type = type;
    this.originalError = originalError;
  }
}
