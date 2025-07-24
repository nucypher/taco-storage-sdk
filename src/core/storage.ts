/**
 * Main TACo Storage SDK class
 */

import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { conditions, ThresholdMessageKit } from '@nucypher/taco';

import { IStorageAdapter } from '../adapters/base';
import { TacoEncryptionService } from './encryption';
import {
  TacoConfig,
  StorageMetadata,
  StorageResult,
  RetrievalResult,
  TacoStorageError,
  TacoStorageErrorType,
} from '../types';

/**
 * Options for storing data
 */
export interface StoreOptions {
  /** Custom ID for the data (auto-generated if not provided) */
  id?: string;
  /** MIME type of the data */
  contentType?: string;
  /** Custom metadata to associate with the data */
  metadata?: Record<string, unknown>;
  /** Custom access conditions (if not provided, time-based condition will be used) */
  condition?: conditions.condition.Condition;
  /** Access expiry date (used if conditions not provided) */
  expiresAt?: Date;
}

/**
 * Main TACo Storage SDK class providing encrypted storage and retrieval
 */
export class TacoStorage {
  private readonly adapter: IStorageAdapter;
  private readonly encryptionService: TacoEncryptionService;
  private readonly provider: ethers.providers.Provider;

  constructor(
    adapter: IStorageAdapter,
    tacoConfig: TacoConfig,
    provider: ethers.providers.Provider
  ) {
    this.adapter = adapter;
    this.encryptionService = new TacoEncryptionService(tacoConfig);
    this.provider = provider;
  }

  /**
   * Initialize the TacoStorage instance and its components
   * @returns Promise that resolves when initialization is complete
   */
  public async initialize(): Promise<void> {
    // Initialize the storage adapter
    await this.adapter.initialize();

    // Initialize the encryption service
    await this.encryptionService.initialize();
  }

