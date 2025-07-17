/**
 * Database Schema Update Helper
 * Provides safe schema migration utilities for Supabase
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Schema update helper class
 */
export class SchemaUpdateHelper {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
    this.migrationTable = options.migrationTable || 'schema_migrations';
  }

  /**
   * Log messages with timestamp
   */
  log(message, type = 'info') {
    if (!this.verbose && type === 'debug') return;

    const timestamp = new Date().toISOString();
    const prefix =
      {
        info: '✅',
        error: '❌',
        warning: '⚠️',
        debug: '🔍',
        success: '🎉',
      }[type] || 'ℹ️';

    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  /**
   * Initialize migration tracking table
   */
  async initializeMigrationTable() {
    const createMigrationTable = `
      CREATE TABLE IF NOT EXISTS ${this.migrationTable} (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        rollback_sql TEXT,
        checksum VARCHAR(64),
        applied_by VARCHAR(255) DEFAULT current_user
      );
      
      CREATE INDEX IF NOT EXISTS idx_migration_name ON ${this.migrationTable}(migration_name);
    `;

    try {
      if (this.dryRun) {
        this.log('DRY RUN: Would create migration table', 'debug');
        return true;
      }

      const { error } = await supabase.rpc('exec_sql', {
        sql: createMigrationTable,
      });
      if (error) throw error;

      this.log('Migration tracking table initialized', 'success');
      return true;
    } catch (error) {
      this.log(
        `Failed to initialize migration table: ${error.message}`,
        'error'
      );
      throw error;
    }
  }

  /**
   * Check if migration has already been applied
   */
  async isMigrationApplied(migrationName) {
    try {
      const { data, error } = await supabase
        .from(this.migrationTable)
        .select('migration_name')
        .eq('migration_name', migrationName)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return !!data;
    } catch (error) {
      this.log(`Error checking migration status: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Generate checksum for SQL content
   */
  async generateChecksum(sql) {
    // Use Web Crypto API for Edge Runtime compatibility
    const encoder = new TextEncoder();
    const data = encoder.encode(sql.trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate SQL syntax and safety
   */
  validateSQL(sql) {
    const dangerous = [
      /DROP\s+DATABASE/i,
      /DELETE\s+FROM\s+(?!.*WHERE)/i,
      /TRUNCATE\s+(?!.*CASCADE)/i,
      /ALTER\s+TABLE.*DROP\s+COLUMN.*(?!.*CASCADE)/i,
    ];

    for (const pattern of dangerous) {
      if (pattern.test(sql)) {
        throw new Error(
          `Potentially dangerous SQL detected: ${pattern.source}`
        );
      }
    }

    // Basic syntax validation
    if (!sql.trim()) {
      throw new Error('Empty SQL provided');
    }

    this.log('SQL validation passed', 'debug');
    return true;
  }

  /**
   * Apply a single migration
   */
  async applyMigration(migrationName, sql, rollbackSql = null) {
    try {
      // Initialize migration table if needed
      await this.initializeMigrationTable();

      // Check if already applied
      if (await this.isMigrationApplied(migrationName)) {
        this.log(
          `Migration ${migrationName} already applied, skipping`,
          'warning'
        );
        return { success: true, skipped: true };
      }

      // Validate SQL
      this.validateSQL(sql);
      if (rollbackSql) this.validateSQL(rollbackSql);

      const checksum = await this.generateChecksum(sql);

      if (this.dryRun) {
        this.log(`DRY RUN: Would apply migration ${migrationName}`, 'debug');
        this.log(`SQL: ${sql.substring(0, 100)}...`, 'debug');
        return { success: true, dryRun: true };
      }

      // Start transaction
      this.log(`Applying migration: ${migrationName}`, 'info');

      // Execute the migration SQL
      const { error: migrationError } = await supabase.rpc('exec_sql', { sql });
      if (migrationError) throw migrationError;

      // Record the migration
      const { error: recordError } = await supabase
        .from(this.migrationTable)
        .insert({
          migration_name: migrationName,
          rollback_sql: rollbackSql,
          checksum: checksum,
        });

      if (recordError) throw recordError;

      this.log(`Migration ${migrationName} applied successfully`, 'success');
      return { success: true, checksum };
    } catch (error) {
      this.log(
        `Failed to apply migration ${migrationName}: ${error.message}`,
        'error'
      );
      throw error;
    }
  }

  /**
   * Rollback a migration
   */
  async rollbackMigration(migrationName) {
    try {
      // Get migration record
      const { data: migration, error: fetchError } = await supabase
        .from(this.migrationTable)
        .select('*')
        .eq('migration_name', migrationName)
        .single();

      if (fetchError || !migration) {
        throw new Error(`Migration ${migrationName} not found`);
      }

      if (!migration.rollback_sql) {
        throw new Error(
          `No rollback SQL provided for migration ${migrationName}`
        );
      }

      if (this.dryRun) {
        this.log(`DRY RUN: Would rollback migration ${migrationName}`, 'debug');
        return { success: true, dryRun: true };
      }

      this.log(`Rolling back migration: ${migrationName}`, 'info');

      // Execute rollback SQL
      const { error: rollbackError } = await supabase.rpc('exec_sql', {
        sql: migration.rollback_sql,
      });
      if (rollbackError) throw rollbackError;

      // Remove migration record
      const { error: deleteError } = await supabase
        .from(this.migrationTable)
        .delete()
        .eq('migration_name', migrationName);

      if (deleteError) throw deleteError;

      this.log(
        `Migration ${migrationName} rolled back successfully`,
        'success'
      );
      return { success: true };
    } catch (error) {
      this.log(
        `Failed to rollback migration ${migrationName}: ${error.message}`,
        'error'
      );
      throw error;
    }
  }

  /**
   * Apply multiple migrations in sequence
   */
  async applyMigrations(migrations) {
    const results = [];

    for (const migration of migrations) {
      try {
        const result = await this.applyMigration(
          migration.name,
          migration.sql,
          migration.rollbackSql
        );
        results.push({ ...result, name: migration.name });
      } catch (error) {
        this.log(`Migration batch failed at: ${migration.name}`, 'error');
        results.push({
          success: false,
          name: migration.name,
          error: error.message,
        });

        // Stop on first failure unless continueOnError is set
        if (!migration.continueOnError) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Get migration status
   */
  async getMigrationStatus() {
    try {
      const { data, error } = await supabase
        .from(this.migrationTable)
        .select('*')
        .order('applied_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      this.log(`Failed to get migration status: ${error.message}`, 'error');
      return [];
    }
  }

  /**
   * Backup table before migration
   */
  async backupTable(tableName, backupSuffix = null) {
    const suffix = backupSuffix || `backup_${Date.now()}`;
    const backupTableName = `${tableName}_${suffix}`;

    const sql = `CREATE TABLE ${backupTableName} AS SELECT * FROM ${tableName};`;

    try {
      if (this.dryRun) {
        this.log(
          `DRY RUN: Would backup ${tableName} to ${backupTableName}`,
          'debug'
        );
        return { success: true, dryRun: true, backupTableName };
      }

      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) throw error;

      this.log(`Table ${tableName} backed up to ${backupTableName}`, 'success');
      return { success: true, backupTableName };
    } catch (error) {
      this.log(
        `Failed to backup table ${tableName}: ${error.message}`,
        'error'
      );
      throw error;
    }
  }

  /**
   * Verify table structure matches expected schema
   */
  async verifyTableSchema(tableName, expectedColumns) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'alert24_schema' 
          AND table_name = '${tableName}'
          ORDER BY ordinal_position;
        `,
      });

      if (error) throw error;

      const actualColumns = data.reduce((acc, col) => {
        acc[col.column_name] = {
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          default: col.column_default,
        };
        return acc;
      }, {});

      const missingColumns = expectedColumns.filter(
        col => !actualColumns[col.name]
      );
      const extraColumns = Object.keys(actualColumns).filter(
        col => !expectedColumns.find(expected => expected.name === col)
      );

      return {
        valid: missingColumns.length === 0,
        missingColumns,
        extraColumns,
        actualColumns,
      };
    } catch (error) {
      this.log(`Failed to verify table schema: ${error.message}`, 'error');
      throw error;
    }
  }
}

