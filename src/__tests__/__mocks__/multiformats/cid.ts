// Mock for multiformats/cid to avoid ES module issues in Jest

export class CID {
  constructor(public code: number, public multihash: Uint8Array, public version: number = 1) {}

  static parse(cid: string): CID {
    // Simple mock parsing
    if (typeof cid !== 'string' || cid.length < 10) {
      throw new Error('Invalid CID');
    }
    return new CID(0x55, new Uint8Array([1, 2, 3]), 1);
  }

  toString(): string {
    return 'QmMockCIDHash123456789';
  }

  static isCID(obj: any): obj is CID {
    return obj instanceof CID;
  }
}
