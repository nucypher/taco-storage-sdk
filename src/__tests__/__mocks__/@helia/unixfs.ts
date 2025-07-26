// Mock for @helia/unixfs module
import { CID } from '../multiformats/cid';

export const unixfs = jest.fn().mockReturnValue({
  addBytes: jest.fn().mockResolvedValue(new CID(0x55, new Uint8Array([1, 2, 3]), 1)),
  cat: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
});