/**
 * Convenience function to create a schema helper instance
 */
export function createSchemaHelper(options = {}) {
  return new SchemaUpdateHelper(options);
}

/**
 * Quick migration utility for common schema updates
 */
export const quickMigrations = {
  /**
   * Add a column to a table
   */
  addColumn: (tableName, columnName, columnType, options = {}) => {
    const nullable = options.nullable !== false ? '' : ' NOT NULL';
    const defaultValue = options.default ? ` DEFAULT ${options.default}` : '';

    return {
      name: `add_${columnName}_to_${tableName}`,
      sql: `ALTER TABLE alert24_schema.${tableName} ADD COLUMN ${columnName} ${columnType}${nullable}${defaultValue};`,
      rollbackSql: `ALTER TABLE alert24_schema.${tableName} DROP COLUMN ${columnName};`,
    };
  },

  /**
   * Create an index
   */
  createIndex: (tableName, columnName, indexName = null) => {
    const idxName = indexName || `idx_${tableName}_${columnName}`;
    return {
      name: `create_index_${idxName}`,
      sql: `CREATE INDEX IF NOT EXISTS ${idxName} ON alert24_schema.${tableName}(${columnName});`,
      rollbackSql: `DROP INDEX IF EXISTS alert24_schema.${idxName};`,
    };
  },

  /**
   * Add foreign key constraint
   */
  addForeignKey: (
    tableName,
    columnName,
    refTable,
    refColumn,
    constraintName = null
  ) => {
    const fkName = constraintName || `fk_${tableName}_${columnName}`;
    return {
      name: `add_fk_${fkName}`,
      sql: `ALTER TABLE alert24_schema.${tableName} ADD CONSTRAINT ${fkName} FOREIGN KEY (${columnName}) REFERENCES alert24_schema.${refTable}(${refColumn});`,
      rollbackSql: `ALTER TABLE alert24_schema.${tableName} DROP CONSTRAINT ${fkName};`,
    };
  },
};

/**
 * Example usage and common migration patterns
 */
export const migrationExamples = {
  // Add missing columns to services table
  addAutoRecoveryToServices: quickMigrations.addColumn(
    'services',
    'auto_recovery',
    'BOOLEAN',
    { default: 'FALSE' }
  ),

  // Add is_successful to check_results
  addIsSuccessfulToCheckResults: quickMigrations.addColumn(
    'check_results',
    'is_successful',
    'BOOLEAN',
    { nullable: false, default: 'TRUE' }
  ),

  // Add monitoring_check_id to service_monitoring_checks
  addMonitoringCheckIdToServiceMonitoringChecks: quickMigrations.addColumn(
    'service_monitoring_checks',
    'monitoring_check_id',
    'UUID'
  ),
};
