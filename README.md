# TACo Storage SDK

TypeScript SDK for encrypted data storage with TACo (Threshold Access Control), supporting multiple storage providers including IPFS and SQLite.

## Overview

This TypeScript SDK provides a high-level interface for storing and retrieving encrypted data using NuCypher's TACo (Threshold Access Control) system. It features a pluggable adapter architecture supporting multiple storage providers including IPFS for decentralized storage and SQLite for local/centralized storage.

## Features

- **Threshold Encryption**: Secure data encryption using TACo's threshold access control
- **Multiple Storage Adapters**: Support for IPFS (decentralized) and SQLite (local/centralized) storage
- **Flexible Access Control**: Time-based, NFT ownership, and custom condition support
- **Professional Architecture**: Clean separation of concerns with adapter pattern
- **TypeScript Support**: Full type safety and excellent developer experience
- **Comprehensive Testing**: Unit tests and integration tests included

## Installation

```bash
npm install @nucypher/taco-storage
```

## Quick Start

### Basic Usage with IPFS

```typescript
import { TacoStorage } from '@nucypher/taco-storage';
import { ethers } from 'ethers';

// Create storage instance with IPFS adapter
const storage = TacoStorage.createWithIPFS({
  domain: 'devnet',
  ritualId: 123,
});

// Initialize signer
const provider = new ethers.providers.JsonRpcProvider('YOUR_RPC_URL');
const signer = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);

// Store encrypted data
const data = new TextEncoder().encode('Hello, encrypted world!');
const result = await storage.store(data, signer, {
  contentType: 'text/plain',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
});

console.log('Stored with ID:', result.id);

// Retrieve and decrypt data
const retrieved = await storage.retrieve(result.id, signer);
const decryptedText = new TextDecoder().decode(retrieved.data);
console.log('Decrypted:', decryptedText);
```

### Basic Usage with SQLite

```typescript
import { TacoStorage } from '@nucypher/taco-storage';

// Create storage instance with SQLite adapter
const storage = TacoStorage.createWithSQLite(
  {
    domain: 'devnet',
    ritualId: 123,
  },
  {
    databasePath: './data.db',
    enableWAL: true,
  }
);

// Use the same store/retrieve API
const result = await storage.store(data, signer);
const retrieved = await storage.retrieve(result.id, signer);
```

## Advanced Usage

### Custom Access Conditions

```typescript
import { conditions } from '@nucypher/taco';

// Create NFT ownership condition
const nftCondition = storage.encryptionService.createNFTCondition(
  '0x1234...', // NFT contract address
  '123'        // Token ID (optional)
);

await storage.store(data, signer, {
  conditions: nftCondition,
  contentType: 'application/json',
});
```

### Custom Storage Adapter

```typescript
import { BaseStorageAdapter, StorageMetadata, StorageResult } from '@nucypher/taco-storage';

class CustomAdapter extends BaseStorageAdapter {
  async store(encryptedData: Uint8Array, metadata: StorageMetadata): Promise<StorageResult> {
    // Implement your custom storage logic
    // ...
  }

  async retrieve(id: string) {
    // Implement your custom retrieval logic
    // ...
  }

  // Implement other required methods...
}

// Use with TacoStorage
const adapter = new CustomAdapter(config);
const storage = new TacoStorage(adapter, tacoConfig);
```

## API Reference

### TacoStorage

The main class for encrypted storage operations.

#### Methods

- `store(data, signer, options?)` - Store encrypted data
- `retrieve(id, signer)` - Retrieve and decrypt data
- `delete(id)` - Delete stored data
- `exists(id)` - Check if data exists
- `getMetadata(id)` - Get metadata without decrypting
- `list(limit?, offset?)` - List stored data IDs (adapter dependent)
- `getHealth()` - Get storage system health status
- `cleanup()` - Clean up resources

#### Static Methods

