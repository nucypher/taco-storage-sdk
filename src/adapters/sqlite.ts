/**
 * SQLite storage adapter implementation
 */

import { Database } from 'sqlite3';
import { promisify } from 'util';
import { BaseStorageAdapter } from './base';
import { AdapterConfig, StorageMetadata, StorageResult, TacoStorageError, TacoStorageErrorType } from '../types';

/**
 * Configuration interface for SQLite adapter
 */
export interface SQLiteAdapterConfig extends AdapterConfig {
  /** Path to SQLite database file (defaults to in-memory) */
  databasePath?: string;
  /** Whether to enable WAL mode for better concurrency */
  enableWAL?: boolean;
  /** Connection timeout in milliseconds */
  timeout?: number;
}

/**
 * SQLite storage adapter for local/centralized data storage
 */
export class SQLiteAdapter extends BaseStorageAdapter {
  private readonly db: Database;
  private readonly dbPath: string;
  private readonly timeout: number;
  private isClosed = false;

  // Promisified database methods
  private readonly dbRun: (sql: string, params?: any[]) => Promise<any>;
  private readonly dbGet: (sql: string, params?: any[]) => Promise<any>;
  private readonly dbAll: (sql: string, params?: any[]) => Promise<any[]>;

  constructor(config: SQLiteAdapterConfig = {}) {
    super(config);

    const sqliteConfig = config as SQLiteAdapterConfig;
    this.dbPath = sqliteConfig.databasePath || ':memory:';
    this.timeout = sqliteConfig.timeout || 30000;

    try {
      // Only create database connection - schema setup happens in initialize()
      this.db = new Database(this.dbPath);
      
      // Promisify database methods
      this.dbRun = promisify(this.db.run.bind(this.db));
      this.dbGet = promisify(this.db.get.bind(this.db));
      this.dbAll = promisify(this.db.all.bind(this.db));
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.ADAPTER_ERROR,
        'Failed to create SQLite database connection',
        error as Error
      );
    }
  }

  /**
   * Initialize the SQLite adapter by setting up database schema and testing connectivity
   */
  public async initialize(): Promise<void> {
    if (this.isClosed) {
      throw new TacoStorageError(
        TacoStorageErrorType.ADAPTER_ERROR,
        'Database is closed'
      );
    }

    try {
      // Configure database settings asynchronously
      const sqliteConfig = this.config as SQLiteAdapterConfig;
      await this.setupDatabase(sqliteConfig.enableWAL || false);
      
      // Test database connectivity with a simple query
      await this.dbGet('SELECT 1 as test');
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.ADAPTER_ERROR,
        'Failed to initialize SQLite database',
        error as Error
      );
    }
  }

  protected generateReference(id: string): string {
    return `sqlite://${this.dbPath}#${id}`;
  }

  /**
   * Setup database schema and configuration asynchronously
   */
  private async setupDatabase(enableWAL: boolean): Promise<void> {
    try {
      // Enable WAL mode if requested
      if (enableWAL) {
        await this.dbRun('PRAGMA journal_mode = WAL');
      }

      // Enable foreign key constraints
      await this.dbRun('PRAGMA foreign_keys = ON');
      
      // Set other performance optimizations
      await this.dbRun('PRAGMA synchronous = NORMAL');
      await this.dbRun('PRAGMA temp_store = MEMORY');
      await this.dbRun(`PRAGMA busy_timeout = ${this.timeout}`);

      // Create the main storage table
      await this.dbRun(`
        CREATE TABLE IF NOT EXISTS items (
          key TEXT PRIMARY KEY,
          content_type TEXT NOT NULL,
          size INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          message_kit BLOB NOT NULL,
          conditions TEXT NOT NULL,
          metadata TEXT
        )
      `);
      
      // Create the data table to store encrypted content
      await this.dbRun(`
        CREATE TABLE IF NOT EXISTS item_data (
          key TEXT PRIMARY KEY,
          encrypted_data BLOB NOT NULL,
          FOREIGN KEY (key) REFERENCES items (key) ON DELETE CASCADE
        )
      `);

      // Create index for faster lookups
      await this.dbRun('CREATE INDEX IF NOT EXISTS idx_created_at ON items(created_at)');
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.ADAPTER_ERROR,
        'Failed to setup database schema',
        error as Error
      );
    }
  }

  /**
   * Store encrypted data and metadata in SQLite
   */
  public async store(encryptedData: Uint8Array, metadata: StorageMetadata): Promise<StorageResult> {
    this.validateData(encryptedData);

    try {
      const sql = `
        INSERT OR REPLACE INTO items (
          key, content_type, size, created_at, message_kit, conditions, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        metadata.id,
        metadata.contentType,
        metadata.size,
        metadata.createdAt.toISOString(),
        Buffer.from(metadata.encryptionMetadata.messageKit),
        JSON.stringify(metadata.encryptionMetadata.conditions),
        metadata.metadata ? JSON.stringify(metadata.metadata) : null,
      ];
      
      // Store the metadata
      await this.dbRun(sql, params);
      
      // Store the encrypted data separately
      const dataSql = `
        INSERT OR REPLACE INTO item_data (key, encrypted_data)
        VALUES (?, ?)
      `;
      
      await this.dbRun(dataSql, [metadata.id, Buffer.from(encryptedData)]);

      return {
        id: metadata.id,
        reference: this.generateReference(metadata.id),
        metadata,
      };
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.STORAGE_ERROR,
        `Failed to store data in SQLite: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Retrieve encrypted data and metadata from SQLite
   */
  public async retrieve(id: string): Promise<{ encryptedData: Uint8Array; metadata: StorageMetadata }> {
    this.validateId(id);

    try {
      const sql = `
        SELECT i.key, i.content_type, i.size, i.created_at, i.message_kit, i.conditions, i.metadata, d.encrypted_data
        FROM items i
        LEFT JOIN item_data d ON i.key = d.key
        WHERE i.key = ?
      `;

      const row = await this.dbGet(sql, [id]);
      if (!row) {
        throw new TacoStorageError(
          TacoStorageErrorType.NOT_FOUND,
          `Data not found for ID: ${id}`
        );
      }

      const encryptedData = row.encrypted_data ? new Uint8Array(row.encrypted_data) : new Uint8Array();
      const metadata: StorageMetadata = {
        id: row.key,
        contentType: row.content_type,
        size: row.size,
        createdAt: new Date(row.created_at),
        encryptionMetadata: {
          messageKit: Array.from(new Uint8Array(row.message_kit)),
          conditions: JSON.parse(row.conditions),
        },
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      };

      return { encryptedData, metadata };
    } catch (error) {
      if (error instanceof TacoStorageError) {
        throw error;
      }
      
      throw new TacoStorageError(
        TacoStorageErrorType.RETRIEVAL_ERROR,
        `Failed to retrieve data from SQLite: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Delete data from SQLite
   */
  public async delete(id: string): Promise<boolean> {
    this.validateId(id);

    try {
      // First check if the record exists
      const existsBefore = await this.exists(id);
      if (!existsBefore) {
        return false;
      }
      
      // Delete from items table - CASCADE will handle item_data
      await this.dbRun('DELETE FROM items WHERE key = ?', [id]);
      
      // Check if the record still exists after deletion
      const existsAfter = await this.exists(id);
      return !existsAfter;
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.STORAGE_ERROR,
        `Failed to delete data from SQLite: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Check if data exists in SQLite
   */
  public async exists(id: string): Promise<boolean> {
    this.validateId(id);

    try {
      const result = await this.dbGet('SELECT 1 FROM items WHERE key = ?', [id]);
      return !!result;
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.STORAGE_ERROR,
        `Failed to check existence in SQLite: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * List stored data IDs with pagination
   */
  public async list(limit = 100, offset = 0): Promise<string[]> {
    try {
      const sql = `
        SELECT key FROM items 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `;
      
      const rows = await this.dbAll(sql, [limit, offset]);
      return rows.map(row => row.key);
    } catch (error) {
      throw new TacoStorageError(
        TacoStorageErrorType.RETRIEVAL_ERROR,
        `Failed to list data from SQLite: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Get SQLite database health status
   */
  public async getHealth(): Promise<{ healthy: boolean; details?: Record<string, unknown> }> {
    try {
      // Simple health check: try to query the database
      const result = await this.dbGet('SELECT COUNT(*) as count FROM items');
      const pragma = await this.dbGet('PRAGMA integrity_check');
      
      return {
        healthy: pragma.integrity_check === 'ok',
        details: {
          databasePath: this.dbPath,
          recordCount: result.count,
          integrityCheck: pragma.integrity_check,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          databasePath: this.dbPath,
          error: (error as Error).message,
        },
      };
    }
  }

  /**
   * Clean up SQLite database connection
   */
  public async cleanup(): Promise<void> {
    if (this.isClosed) {
      return; // Already closed, nothing to do
    }

    return new Promise((resolve, reject) => {
      this.db.close((error) => {
        this.isClosed = true;
        if (error) {
          reject(new TacoStorageError(
            TacoStorageErrorType.ADAPTER_ERROR,
            'Failed to close SQLite database',
            error
          ));
        } else {
          resolve();
        }
      });
    });
  }
}
