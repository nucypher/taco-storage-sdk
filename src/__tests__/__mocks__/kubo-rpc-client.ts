/**
 * Mock implementation of kubo-rpc-client for testing
 */

// Store for tracking what was added to IPFS
const mockStorage = new Map<string, Uint8Array>();
let mockCidCounter = 1;

// Mock IPFS API methods
const mockIPFSApi = {
  add: jest.fn().mockImplementation(async (data: Uint8Array) => {
    // Generate a unique mock CID
    const cidString = `QmMockCID${mockCidCounter++}${Math.random().toString(36).substr(2, 9)}`;
    
    // Store the data
    mockStorage.set(cidString, data);
    
    // Return a mock CID with proper structure
    return { 
      cid: {
        toString: jest.fn().mockReturnValue(cidString)
      },
      path: cidString
    };
  }),
  
  cat: jest.fn().mockImplementation((cid: string) => {
    // Check if the CID exists in our mock storage
    const storedData = mockStorage.get(cid);
    
    if (!storedData) {
      // Throw error for non-existent CIDs
      throw new Error(`no link named "${cid}" under QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn`);
    }
    
    return (async function* () {
      yield storedData;
    })();
  }),
  
  pin: {
    add: jest.fn().mockImplementation(async (cid: string) => {
      return { pins: [cid] };
    }),
    rm: jest.fn().mockImplementation(async (cid: string) => {
      return { pins: [cid] };
    }),
    ls: jest.fn().mockImplementation(async (cid?: string) => {
      if (cid) {
        // Check if CID exists in storage
        if (!mockStorage.has(cid)) {
          return (async function* () {
            // Empty iterable for non-existent CID
          })();
        }
        // Return an async iterable for specific CID
        return (async function* () {
          yield { cid, type: 'recursive' };
        })();
      }
      // Return an async iterable for all pins
      return (async function* () {
        for (const [cidKey] of mockStorage) {
          yield { cid: cidKey, type: 'recursive' };
        }
      })();
    }),
  },
  
  id: jest.fn().mockImplementation(async () => {
    return {
      id: {
        toString: jest.fn().mockReturnValue('QmMockPeerID123456789')
      },
      publicKey: 'mockPublicKey',
      addresses: ['/ip4/127.0.0.1/tcp/4001'],
      protocolVersion: 'ipfs/0.1.0',
      agentVersion: 'go-ipfs/0.12.0',
    };
  }),
  
  version: jest.fn().mockImplementation(async () => {
    return {
      version: '0.12.0',
      commit: 'abc123',
      repo: '12',
      system: 'linux/amd64',
      golang: 'go1.18.1',
    };
  }),
  
  swarm: {
    peers: jest.fn().mockImplementation(async () => {
      return [
        {
          peer: 'QmMockPeer1',
          addr: '/ip4/127.0.0.1/tcp/4001',
        },
      ];
    }),
  },
  
  repo: {
    stat: jest.fn().mockImplementation(async () => {
      return {
        numObjects: 100,
        repoSize: 1024 * 1024, // 1MB
        storageMax: 10 * 1024 * 1024 * 1024, // 10GB
        version: '12',
      };
    }),
  },

  files: {
    stat: jest.fn().mockImplementation(async (path: string) => {
      // Extract CID from path (format: /ipfs/QmCID...)
      const cidMatch = path.match(/\/ipfs\/(.+)/);
      if (!cidMatch || !cidMatch[1]) {
        throw new Error('invalid path');
      }
      
      const cid = cidMatch[1];
      
      // Check if CID exists in our mock storage
      const storedData = mockStorage.get(cid);
      if (storedData) {
        return {
          size: storedData.length,
          type: 'file',
          cid: cid,
        };
      }
      
      // Throw error for unknown CIDs
      throw new Error('file does not exist');
    }),
  },
};

// Mock the create function
export const create = jest.fn().mockImplementation((config?: any) => {
  return mockIPFSApi;
});

// Export default
export default { create };
