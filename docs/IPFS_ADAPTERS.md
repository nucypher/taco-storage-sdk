# IPFS Adapters Guide

The TACo Storage SDK provides two IPFS adapter implementations for different use cases:

## Overview

| Adapter | Type | Description | Use Case |
|---------|------|-------------|----------|
| **KuboAdapter** | External | Connects to external IPFS daemon | Existing IPFS infrastructure |
| **HeliaAdapter** | Embedded | Embedded IPFS node in your app | Self-contained applications |

## KuboAdapter (External IPFS)

The KuboAdapter connects to an external IPFS node running the Kubo implementation.

### Prerequisites

- Running IPFS daemon (Kubo)
- IPFS node accessible via HTTP API (default: `http://localhost:5001`)

### Installation & Setup

1. Install and start IPFS daemon:
```bash
# Install IPFS Desktop or Kubo CLI
# Then start the daemon
ipfs daemon
```

2. Use in your application:
```typescript
import { TacoStorage } from '@nucypher/taco-storage';

// Using factory method (recommended)
const storage = await TacoStorage.createWithKubo(config, provider, {
  endpoint: 'http://localhost:5001'  // Default IPFS API endpoint
});

// Or backward-compatible method
const storage = await TacoStorage.createWithIPFS(config, provider);
```

### Configuration Options

```typescript
interface KuboAdapterConfig {
  endpoint?: string;           // IPFS API endpoint (default: http://localhost:5001)
  timeout?: number;           // Request timeout in milliseconds
  headers?: Record<string, string>; // Custom HTTP headers
}
```

### Benefits

- ✅ Mature and stable IPFS implementation
- ✅ Shared node with other applications
- ✅ External node management and monitoring
- ✅ Can leverage existing IPFS infrastructure

### Drawbacks

- ❌ Requires external IPFS daemon setup
- ❌ Additional infrastructure dependency
- ❌ Network dependency for local operations

## HeliaAdapter (Embedded IPFS)

The HeliaAdapter creates an embedded IPFS node within your application using the modern Helia stack.

### Prerequisites

- No external dependencies required
- Node.js with ES modules support

### Installation & Setup

```typescript
import { TacoStorage } from '@nucypher/taco-storage';

// Using factory method (recommended)
const storage = await TacoStorage.createWithHelia(config, provider, {
  timeout: 30000,
  autoStart: true,
  heliaOptions: {
    // Custom Helia configuration
  }
});

// Manual instantiation
import { HeliaAdapter } from '@nucypher/taco-storage';

const adapter = new HeliaAdapter({
  timeout: 30000,
  autoStart: true
});
await adapter.initialize();
```

### Configuration Options

```typescript
interface HeliaAdapterConfig {
  timeout?: number;           // Operation timeout (default: 30000ms)
  autoStart?: boolean;        // Auto-start libp2p node (default: true)
  heliaOptions?: {
    libp2p?: any;            // Custom libp2p configuration
    datastore?: any;         // Custom datastore configuration
    blockstore?: any;        // Custom blockstore configuration
  };
}
```

### Common Configurations

#### Development Configuration
```typescript
const devConfig = {
  timeout: 30000,
  autoStart: true,
  heliaOptions: {
    libp2p: {
      addresses: {
        listen: ['/ip4/127.0.0.1/tcp/0']  // Localhost with random port
      }
    }
  }
};
```

#### Production Configuration
```typescript
const prodConfig = {
  timeout: 60000,
  autoStart: true,
  heliaOptions: {
    libp2p: {
      addresses: {
        listen: ['/ip4/0.0.0.0/tcp/4001']
      },
      connectionGater: {
        denyDialMultiaddr: () => false  // Customize connection filtering
      }
    }
  }
};
```

#### Offline/Testing Configuration
```typescript
const offlineConfig = {
  timeout: 10000,
  autoStart: true,
  heliaOptions: {
    libp2p: {
      addresses: {
        listen: []  // No network listening = offline mode
      }
    }
  }
};
```

### Benefits

- ✅ No external dependencies
- ✅ Self-contained application
- ✅ Modern IPFS implementation (Helia)
- ✅ Fine-grained configuration control
- ✅ Embedded in your application lifecycle

### Drawbacks

- ❌ Larger application bundle size
- ❌ Application manages IPFS node lifecycle  
- ❌ May consume more resources per application instance

## Usage Examples

### Basic Usage (Both Adapters)

```typescript
import { TacoStorage } from '@nucypher/taco-storage';
import { ethers } from 'ethers';

const config = { domain: 'lynx' };
const provider = new ethers.providers.JsonRpcProvider();

// Choose your adapter
const storage = await TacoStorage.createWithKubo(config, provider);
// OR
const storage = await TacoStorage.createWithHelia(config, provider);

// Store data
const data = new Uint8Array([1, 2, 3]);
const conditions = { /* your conditions */ };
const result = await storage.store(data, conditions);

// Retrieve data
const { encryptedData, metadata } = await storage.retrieve(result.reference);
```

### Health Monitoring

```typescript
// Check adapter health
const health = await storage.getHealth();
console.log('Adapter healthy:', health.healthy);
console.log('Details:', health.details);
```

### Resource Cleanup

```typescript
// For HeliaAdapter, cleanup embedded node
if (storage.adapter instanceof HeliaAdapter) {
  await storage.adapter.cleanup();
}

// KuboAdapter doesn't require cleanup (external node)
```

## Testing

### KuboAdapter Tests
```bash
# Requires running IPFS daemon
npm run test:ipfs
```

### HeliaAdapter Tests
```bash
# Self-contained, no external dependencies
npm run test:helia
```

### All Adapter Tests
```bash
npm run test:adapters
```

## Choosing an Adapter

### Use KuboAdapter when:
- You have existing IPFS infrastructure
- Multiple applications share the same IPFS node
- You prefer external service management
- You need maximum stability and compatibility

### Use HeliaAdapter when:
- You want self-contained applications
- You prefer modern IPFS implementations
- You don't want external infrastructure dependencies
- You need fine-grained control over the IPFS node

## Migration

### From KuboAdapter to HeliaAdapter

```typescript
// Before (KuboAdapter)
const storage = await TacoStorage.createWithIPFS(config, provider);

// After (HeliaAdapter)
const storage = await TacoStorage.createWithHelia(config, provider);
// Data stored with one adapter can be retrieved with the other (same IPFS network)
```

Both adapters are fully compatible and can read data stored by the other, as they use the same IPFS network and protocols.

## Troubleshooting

### KuboAdapter Issues
- **Connection Error**: Ensure IPFS daemon is running on the configured endpoint
- **Timeout**: Increase timeout or check IPFS node health
- **Permission Error**: Check IPFS node API access permissions

### HeliaAdapter Issues  
- **Initialization Error**: Check Node.js version and ES modules support
- **Network Issues**: Configure libp2p addresses and connection settings
- **Resource Issues**: Monitor memory usage and implement proper cleanup

### Common Solutions
- Check network connectivity
- Verify IPFS content addressing (CIDs)
- Monitor adapter health status
- Implement proper error handling and retries
