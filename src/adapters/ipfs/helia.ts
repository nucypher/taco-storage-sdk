/**
 * Helia IPFS storage adapter implementation using embedded IPFS node
 */

import { BaseIPFSAdapter } from './base';
import {
  AdapterConfig,
  StorageMetadata,
  StorageResult,
  TacoStorageError,
  TacoStorageErrorType,
} from '../../types';
import { createHelia } from 'helia';
import { unixfs } from '@helia/unixfs';
import type { Helia } from '@helia/interface';
import type { UnixFS } from '@helia/unixfs';

/**
 * Configuration interface for Helia IPFS adapter
 */
export interface HeliaAdapterConfig extends AdapterConfig {
  /** Optional timeout for IPFS operations in milliseconds */
  timeout?: number;
  /** Whether to start the Helia node immediately on initialization */
  autoStart?: boolean;
  /** Custom Helia configuration options */
  heliaOptions?: {
    /** Custom libp2p configuration */
    libp2p?: any;
    /** Custom datastore configuration */
    datastore?: any;
    /** Custom blockstore configuration */
    blockstore?: any;
  };
}

/**
 * Helia IPFS storage adapter for embedded IPFS node functionality
 */
export class HeliaAdapter extends BaseIPFSAdapter {
  private helia: Helia | null = null;
  private fs: UnixFS | null = null;
  private readonly heliaConfig: {
    timeout: number;
    autoStart: boolean;
    heliaOptions?: HeliaAdapterConfig['heliaOptions'];
  };

  constructor(config: HeliaAdapterConfig = {}) {
    super(config);

    const heliaConfig = config as HeliaAdapterConfig;
    this.heliaConfig = {
      timeout: heliaConfig.timeout ?? 30000, // 30 second default timeout
      autoStart: heliaConfig.autoStart ?? true,
      heliaOptions: heliaConfig.heliaOptions
    };
  }

