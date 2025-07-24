# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-07-23

### Added
- Initial release of TACo Storage SDK
- Core `TacoStorage` class for encrypted data storage and retrieval
- `TacoEncryptionService` for TACo threshold encryption/decryption
- IPFS storage adapter for decentralized storage
- SQLite storage adapter for local/centralized storage
- Base adapter interface and abstract class for custom adapters
- Comprehensive TypeScript type definitions
- Professional error handling with specific error types
- Time-based and NFT ownership access conditions
- Full documentation and examples
- Unit test setup and framework
- ESLint and Prettier configuration
- Build system with ES modules and CommonJS support

### Features
- **Multi-Provider Storage**: Support for IPFS and SQLite with pluggable adapter architecture
- **Threshold Encryption**: Integration with TACo for secure threshold access control
- **Flexible Access Control**: Time-based, NFT ownership, and custom condition support
- **Professional Architecture**: Clean separation of concerns following SOLID principles
- **Developer Experience**: Full TypeScript support with comprehensive type safety
- **Error Management**: Structured error handling with specific error categories
- **Health Monitoring**: Built-in health check capabilities for storage adapters

### Technical Details
- Built with TypeScript 5.2+
- Supports Node.js 16+
- Uses TACo Web SDK for threshold cryptography
- IPFS integration via ipfs-http-client
- SQLite integration via sqlite3
- Comprehensive test suite with Jest
- Professional build system with dual module support (ESM/CJS)
