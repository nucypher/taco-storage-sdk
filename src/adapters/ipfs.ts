/**
 * IPFS storage adapter implementation using modern Kubo RPC client
 */

import { BaseStorageAdapter } from './base';
import {
  AdapterConfig,
  StorageMetadata,
  StorageResult,
  TacoStorageError,
  TacoStorageErrorType,
} from '../types';
import { create as createKuboClient } from 'kubo-rpc-client';

// Type for the Kubo RPC client (using ReturnType to infer proper type)
type IPFSHTTPClient = ReturnType<typeof createKuboClient>;

/**
 * Configuration interface for IPFS adapter
 */
export interface IPFSAdapterConfig extends AdapterConfig {
  /** IPFS node URL (defaults to localhost:5001) */
  url?: string;
  /** Optional timeout for IPFS operations in milliseconds */
  timeout?: number;
  /** Whether to pin content to prevent garbage collection */
  pin?: boolean;
}

/**
 * IPFS storage adapter for decentralized data storage
 */
export class IPFSAdapter extends BaseStorageAdapter {
  private client: IPFSHTTPClient | null = null;
  private readonly shouldPin: boolean;
  private readonly timeout: number;
  private readonly url: string;

  constructor(config: IPFSAdapterConfig = {}) {
    super(config);

    const ipfsConfig = config as IPFSAdapterConfig;
    this.shouldPin = ipfsConfig.pin ?? true;
    this.timeout = ipfsConfig.timeout ?? 30000; // 30 second default timeout
    this.url = ipfsConfig.url || 'http://localhost:5001';

    // Client will be created in initialize() using static import (may change to dynamic import in future)
  }

  /**
   * Initialize the IPFS adapter by testing connectivity and validating configuration
   */
  public async initialize(): Promise<void> {
    try {
      // Create Kubo RPC client using static import
      this.client = createKuboClient({
        url: this.url,
        timeout: this.timeout,
      });

      // Test IPFS connectivity by getting node ID and version info
      const [id, version] = await Promise.all([
        this.client.id(),
        this.client.version(),
      ]);

      // Validate that we can communicate with the IPFS node
      if (!id || !version) {
        throw new Error('Invalid response from IPFS node');
      }
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.ADAPTER_ERROR,
        'Failed to initialize IPFS adapter - check that IPFS node is running and accessible',
        error as Error
      );
    }
  }

  protected generateReference(id: string): string {
    return `ipfs://${id}`;
  }

  /**
   * Ensure client is initialized before use
   */
  private ensureClient(): IPFSHTTPClient {
    if (!this.client) {
      throw new TacoStorageError(
        TacoStorageErrorType.ADAPTER_ERROR,
        'IPFS adapter not initialized. Call initialize() first.'
      );
    }
    return this.client;
  }

  /**
   * Store encrypted data and metadata on IPFS
   */
  public async store(
    encryptedData: Uint8Array,
    metadata: StorageMetadata
  ): Promise<StorageResult> {
    this.validateData(encryptedData);
    const client = this.ensureClient();

    try {
      // Create a structured object containing both data and metadata
      const dataPackage = {
        data: Array.from(encryptedData), // Convert Uint8Array to regular array for JSON
        metadata: {
          ...metadata,
          createdAt: metadata.createdAt.toISOString(),
          encryptionMetadata: {
            ...metadata.encryptionMetadata,
          },
        },
      };

      // Add to IPFS
      const result = await client.add(JSON.stringify(dataPackage), {
        pin: this.shouldPin,
        cidVersion: 1,
      });

      const ipfsHash = result.cid.toString();

      return {
        id: metadata.id,
        reference: this.generateReference(ipfsHash),
        metadata: {
          ...metadata,
          ipfsHash,
        },
      };
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.STORAGE_ERROR,
        `Failed to store data on IPFS: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Retrieve encrypted data and metadata from IPFS
   */
  public async retrieve(
    id: string
  ): Promise<{ encryptedData: Uint8Array; metadata: StorageMetadata }> {
    this.validateId(id);

    try {
      // First, try to find the IPFS hash in our metadata
      // For this implementation, we assume the id contains or maps to the IPFS hash
      let ipfsHash = id;

      // If the id starts with 'ipfs://', extract the hash
      if (id.startsWith('ipfs://')) {
        ipfsHash = id.replace('ipfs://', '');
      }

      // Retrieve from IPFS
      const client = this.ensureClient();
      const stream = client.cat(ipfsHash, { timeout: this.timeout });
      const chunks: Uint8Array[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const content = Buffer.concat(chunks).toString('utf8');
      const dataPackage = JSON.parse(content);

      // Reconstruct the original data and metadata
      const encryptedData = new Uint8Array(dataPackage.data);
      const metadata: StorageMetadata = {
        ...dataPackage.metadata,
        createdAt: new Date(dataPackage.metadata.createdAt),
        encryptionMetadata: {
          ...dataPackage.metadata.encryptionMetadata,
          encryptedKey: new Uint8Array(
            dataPackage.metadata.encryptionMetadata.encryptedKey
          ),
          capsule: new Uint8Array(
            dataPackage.metadata.encryptionMetadata.capsule
          ),
        },
      };

      return { encryptedData, metadata };
    } catch (error) {
      if ((error as any).code === 'ERR_NOT_FOUND') {
        throw new TacoStorageError(
          TacoStorageErrorType.NOT_FOUND,
          `Data not found for ID: ${id}`,
          error as Error
        );
      }

      throw new TacoStorageError(
        TacoStorageErrorType.RETRIEVAL_ERROR,
        `Failed to retrieve data from IPFS: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Delete data from IPFS (unpin if pinned)
   */
  public async delete(id: string): Promise<boolean> {
    this.validateId(id);

    try {
      let ipfsHash = id;
      if (id.startsWith('ipfs://')) {
        ipfsHash = id.replace('ipfs://', '');
      }

      if (this.shouldPin) {
        const client = this.ensureClient();
        await client.pin.rm(ipfsHash);
      }

      return true;
    } catch (error) {
      // IPFS doesn't really "delete" content, just unpins it
      // Return true even if unpin fails, as the content might not have been pinned
      return true;
    }
  }

  /**
   * Check if data exists on IPFS
   */
  public async exists(id: string): Promise<boolean> {
    this.validateId(id);

    try {
      let ipfsHash = id;
      if (id.startsWith('ipfs://')) {
        ipfsHash = id.replace('ipfs://', '');
      }

      // Try to stat the object to see if it exists
      const client = this.ensureClient();
      await client.files.stat(`/ipfs/${ipfsHash}`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get IPFS node health status
   */
  public async getHealth(): Promise<{
    healthy: boolean;
    details?: Record<string, unknown>;
  }> {
    try {
      const client = this.ensureClient();
      const nodeId = await client.id();
      const version = await client.version();

      return {
        healthy: true,
        details: {
          nodeId: nodeId.id,
          version: version.version,
          addresses: nodeId.addresses,
        },
      };
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
   * Clean up IPFS client resources
   */
  public async cleanup(): Promise<void> {
    // IPFS HTTP client doesn't require explicit cleanup
    // This method is here for interface compliance
  }
}
