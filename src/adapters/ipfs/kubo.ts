/**
 * Kubo IPFS storage adapter implementation using kubo-rpc-client
 */

import { BaseIPFSAdapter } from './base';
import {
  AdapterConfig,
  StorageMetadata,
  StorageResult,
  TacoStorageError,
  TacoStorageErrorType,
} from '../../types';
import { create as createKuboClient } from 'kubo-rpc-client';

// Type for the Kubo RPC client (using ReturnType to infer proper type)
type IPFSHTTPClient = ReturnType<typeof createKuboClient>;

/**
 * Configuration interface for Kubo IPFS adapter
 */
export interface KuboAdapterConfig extends AdapterConfig {
  /** IPFS node URL (defaults to localhost:5001) */
  url?: string;
  /** Optional timeout for IPFS operations in milliseconds */
  timeout?: number;
  /** Whether to pin content to prevent garbage collection */
  pin?: boolean;
}

/**
 * Kubo IPFS storage adapter for connecting to external Kubo IPFS nodes via RPC
 */
export class KuboAdapter extends BaseIPFSAdapter {
  private client: IPFSHTTPClient | null = null;
  private readonly shouldPin: boolean;
  private readonly timeout: number;
  private readonly url: string;

  constructor(config: KuboAdapterConfig = {}) {
    super(config);

    const kuboConfig = config as KuboAdapterConfig;
    this.shouldPin = kuboConfig.pin ?? true;
    this.timeout = kuboConfig.timeout ?? 30000; // 30 second default timeout
    this.url = kuboConfig.url || 'http://localhost:5001';

    // Client will be created in initialize() using static import
  }

  /**
   * Initialize the Kubo adapter by testing connectivity and validating configuration
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
        'Failed to initialize Kubo IPFS adapter - check that IPFS node is running and accessible',
        error as Error
      );
    }
  }

  protected generateReference(id: string): string {
    return this.formatReference(id);
  }

  /**
   * Ensure client is initialized before use
   */
  private ensureClient(): IPFSHTTPClient {
    if (!this.client) {
      throw new TacoStorageError(
        TacoStorageErrorType.ADAPTER_ERROR,
        'Kubo IPFS adapter not initialized. Call initialize() first.'
      );
    }
    return this.client;
  }

  // Implementation of abstract methods from BaseIPFSAdapter

  protected async addContent(data: Uint8Array): Promise<string> {
    const client = this.ensureClient();
    const result = await client.add(data, {
      pin: this.shouldPin,
      cidVersion: 1,
    });
    return result.cid.toString();
  }

  protected async getContent(hash: string): Promise<Uint8Array> {
    const client = this.ensureClient();
    const stream = client.cat(hash, { timeout: this.timeout });
    const chunks: Uint8Array[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  protected async pinContent(hash: string): Promise<void> {
    if (this.shouldPin) {
      const client = this.ensureClient();
      await client.pin.add(hash);
    }
  }

  protected async unpinContent(hash: string): Promise<void> {
    if (this.shouldPin) {
      const client = this.ensureClient();
      await client.pin.rm(hash);
    }
  }

  protected async contentExists(hash: string): Promise<boolean> {
    try {
      const client = this.ensureClient();
      await client.files.stat(`/ipfs/${hash}`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  protected async getIPFSHealth(): Promise<{ connected: boolean; nodeId?: string }> {
    try {
      const client = this.ensureClient();
      const nodeInfo = await client.id();
      return {
        connected: true,
        nodeId: nodeInfo.id.toString(),
      };
    } catch {
      return { connected: false };
    }
  }

  /**
   * Store encrypted data and metadata on IPFS
   */
  public async store(
    encryptedData: Uint8Array,
    metadata: StorageMetadata
  ): Promise<StorageResult> {
    this.validateData(encryptedData);

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
      const ipfsHash = await this.addContent(new TextEncoder().encode(JSON.stringify(dataPackage)));

      return {
        id: metadata.id,
        reference: this.generateReference(ipfsHash),
        metadata: this.createIPFSMetadata(ipfsHash, metadata),
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
      const ipfsHash = this.validateAndParseReference(id);
      
      // Retrieve from IPFS
      const content = await this.getContent(ipfsHash);
      const dataPackage = JSON.parse(new TextDecoder().decode(content));

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
      const ipfsHash = this.parseReference(id);
      await this.unpinContent(ipfsHash);
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
      const ipfsHash = this.validateAndParseReference(id);
      return await this.contentExists(ipfsHash);
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
