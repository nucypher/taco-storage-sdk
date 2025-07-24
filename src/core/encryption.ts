/**
 * Core encryption and decryption functionality using TACo
 */

import {
  encrypt,
  decrypt,
  conditions,
  domains,
  initialize,
  ThresholdMessageKit,
} from '@nucypher/taco';
import { ethers } from 'ethers';
import { TacoConfig, TacoStorageError, TacoStorageErrorType } from '../types';

// todo read from environment variable
const domain = domains.DEVNET as string;

/**
 * Encryption result containing encrypted data and metadata
 */
export interface EncryptionResult {
  /** The encrypted message kit */
  messageKit: ThresholdMessageKit;
  /** Access control conditions */
  conditions: any;
}

/**
 * Core encryption service using TACo threshold encryption
 */
export class TacoEncryptionService {
  private readonly config: TacoConfig;
  private initialized = false;

  constructor(config: TacoConfig) {
    this.config = { ...config };
  }

  /**
   * Initialize the TACo system
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await initialize();
      this.initialized = true;
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.ENCRYPTION_ERROR,
        'Failed to initialize TACo system',
        error as Error
      );
    }
  }

  /**
   * Encrypt data using TACo threshold encryption
   * @param data - Data to encrypt
   * @param condition - Access control condition
   * @param provider - Ethereum provider
   * @param signer - Ethereum signer for the encryption
   * @returns Promise resolving to encryption result
   */
  public async encrypt(
    data: Uint8Array | string,
    condition: conditions.condition.Condition,
    provider: ethers.providers.Provider,
    signer: ethers.Signer
  ): Promise<EncryptionResult> {
    await this.initialize();

    if (!data || data.length === 0) {
      throw new TacoStorageError(
        TacoStorageErrorType.ENCRYPTION_ERROR,
        'Data to encrypt cannot be empty'
      );
    }

    try {
      const messageKit = await encrypt(
        provider,
        domain,
        data,
        condition,
        this.config.ritualId || 0,
        signer
      );

      return {
        messageKit,
        conditions: condition,
      };
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.ENCRYPTION_ERROR,
        `Failed to encrypt data: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Decrypt data using TACo threshold decryption
   * @param messageKit - ThresholdMessageKit containing encrypted data
   * @param provider - Ethereum provider
   * @param context - Optional condition context
   * @returns Promise resolving to decrypted data
   */
  public async decrypt(
    messageKit: ThresholdMessageKit,
    provider: ethers.providers.Provider,
    context?: conditions.context.ConditionContext
  ): Promise<Uint8Array> {
    await this.initialize();

    try {
      const decryptedData = await decrypt(
        provider,
        domain,
        messageKit,
        context
      );

      return decryptedData;
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.DECRYPTION_ERROR,
        `Failed to decrypt data: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Create simple time-based access conditions
   * @param endTime - End time for access
   * @returns Time-based condition
   */
  public createTimeCondition(endTime: Date): conditions.condition.Condition {
    const now = new Date();
    if (endTime <= now) {
      throw new TacoStorageError(
        TacoStorageErrorType.INVALID_CONFIG,
        'End time must be in the future'
      );
    }

    return new conditions.base.time.TimeCondition({
      chain: 80001, // Polygon Mumbai testnet
      method: 'blocktime',
      returnValueTest: {
        comparator: '<=',
        value: Math.floor(endTime.getTime() / 1000),
      },
    });
  }

  /**
   * Create NFT ownership conditions
   * @param contractAddress - NFT contract address
   * @param tokenId - Specific token ID (optional)
   * @returns NFT ownership condition
   */
  public createNFTCondition(
    contractAddress: string,
    tokenId?: string
  ): conditions.condition.Condition {
    if (!ethers.utils.isAddress(contractAddress)) {
      throw new TacoStorageError(
        TacoStorageErrorType.INVALID_CONFIG,
        'Invalid contract address'
      );
    }

    return new conditions.predefined.erc721.ERC721Ownership({
      contractAddress,
      chain: 80001, // Polygon Mumbai testnet
      parameters: tokenId ? [tokenId] : [],
    });
  }
}
