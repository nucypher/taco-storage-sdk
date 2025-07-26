// Mock for helia module

export const createHelia = jest.fn().mockResolvedValue({
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  libp2p: {
    peerId: { toString: () => 'mock-peer-id' },
    getConnections: () => [],
    status: 'started',
    services: {
      identify: { host: { protocolVersion: '1.0.0' } }
    }
  },
  blockstore: {
    has: jest.fn().mockResolvedValue(false),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  },
  pins: {
    add: jest.fn().mockResolvedValue(undefined),
    rm: jest.fn().mockResolvedValue(undefined),
    ls: jest.fn().mockReturnValue([])
  }
});