  /**
   * Initialize the Helia adapter by creating and starting the embedded IPFS node
   */
  public async initialize(): Promise<void> {
    try {
      // Create Helia node with optional custom configuration
      const heliaOptions = this.heliaConfig.heliaOptions || {
        // Default configuration for better compatibility
        libp2p: {
          addresses: {
            listen: ['/ip4/0.0.0.0/tcp/0']
          }
        }
      };
      
      this.helia = await createHelia(heliaOptions);

      // Create UnixFS interface for file operations
      this.fs = unixfs(this.helia);

      // Start the node if autoStart is enabled
      if (this.heliaConfig.autoStart && this.helia.libp2p.status !== 'started') {
        await this.helia.libp2p.start();
      }

      // Verify the node is operational
      const peerId = this.helia.libp2p.peerId;
      if (!peerId) {
        throw new Error('Failed to get peer ID from Helia node');
      }
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.ADAPTER_ERROR,
        `Failed to initialize Helia IPFS adapter: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  protected generateReference(id: string): string {
    return this.formatReference(id);
  }

  /**
   * Ensure Helia node and filesystem are initialized before use
   */
  private ensureHeliaReady(): { helia: Helia; fs: UnixFS } {
    if (!this.helia || !this.fs) {
      throw new TacoStorageError(
        TacoStorageErrorType.ADAPTER_ERROR,
        'Helia IPFS adapter not initialized. Call initialize() first.'
      );
    }
    return { helia: this.helia, fs: this.fs };
  }

  // Implementation of abstract methods from BaseIPFSAdapter

  protected async addContent(data: Uint8Array): Promise<string> {
    const { fs } = this.ensureHeliaReady();
    
    const cid = await fs.addBytes(data, {
      onProgress: (progress) => {
        // Optional: could emit progress events here
      }
    });
    
    return cid.toString();
  }

  protected async getContent(hash: string): Promise<Uint8Array> {
    const { fs } = this.ensureHeliaReady();
    
    const cid = this.parseCID(hash);
    const chunks: Uint8Array[] = [];
    
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), this.heliaConfig.timeout)
    );
    
    try {
      const contentIterable = fs.cat(cid, {
        onProgress: (progress) => {
          // Optional: could emit progress events here
        }
      });
      
      // Race between content retrieval and timeout
      const result = await Promise.race([
        (async () => {
          for await (const chunk of contentIterable) {
            chunks.push(chunk);
          }
          return Buffer.concat(chunks);
        })(),
        timeoutPromise
      ]);
      
      return result;
    } catch (error) {
      if ((error as Error).message.includes('not found')) {
        throw new TacoStorageError(
          TacoStorageErrorType.NOT_FOUND,
          `Content not found for hash: ${hash}`,
          error as Error
        );
      }
      throw error;
    }
  }

  protected async pinContent(hash: string): Promise<void> {
    const { helia } = this.ensureHeliaReady();
    
    const cid = this.parseCID(hash);
    await helia.pins.add(cid);
  }

  protected async unpinContent(hash: string): Promise<void> {
    const { helia } = this.ensureHeliaReady();
    
    const cid = this.parseCID(hash);
    await helia.pins.rm(cid);
  }

  protected async contentExists(hash: string): Promise<boolean> {
    const { helia } = this.ensureHeliaReady();
    const cid = this.parseCID(hash);
    
    try {
      // Try to get the block to see if it exists
      return await helia.blockstore.has(cid);
    } catch {
      return false;
    }
  }

  protected async getIPFSHealth(): Promise<{ connected: boolean; nodeId?: string }> {
    try {
      const { helia } = this.ensureHeliaReady();
      const peerId = helia.libp2p.peerId;
      const isStarted = helia.libp2p.status === 'started';
      
      return {
        connected: isStarted,
        nodeId: peerId.toString(),
      };
    } catch {
      return { connected: false };
    }
  }

  /**
   * Store encrypted data and metadata using Helia
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

      // Add to IPFS using Helia
      const ipfsHash = await this.addContent(new TextEncoder().encode(JSON.stringify(dataPackage)));

      // Pin the content by default
      await this.pinContent(ipfsHash);

      return {
        id: metadata.id,
        reference: this.generateReference(ipfsHash),
        metadata: this.createIPFSMetadata(ipfsHash, metadata),
      };
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.STORAGE_ERROR,
        `Failed to store data using Helia: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Retrieve encrypted data and metadata using Helia
   */
  public async retrieve(
    id: string
  ): Promise<{ encryptedData: Uint8Array; metadata: StorageMetadata }> {
    this.validateId(id);

    try {
      const ipfsHash = this.validateAndParseReference(id);
      
      // Retrieve from IPFS using Helia
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
      if (error instanceof TacoStorageError && error.type === TacoStorageErrorType.NOT_FOUND) {
        throw error;
      }

      throw new TacoStorageError(
        TacoStorageErrorType.RETRIEVAL_ERROR,
        `Failed to retrieve data using Helia: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Delete data from IPFS (unpin)
   */
  public async delete(id: string): Promise<boolean> {
    this.validateId(id);
    
    const ipfsHash = this.parseReference(id);
    try {
      await this.unpinContent(ipfsHash);
      return true;
    } catch (error) {
      // If it's an initialization error, let it propagate
      if (error instanceof TacoStorageError && error.type === TacoStorageErrorType.ADAPTER_ERROR) {
        throw error;
      }
      // Return true even if unpin fails, as the content might not have been pinned
      return true;
    }
  }

  /**
   * Check if data exists in Helia
   */
  public async exists(id: string): Promise<boolean> {
    this.validateId(id);

    try {
      const ipfsHash = this.validateAndParseReference(id);
      return await this.contentExists(ipfsHash);
    } catch (error) {
      // If it's an initialization error, let it propagate
      if (error instanceof TacoStorageError && error.type === TacoStorageErrorType.ADAPTER_ERROR) {
        throw error;
      }
      return false;
    }
  }

  /**
   * Get Helia node health status
   */
  public async getHealth(): Promise<{
    healthy: boolean;
    details?: Record<string, unknown>;
  }> {
    // Check if adapter is initialized
    if (!this.helia || !this.fs) {
      return {
        healthy: false,
        details: {
          status: 'not_initialized',
          error: 'Helia adapter not initialized'
        }
      };
    }

    try {
      const { helia } = this.ensureHeliaReady();
      const peerId = helia.libp2p.peerId;
      const isStarted = helia.libp2p.status === 'started';
      const connections = helia.libp2p.getConnections();

      return {
        healthy: isStarted,
        details: {
          nodeId: peerId.toString(),
          isStarted,
          connectionCount: connections.length,
          multiaddrs: helia.libp2p.getMultiaddrs().map(ma => ma.toString()),
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
   * Clean up Helia node resources
   */
  public async cleanup(): Promise<void> {
    if (this.helia) {
      try {
        await this.helia.stop();
      } catch (error) {
        // Log error but don't throw, cleanup should be non-blocking
        console.warn('Error stopping Helia node:', error);
      } finally {
        this.helia = null;
        this.fs = null;
      }
    }
  }
}
