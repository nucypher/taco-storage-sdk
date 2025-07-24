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

export interface PinataAdapterConfig extends AdapterConfig {}

export class PinataAdapter extends BaseStorageAdapter {
  private client: PinataSDK | null = null;
  private readonly url: string;
  private readonly jwt: string;
  constructor(config: PinataAdapterConfig) {
    super(config);

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
            ...metadata.encryptionMetadata,
          },
        },
      };

      const dataPackageJson = JSON.stringify(dataPackage);
      // TODO: what name convention should we use for these files?
      const file = new File([dataPackageJson], 'file.json', {
        type: 'text/plain',
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
    const files = await client.files.public.list().cid(id);

    return files.files.length > 0;
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
      const status = await client.files.public.list();
      return {
        healthy: true,
        details: {},
      };
    } catch (error) {
      return {
        healthy: false,
        details: {},
      };
    }
  }
}