  /**
   * Store data with encryption and access control
   * @param data - Data to store
   * @param signer - Ethereum signer for encryption
   * @param options - Storage options
   * @returns Promise resolving to storage result
   */
  public async store(
    data: Uint8Array | string,
    signer: ethers.Signer,
    options: StoreOptions = {}
  ): Promise<StorageResult> {
    if (!data || data.length === 0) {
      throw new TacoStorageError(
        TacoStorageErrorType.INVALID_CONFIG,
        'Data cannot be empty'
      );
    }

    try {
      const id = options.id || uuidv4();
      const contentType = options.contentType || 'application/octet-stream';
      const now = new Date();

      // Create access conditions
      let accessConditions = options.condition;
      if (!accessConditions) {
        const expiresAt =
          options.expiresAt || new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
        accessConditions =
          this.encryptionService.createTimeCondition(expiresAt);
      }

      // Encrypt the data
      const encryptionResult = await this.encryptionService.encrypt(
        data,
        accessConditions,
        this.provider,
        signer
      );

      // Serialize the ThresholdMessageKit for storage
      const serializedMessageKit = encryptionResult.messageKit.toBytes();

      // Create metadata
      const metadata: StorageMetadata = {
        id,
        contentType,
        size: data.length,
        createdAt: now,
        ...(options.metadata && { metadata: options.metadata }),
        encryptionMetadata: {
          messageKit: Array.from(serializedMessageKit),
          conditions: encryptionResult.conditions,
        },
      };

      // Store encrypted data using the adapter
      const result = await this.adapter.store(serializedMessageKit, metadata);

      return result;
    } catch (error) {
      if (error instanceof TacoStorageError) {
        throw error;
      }

      throw new TacoStorageError(
        TacoStorageErrorType.STORAGE_ERROR,
        `Failed to store data: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Retrieve and decrypt data
   * @param id - Unique identifier for the data
   * @param signer - Ethereum signer for decryption
   * @returns Promise resolving to decrypted data and metadata
   */
  public async retrieve(
    id: string,
    signer: ethers.Signer
  ): Promise<RetrievalResult> {
    if (!id || typeof id !== 'string') {
      throw new TacoStorageError(
        TacoStorageErrorType.INVALID_CONFIG,
        'ID must be a non-empty string'
      );
    }

    try {
      // Retrieve encrypted data and metadata from adapter
      const { encryptedData, metadata } = await this.adapter.retrieve(id);

      // Reconstruct ThresholdMessageKit from stored data
      const messageKitBytes = new Uint8Array(
        metadata.encryptionMetadata.messageKit
      );
      const messageKit = ThresholdMessageKit.fromBytes(messageKitBytes);

      // Decrypt the data
      const decryptedData = await this.encryptionService.decrypt(
        messageKit,
        this.provider
      );

      return {
        data: decryptedData,
        metadata,
      };
    } catch (error) {
      if (error instanceof TacoStorageError) {
        throw error;
      }

      throw new TacoStorageError(
        TacoStorageErrorType.RETRIEVAL_ERROR,
        `Failed to retrieve data: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Delete stored data
   * @param id - Unique identifier for the data
   * @returns Promise resolving to success status
   */
  public async delete(id: string): Promise<boolean> {
    if (!id || typeof id !== 'string') {
      throw new TacoStorageError(
        TacoStorageErrorType.INVALID_CONFIG,
        'ID must be a non-empty string'
      );
    }

    try {
      return await this.adapter.delete(id);
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.STORAGE_ERROR,
        `Failed to delete data: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Check if data exists
   * @param id - Unique identifier for the data
   * @returns Promise resolving to existence status
   */
  public async exists(id: string): Promise<boolean> {
    if (!id || typeof id !== 'string') {
      throw new TacoStorageError(
        TacoStorageErrorType.INVALID_CONFIG,
        'ID must be a non-empty string'
      );
    }

    try {
      return await this.adapter.exists(id);
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.STORAGE_ERROR,
        `Failed to check existence: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Get metadata for stored data without decrypting
   * @param id - Unique identifier for the data
   * @returns Promise resolving to storage metadata
   */
  public async getMetadata(id: string): Promise<StorageMetadata> {
    if (!id || typeof id !== 'string') {
      throw new TacoStorageError(
        TacoStorageErrorType.INVALID_CONFIG,
        'ID must be a non-empty string'
      );
    }

    try {
      const { metadata } = await this.adapter.retrieve(id);
      return metadata;
    } catch (error) {
      if (error instanceof TacoStorageError) {
        throw error;
      }

      throw new TacoStorageError(
        TacoStorageErrorType.RETRIEVAL_ERROR,
        `Failed to get metadata: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * List stored data IDs (if supported by adapter)
   * @param limit - Maximum number of IDs to return
   * @param offset - Number of IDs to skip
   * @returns Promise resolving to array of IDs
   */
  public async list(limit?: number, offset?: number): Promise<string[]> {
    if (!this.adapter.list) {
      throw new TacoStorageError(
        TacoStorageErrorType.ADAPTER_ERROR,
        'List operation not supported by this adapter'
      );
    }

    try {
      return await this.adapter.list(limit, offset);
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.RETRIEVAL_ERROR,
        `Failed to list data: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Get health status of the storage system
   * @returns Promise resolving to health information
   */
  public async getHealth(): Promise<{
    healthy: boolean;
    details?: Record<string, unknown>;
  }> {
    try {
      return await this.adapter.getHealth();
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: (error as Error).message,
        },
      };
    }
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    try {
      await this.adapter.cleanup();
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.ADAPTER_ERROR,
        `Failed to cleanup: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Create a new TacoStorage instance with IPFS adapter
   * @param config - TACo configuration
   * @param provider - Ethereum provider
   * @param ipfsConfig - IPFS adapter configuration
   * @returns Promise resolving to initialized TacoStorage instance
   */
  public static async createWithIPFS(
    config: TacoConfig,
    provider: ethers.providers.Provider,
    ipfsConfig?: import('../adapters/ipfs/index').IPFSAdapterConfig
  ): Promise<TacoStorage> {
    const { IPFSAdapter } = require('../adapters/ipfs/index');
    const adapter = new IPFSAdapter(ipfsConfig);
    const storage = new TacoStorage(adapter, config, provider);
    await storage.initialize();
    return storage;
  }

  /**
   * Create a new TacoStorage instance with Kubo IPFS adapter
   * @param config - TACo configuration
   * @param provider - Ethereum provider
   * @param kuboConfig - Kubo adapter configuration
   * @returns Promise resolving to initialized TacoStorage instance
   */
  public static async createWithKubo(
    config: TacoConfig,
    provider: ethers.providers.Provider,
    kuboConfig?: import('../adapters/ipfs/index').KuboAdapterConfig
  ): Promise<TacoStorage> {
    const { KuboAdapter } = require('../adapters/ipfs/index');
    const adapter = new KuboAdapter(kuboConfig);
    const storage = new TacoStorage(adapter, config, provider);
    await storage.initialize();
    return storage;
  }

  /**
   * Create a new TacoStorage instance with Helia IPFS adapter
   * @param config - TACo configuration
   * @param provider - Ethereum provider
   * @param heliaConfig - Helia adapter configuration
   * @returns Promise resolving to initialized TacoStorage instance
   */
  public static async createWithHelia(
    config: TacoConfig,
    provider: ethers.providers.Provider,
    heliaConfig?: import('../adapters/ipfs/index').HeliaAdapterConfig
  ): Promise<TacoStorage> {
    const { HeliaAdapter } = require('../adapters/ipfs/index');
    const adapter = new HeliaAdapter(heliaConfig);
    const storage = new TacoStorage(adapter, config, provider);
    await storage.initialize();
    return storage;
  }

  /**
   * Create a new TacoStorage instance with SQLite adapter
   * @param config - TACo configuration
   * @param provider - Ethereum provider
   * @param sqliteConfig - SQLite adapter configuration
   * @returns Promise resolving to initialized TacoStorage instance
   */
  public static async createWithSQLite(
    config: TacoConfig,
    provider: ethers.providers.Provider,
    sqliteConfig?: import('../adapters/sqlite').SQLiteAdapterConfig
  ): Promise<TacoStorage> {
    const { SQLiteAdapter } = require('../adapters/sqlite');
    const adapter = new SQLiteAdapter(sqliteConfig);
    const storage = new TacoStorage(adapter, config, provider);
    await storage.initialize();
    return storage;
  }
}
