/**
 * Example usage of HeliaAdapter with TACo Storage SDK
 * 
 * This example demonstrates how to use the HeliaAdapter for embedded IPFS node functionality
 */

import { TacoStorage, HeliaAdapter } from '../src/index';
import { ethers } from 'ethers';

async function heliaAdapterExample() {
  // Example configuration
  const config = {
    // Your TACo configuration
    domain: 'lynx',  // or 'mainnet'
    // Add other required config parameters
  };

  // Create Ethereum provider
  const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');

  try {
    console.log('🚀 Creating TacoStorage with HeliaAdapter...');
    
    // Option 1: Using factory method (recommended)
    const storage = await TacoStorage.createWithHelia(config, provider, {
      timeout: 30000,        // 30 second timeout for IPFS operations
      autoStart: true,       // Automatically start the Helia node
      heliaOptions: {
        // Custom Helia/libp2p configuration
        libp2p: {
          addresses: {
            listen: ['/ip4/0.0.0.0/tcp/0']  // Listen on random port
          }
        }
      }
    });

    // Option 2: Manual instantiation
    // const adapter = new HeliaAdapter({
    //   timeout: 30000,
    //   autoStart: true
    // });
    // await adapter.initialize();
    // const storage = new TacoStorage(adapter, config, provider);
    // await storage.initialize();

    console.log('✅ HeliaAdapter initialized successfully!');

    // Check adapter health
    const health = await storage.getHealth();
    console.log('📊 Adapter health:', health);

    // Example: Store some data
    const testData = new Uint8Array([1, 2, 3, 4, 5]);
    const conditions = {
      // Your access conditions here
      chain: 1,
      method: 'eth_getBalance',
      parameters: ['0x...', 'latest'],
      returnValueTest: {
        comparator: '>',
        value: '1000000000000000000' // 1 ETH
      }
    };
    
    console.log('💾 Storing data with HeliaAdapter...');
    const result = await storage.store(testData, conditions);
    console.log('📋 Storage result:', {
      id: result.id,
      reference: result.reference
    });

    // Retrieve the data
    console.log('📤 Retrieving data...');
    const { encryptedData, metadata } = await storage.retrieve(result.reference);
    console.log('✅ Data retrieved successfully!');
    console.log('📊 Metadata:', {
      id: metadata.id,
      size: metadata.size,
      contentType: metadata.contentType
    });

    // Check if data exists
    const exists = await storage.exists(result.reference);
    console.log('🔍 Data exists:', exists);

    // Clean up
    console.log('🧹 Cleaning up resources...');
    if (storage.adapter instanceof HeliaAdapter) {
      await storage.adapter.cleanup();
    }
    
    console.log('✅ Example completed successfully!');

  } catch (error) {
    console.error('❌ Error in HeliaAdapter example:', error);
    throw error;
  }
}

// Example configuration options for different use cases
export const heliaConfigurations = {
  // Minimal configuration for testing
  minimal: {
    timeout: 15000,
    autoStart: true
  },

  // Configuration for local development
  development: {
    timeout: 30000,
    autoStart: true,
    heliaOptions: {
      libp2p: {
        addresses: {
          listen: ['/ip4/127.0.0.1/tcp/0']
        }
      }
    }
  },

  // Configuration for production use
  production: {
    timeout: 60000,
    autoStart: true,
    heliaOptions: {
      libp2p: {
        addresses: {
          listen: ['/ip4/0.0.0.0/tcp/4001']
        },
        connectionGater: {
          // Add connection filtering for security
          denyDialMultiaddr: () => false
        }
      }
    }
  },

  // Configuration for offline/isolated use
  offline: {
    timeout: 10000,
    autoStart: true,
    heliaOptions: {
      libp2p: {
        addresses: {
          listen: []  // No listening addresses = offline mode
        }
      }
    }
  }
};

// Comparison with KuboAdapter
export const adapterComparison = {
  kubo: {
    description: 'External IPFS node via RPC',
    requires: 'Running IPFS daemon (kubo)',
    benefits: ['Mature ecosystem', 'External node management', 'Shared with other apps'],
    useCase: 'When you have existing IPFS infrastructure'
  },
  helia: {
    description: 'Embedded IPFS node in your application',
    requires: 'No external dependencies',
    benefits: ['Self-contained', 'No external setup', 'Modern IPFS stack'],
    useCase: 'When you want embedded IPFS functionality'
  }
};

// Export the example function
export { heliaAdapterExample };

// Run the example if this file is executed directly
if (require.main === module) {
  heliaAdapterExample().catch(console.error);
}
