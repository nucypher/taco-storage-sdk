/**
 * Pinata storage adapter implementation
 */
import { PinataSDK } from 'pinata';

import {
  AdapterConfig,
  StorageMetadata,
  StorageResult,
  TacoStorageError,
  TacoStorageErrorType,
} from '../types';
import { BaseStorageAdapter } from './base';

export interface PinataAdapterConfig extends AdapterConfig {
  /** Pinata gateway URL */
  url: string;
  /** Pinata JSON Web Token */
  jwt: string;
}

export class PinataAdapter extends BaseStorageAdapter {
  private client: PinataSDK | null = null;
  private readonly url: string;
  private readonly jwt: string;
  constructor(config: PinataAdapterConfig) {
    super(config);

    // Validate required configuration
    this.validateConfig(['url', 'jwt']);

    const pinataConfig = config as PinataAdapterConfig;
    this.url = pinataConfig.url;
    this.jwt = pinataConfig.jwt;
  }

  public async initialize(): Promise<void> {
    this.client = new PinataSDK({
      pinataJwt: this.jwt,
      pinataGateway: this.url,
    });
  }

  private ensureClient(): PinataSDK {
    if (!this.client) {
      throw new TacoStorageError(
        TacoStorageErrorType.ADAPTER_ERROR,
        'Pinata adapter not initialized. Call initialize() first.'
      );
    }
    return this.client;
  }

  protected generateReference(id: string): string {
    return `https://${this.url}/ipfs/${id}`;
  }

  public async store(
    encryptedData: Uint8Array,
    metadata: StorageMetadata
  ): Promise<StorageResult> {
    this.validateData(encryptedData);
    const client = this.ensureClient();

    try {
      const dataPackage = {
        data: Array.from(encryptedData),
        metadata: {
          ...metadata,
          createdAt: metadata.createdAt.toISOString(),
          encryptionMetadata: {
            messageKit: Array.from(metadata.encryptionMetadata.messageKit),
            conditions: metadata.encryptionMetadata.conditions,
          },
        },
      };

      const dataPackageJson = JSON.stringify(dataPackage);
      // Use a meaningful filename with timestamp and content type
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `taco-data-${timestamp}`;
      const file = new File([dataPackageJson], fileName, {
        type: 'application/json',
      });
      const result = await client.upload.public.file(file);

      return {
        id: result.id,
        reference: this.generateReference(result.id),
        metadata: metadata,
      };
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.STORAGE_ERROR,
        `Failed to store data on IPFS: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  public async retrieve(
    id: string
  ): Promise<{ encryptedData: Uint8Array; metadata: StorageMetadata }> {
    this.validateId(id);
    const client = this.ensureClient();
    try {
      const { data, contentType } = await client.gateways.public.get(id);

      // Reconstruct the original data and metadata
      const dataPackage = JSON.parse(data as string);
      const encryptedData = new Uint8Array(dataPackage.data);
      const metadata: StorageMetadata = {
        ...dataPackage.metadata,
        createdAt: new Date(dataPackage.metadata.createdAt),
        encryptionMetadata: {
          messageKit: new Uint8Array(dataPackage.metadata.encryptionMetadata.messageKit),
          conditions: dataPackage.metadata.encryptionMetadata.conditions,
        },
      };
      return { encryptedData, metadata };
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.STORAGE_ERROR,
        `Failed to retrieve data from Pinata: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  public async delete(id: string): Promise<boolean> {
    this.validateId(id);
    const client = this.ensureClient();

    try {
      const unpin = await client.files.public.delete([id]);
      return true;
    } catch (error) {
      // Pinata doesn't really "delete" content, just unpins it
      // Return true even if unpin fails, as the content might not have been pinned
      return true;
    }
  }

  public async exists(id: string): Promise<boolean> {
    this.validateId(id);
    const client = this.ensureClient();
    
    try {
      const files = await client.files.public.list().cid(id);
      return files.files.length > 0;
    } catch (error) {
      // If we can't list files, assume the content doesn't exist
      return false;
    }
  }

  public async cleanup(): Promise<void> {
    // IPFS HTTP client doesn't require explicit cleanup
    // This method is here for interface compliance
  }

  public async getHealth(): Promise<{
    healthy: boolean;
    details?: Record<string, unknown>;
  }> {
    try {
      const client = this.ensureClient();
      const startTime = Date.now();
      const status = await client.files.public.list();
      const responseTime = Date.now() - startTime;
      
      return {
        healthy: true,
        details: {
          gateway: this.url,
          responseTime: `${responseTime}ms`,
          fileCount: status.files?.length || 0,
          authenticated: true,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          gateway: this.url,
          error: (error as Error).message,
          authenticated: false,
        },
      };
    }
  }
}
