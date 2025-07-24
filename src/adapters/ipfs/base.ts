import { CID } from 'multiformats/cid';
import { BaseStorageAdapter } from '../base';
import {
  StorageResult,
  StorageMetadata,
  TacoStorageError,
  TacoStorageErrorType,
} from '../../types';

/**
 * Abstract base class for IPFS-based storage adapters.
 * Provides common IPFS functionality and validation.
 */
export abstract class BaseIPFSAdapter extends BaseStorageAdapter {
  /**
   * Validates if a string is a valid IPFS hash (CID).
   * Supports both CIDv0 (Qm...) and CIDv1 (baf...) formats.
   */
  protected validateIPFSHash(hash: string): boolean {
    try {
      CID.parse(hash);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parses a CID from a string, with validation.
   */
  protected parseCID(hash: string): CID {
    try {
      return CID.parse(hash);
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.INVALID_REFERENCE,
        `Invalid IPFS hash format: ${hash}`,
        error as Error
      );
    }
  }

  /**
   * Formats an IPFS hash as a storage reference.
   */
  protected formatReference(hash: string): string {
    return `ipfs://${hash}`;
  }

  /**
   * Extracts IPFS hash from a storage reference.
   * Handles both "ipfs://hash" and plain "hash" formats.
   */
  protected parseReference(reference: string): string {
    if (reference.startsWith('ipfs://')) {
      return reference.slice(7); // Remove 'ipfs://' prefix
    }
    return reference;
  }

  /**
   * Creates storage metadata with IPFS hash included.
   */
  protected createIPFSMetadata(hash: string, originalMetadata: StorageMetadata): StorageMetadata {
    return {
      ...originalMetadata,
      ipfsHash: hash,
    };
  }

  /**
   * Validates reference format and returns the IPFS hash.
   */
  protected validateAndParseReference(reference: string): string {
    const hash = this.parseReference(reference);
    
    if (!this.validateIPFSHash(hash)) {
      throw new TacoStorageError(
        TacoStorageErrorType.INVALID_REFERENCE,
        `Invalid IPFS reference format: ${reference}`
      );
    }
    
    return hash;
  }

  // Abstract methods that implementations must provide
  
  /**
   * Add content to IPFS and return the hash.
   */
  protected abstract addContent(data: Uint8Array): Promise<string>;

  /**
   * Retrieve content from IPFS by hash.
   */
  protected abstract getContent(hash: string): Promise<Uint8Array>;

  /**
   * Pin content in IPFS (if supported).
   */
  protected abstract pinContent(hash: string): Promise<void>;

  /**
   * Unpin content from IPFS (if supported).
   */
  protected abstract unpinContent(hash: string): Promise<void>;

  /**
   * Check if content exists in IPFS.
   */
  protected abstract contentExists(hash: string): Promise<boolean>;

  /**
   * Get health status of the IPFS connection.
   */
  protected abstract getIPFSHealth(): Promise<{ connected: boolean; nodeId?: string }>;
}
