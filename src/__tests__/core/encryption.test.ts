/**
 * Tests for TacoEncryptionService
 */

import { TacoEncryptionService } from '../../core/encryption';
import { ethers } from 'ethers';
import { domains } from '@nucypher/taco';
import { TEST_TIMEOUT } from '../setup';

// Mock the TACo imports
jest.mock('@nucypher/taco', () => ({
  domains: {
    DEVNET: 'devnet',
  },
  initialize: jest.fn(),
  encrypt: jest.fn(),
  decrypt: jest.fn(),
  ThresholdMessageKit: {
    fromBytes: jest.fn(),
  },
  conditions: {
    base: {
      time: {
        TimeCondition: jest.fn(),
      },
    },
    predefined: {
      erc721: {
        ERC721Ownership: jest.fn(),
      },
    },
  },
}));

describe('TacoEncryptionService', () => {
  let encryptionService: TacoEncryptionService;
  let mockProvider: ethers.providers.Provider;
  let mockSigner: ethers.Signer;

  beforeEach(() => {
    // Create mock provider and signer
    mockProvider = {
      getNetwork: jest.fn().mockResolvedValue({ chainId: 1 }),
    } as unknown as ethers.providers.Provider;

    mockSigner = {
      getAddress: jest
        .fn()
        .mockResolvedValue('0x1234567890123456789012345678901234567890'),
      signMessage: jest.fn().mockResolvedValue('mock-signature'),
    } as unknown as ethers.Signer;

    encryptionService = new TacoEncryptionService({
      domain: domains.DEVNET,
      ritualId: 1,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      expect(encryptionService).toBeDefined();
    });

    it('should create instance with empty domain', () => {
      const service = new TacoEncryptionService({
        domain: '',
        ritualId: 1,
      });
      expect(service).toBeDefined();
    });

    it('should create instance with null provider', () => {
      const service = new TacoEncryptionService({
        domain: domains.DEVNET,
        ritualId: 1,
      });
      expect(service).toBeDefined();
    });
  });

  describe('encrypt', () => {
    const testData = new Uint8Array([1, 2, 3, 4, 5]);
    let mockCondition: any;

    beforeEach(() => {
      const { encrypt, conditions, initialize } = require('@nucypher/taco');
      
      // Mock initialize to avoid TACo system initialization
      initialize.mockResolvedValue(undefined);
      
      // Create a mock condition using the mocked constructor
      mockCondition = { type: 'time', returnValueTest: { value: 1234567890 } };
      conditions.base.time.TimeCondition.mockReturnValue(mockCondition);
      
      encrypt.mockResolvedValue({
        toBytes: () => new Uint8Array([10, 20, 30]),
      });
    });

    it(
      'should encrypt data successfully',
      async () => {
        const result = await encryptionService.encrypt(
          testData,
          mockCondition,
          mockProvider,
          mockSigner
        );

        expect(result).toBeDefined();
        expect(result.messageKit).toEqual({
          toBytes: expect.any(Function),
        });
        expect(result.conditions).toEqual(mockCondition);
      },
      TEST_TIMEOUT
    );

    it(
      'should throw error when encrypt fails',
      async () => {
        const { encrypt } = require('@nucypher/taco');
        encrypt.mockRejectedValue(new Error('Encryption failed'));

        await expect(
          encryptionService.encrypt(
            testData,
            mockCondition,
            mockProvider,
            mockSigner
          )
        ).rejects.toThrow('Failed to encrypt data: Encryption failed');
      },
      TEST_TIMEOUT
    );

    it('should throw error for empty data', async () => {
      await expect(
        encryptionService.encrypt(
          new Uint8Array(),
          mockCondition,
          mockProvider,
          mockSigner
        )
      ).rejects.toThrow('Data to encrypt cannot be empty');
    });

    it('should handle null condition', async () => {
      const result = await encryptionService.encrypt(
        testData,
        null as any,
        mockProvider,
        mockSigner
      );
      expect(result.conditions).toBeNull();
    });
  });

  describe('decrypt', () => {
    const mockMessageKit = [10, 20, 30];
    let mockCondition: any;
    const expectedDecryptedData = new Uint8Array([1, 2, 3, 4, 5]);

    beforeEach(() => {
      const { decrypt, ThresholdMessageKit, conditions, initialize } = require('@nucypher/taco');
      
      // Mock initialize to avoid TACo system initialization
      initialize.mockResolvedValue(undefined);
      
      // Create a mock condition using the mocked constructor
      mockCondition = { type: 'time', returnValueTest: { value: 1234567890 } };
      conditions.base.time.TimeCondition.mockReturnValue(mockCondition);

      // Mock ThresholdMessageKit.fromBytes
      const mockMessageKitInstance = {
        decrypt: jest.fn().mockResolvedValue(expectedDecryptedData),
      };

      ThresholdMessageKit.fromBytes.mockReturnValue(mockMessageKitInstance);

      decrypt.mockResolvedValue(expectedDecryptedData);
    });

    it(
      'should decrypt data successfully',
      async () => {
        const { decrypt } = require('@nucypher/taco');

        const result = await encryptionService.decrypt(
          { messageKit: mockMessageKit, conditions: mockCondition },
          mockProvider,
          mockSigner
        );

        expect(result).toEqual(expectedDecryptedData);
        expect(decrypt).toHaveBeenCalled();
      },
      TEST_TIMEOUT
    );

    it(
      'should throw error when decrypt fails',
      async () => {
        const { decrypt } = require('@nucypher/taco');
        decrypt.mockRejectedValue(new Error('Decryption failed'));

        await expect(
          encryptionService.decrypt(
            { messageKit: mockMessageKit, conditions: mockCondition },
            mockProvider,
            mockSigner
          )
        ).rejects.toThrow('Failed to decrypt data: Decryption failed');
      },
      TEST_TIMEOUT
    );

    it('should handle empty message kit gracefully', async () => {
      const result = await encryptionService.decrypt(
        { messageKit: [], conditions: mockCondition },
        mockProvider,
        mockSigner
      );
      expect(result).toEqual(expectedDecryptedData);
    });
  });

  describe('createTimeCondition', () => {
    it('should create time condition successfully', () => {
      const { conditions } = require('@nucypher/taco');
      const mockTimeCondition = { type: 'time', endTime: Date.now() };
      conditions.base.time.TimeCondition.mockReturnValue(mockTimeCondition);

      const endTime = new Date(Date.now() + 86400000); // 1 day in future
      const result = encryptionService.createTimeCondition(endTime);

      expect(result).toEqual(mockTimeCondition);
      expect(conditions.base.time.TimeCondition).toHaveBeenCalledWith({
        chain: 80001,
        method: 'blocktime',
        returnValueTest: {
          comparator: '<=',
          value: Math.floor(endTime.getTime() / 1000),
        },
      });
    });

    it('should throw error for past time', () => {
      const pastTime = new Date(Date.now() - 1000);
      expect(() => {
        encryptionService.createTimeCondition(pastTime);
      }).toThrow('End time must be in the future');
    });
  });

  describe('createNFTCondition', () => {
    it('should create NFT condition successfully', () => {
      const { conditions } = require('@nucypher/taco');
      const mockNFTCondition = { type: 'erc721', contractAddress: '0x123' };
      conditions.predefined.erc721.ERC721Ownership.mockReturnValue(
        mockNFTCondition
      );

      const contractAddress = '0x1234567890123456789012345678901234567890';
      const result = encryptionService.createNFTCondition(contractAddress);

      expect(result).toEqual(mockNFTCondition);
      expect(conditions.predefined.erc721.ERC721Ownership).toHaveBeenCalledWith(
        {
          contractAddress,
          chain: 80001,
          parameters: [],
        }
      );
    });

    it('should throw error for invalid contract address', () => {
      expect(() => {
        encryptionService.createNFTCondition('invalid-address');
      }).toThrow('Invalid contract address');
    });
  });
});
