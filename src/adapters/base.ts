/**
 * Base storage adapter interface and abstract implementation
 */

import { AdapterConfig, StorageMetadata, StorageResult, RetrievalResult, TacoStorageError, TacoStorageErrorType } from '../types';

/**
 * Base interface that all storage adapters must implement
 */
export interface IStorageAdapter {
  /**
   * Initialize the storage adapter
   * @returns Promise that resolves when initialization is complete
   */
  initialize(): Promise<void>;

  /**
   * Store encrypted data with metadata
   * @param encryptedData - The encrypted data to store
   * @param metadata - Metadata associated with the data
   * @returns Promise resolving to storage result
   */
  store(encryptedData: Uint8Array, metadata: StorageMetadata): Promise<StorageResult>;

  /**
   * Retrieve encrypted data by ID
   * @param id - Unique identifier for the data
   * @returns Promise resolving to the encrypted data and metadata
   */
  retrieve(id: string): Promise<{ encryptedData: Uint8Array; metadata: StorageMetadata }>;

  /**
   * Delete stored data by ID
   * @param id - Unique identifier for the data
   * @returns Promise resolving to success status
   */
  delete(id: string): Promise<boolean>;

  /**
   * Check if data exists by ID
   * @param id - Unique identifier for the data
   * @returns Promise resolving to existence status
   */
  exists(id: string): Promise<boolean>;

  /**
   * List all stored data IDs (optional, for adapters that support it)
   * @param limit - Maximum number of IDs to return
   * @param offset - Number of IDs to skip
   * @returns Promise resolving to array of IDs
   */
  list?(limit?: number, offset?: number): Promise<string[]>;

  /**
   * Get adapter-specific health/status information
   * @returns Promise resolving to health status
   */
  getHealth(): Promise<{ healthy: boolean; details?: Record<string, unknown> }>;

  /**
   * Clean up resources when adapter is no longer needed
   */
  cleanup(): Promise<void>;
}

/**
 * Abstract base class providing common functionality for storage adapters
 */
export abstract class BaseStorageAdapter implements IStorageAdapter {
  protected readonly config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = { ...config };
  }

  /**
   * Validate that required configuration is present
   * @param requiredKeys - Array of required configuration keys
   * @throws Error if required configuration is missing
   */
  protected validateConfig(requiredKeys: string[]): void {
    const missingKeys = requiredKeys.filter(key => !(key in this.config));
    if (missingKeys.length > 0) {
      throw new TacoStorageError(
        TacoStorageErrorType.INVALID_CONFIG,
        `Missing required configuration: ${missingKeys.join(', ')}`
      );
    }
  }

  /**
   * Generate a unique storage reference for the adapter
   * @param id - The data ID
   * @returns Adapter-specific reference string
   */
  protected abstract generateReference(id: string): string;

  /**
   * Validate data ID format
   * @param id - The ID to validate
   * @throws Error if ID format is invalid
   */
  protected validateId(id: string): void {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('Invalid ID: must be a non-empty string');
    }
  }

  /**
   * Validate encrypted data
   * @param data - The data to validate
   * @throws Error if data is invalid
   */
  protected validateData(data: Uint8Array): void {
    if (!data || !(data instanceof Uint8Array) || data.length === 0) {
      throw new Error('Invalid data: must be a non-empty Uint8Array');
    }
  }

  // Abstract methods that must be implemented by concrete adapters
  public abstract initialize(): Promise<void>;
  public abstract store(encryptedData: Uint8Array, metadata: StorageMetadata): Promise<StorageResult>;
  public abstract retrieve(id: string): Promise<{ encryptedData: Uint8Array; metadata: StorageMetadata }>;
  public abstract delete(id: string): Promise<boolean>;
  public abstract exists(id: string): Promise<boolean>;
  public abstract getHealth(): Promise<{ healthy: boolean; details?: Record<string, unknown> }>;
  public abstract cleanup(): Promise<void>;
}