- `TacoStorage.createWithIPFS(config, ipfsConfig?)` - Create instance with IPFS adapter
- `TacoStorage.createWithSQLite(config, sqliteConfig?)` - Create instance with SQLite adapter

### Storage Adapters

#### IPFSAdapter

Decentralized storage using IPFS.

**Configuration:**
```typescript
interface IPFSAdapterConfig {
  url?: string;        // IPFS node URL (default: http://localhost:5001)
  timeout?: number;    // Operation timeout in ms
  pin?: boolean;       // Whether to pin content (default: true)
}
```

#### SQLiteAdapter

Local/centralized storage using SQLite.

**Configuration:**
```typescript
interface SQLiteAdapterConfig {
  databasePath?: string;  // Database file path (default: in-memory)
  enableWAL?: boolean;    // Enable WAL mode (default: false)
  timeout?: number;       // Connection timeout in ms
}
```

## Error Handling

The SDK provides comprehensive error handling with specific error types:

```typescript
import { TacoStorageError, TacoStorageErrorType } from '@nucypher/taco-storage';

try {
  await storage.store(data, signer);
} catch (error) {
  if (error instanceof TacoStorageError) {
    switch (error.type) {
      case TacoStorageErrorType.ENCRYPTION_ERROR:
        console.log('Encryption failed:', error.message);
        break;
      case TacoStorageErrorType.STORAGE_ERROR:
        console.log('Storage failed:', error.message);
        break;
      // Handle other error types...
    }
  }
}
```

## Development

### Prerequisites

- Node.js 16+
- npm or yarn
- IPFS Desktop or Kubo node (for IPFS adapter testing)

### IPFS Integration Tests

The IPFS adapter integration tests run against a real IPFS node and require special setup:

**Requirements:**
- IPFS Desktop or Kubo node running on `http://localhost:5001`
- Tests use `kubo-rpc-client` for modern IPFS communication
- No mocking - all tests run against real IPFS operations

**Setup IPFS Desktop:**
1. Download and install [IPFS Desktop](https://github.com/ipfs/ipfs-desktop)
2. Start IPFS Desktop (default API at `http://localhost:5001`)
3. Run tests: `npm run test:ipfs`

**Or Setup Kubo CLI:**
```bash
# Install Kubo
brew install ipfs  # macOS
# or download from https://github.com/ipfs/kubo/releases

# Initialize and start daemon
ipfs init
ipfs daemon

# Run IPFS tests
npm run test:ipfs
```

**Note:** IPFS tests are excluded from the main test suite (`npm test`) because they:
- Require Node.js experimental VM modules (`--experimental-vm-modules`)
- Need a running IPFS node
- Use real network operations (not mocked)

### Setup

```bash
# Clone the repository
git clone https://github.com/nucypher/taco-storage-sdk.git
cd taco-storage-sdk

# Install dependencies
npm install

# Build the project
npm run build

# Run tests (excludes IPFS tests)
npm test

# Run IPFS integration tests (requires local IPFS node)
npm run test:ipfs

# Run ALL tests (main + IPFS integration)
npm run test:all

# Run all tests with coverage
npm run test:coverage

# Run linting
npm run lint
```

### Project Structure

```
src/
├── adapters/           # Storage adapter implementations
│   ├── base.ts        # Base adapter interface and abstract class
│   ├── ipfs.ts        # IPFS adapter
│   ├── sqlite.ts      # SQLite adapter
│   └── index.ts       # Adapter exports
├── core/              # Core functionality
│   ├── encryption.ts  # TACo encryption service
│   └── storage.ts     # Main TacoStorage class
├── types/             # TypeScript type definitions
│   └── index.ts       # Type exports
├── __tests__/         # Test files
│   └── setup.ts       # Test setup and utilities
└── index.ts           # Main entry point
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## Support

- [Documentation](https://docs.nucypher.com/taco)
- [GitHub Issues](https://github.com/nucypher/taco-storage-sdk/issues)
- [Discord Community](https://discord.gg/nucypher)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history and changes.
