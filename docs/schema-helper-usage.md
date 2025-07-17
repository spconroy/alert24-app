# Database Schema Update Helper

A comprehensive utility for safely managing database schema updates in the Alert24 application.

## Features

- ✅ **Safe Migration Management** - Tracks applied migrations to prevent duplicates
- 🔄 **Rollback Support** - Automatic rollback SQL generation and execution
- 🔍 **Validation** - SQL syntax and safety validation before execution
- 📊 **Logging** - Detailed logging with timestamps and status indicators
- 🧪 **Dry Run Mode** - Preview changes without applying them
- 🛡️ **Backup Support** - Table backup before risky operations
- 📋 **Migration Tracking** - Complete audit trail of all schema changes

## Quick Start

### 1. Basic Usage

```javascript
import { createSchemaHelper, quickMigrations } from '../lib/schema-helper.js';

// Create helper instance
const helper = createSchemaHelper({
  verbose: true, // Enable detailed logging
  dryRun: false, // Set to true to preview changes
});

// Apply a single migration
await helper.applyMigration(
  'add_phone_to_users',
  'ALTER TABLE alert24_schema.users ADD COLUMN phone_number VARCHAR(20);',
  'ALTER TABLE alert24_schema.users DROP COLUMN phone_number;' // rollback SQL
);
```

### 2. Using Quick Migration Utilities

```javascript
import { quickMigrations } from '../lib/schema-helper.js';

// Add a column
const addColumnMigration = quickMigrations.addColumn(
  'users',
  'phone_number',
  'VARCHAR(20)',
  { nullable: true, default: null }
);

// Create an index
const indexMigration = quickMigrations.createIndex(
  'users',
  'email',
  'idx_users_email_unique'
);

// Add foreign key
const fkMigration = quickMigrations.addForeignKey(
  'incidents',
  'assigned_to',
  'users',
  'id'
);
```

### 3. Batch Migration Application

```javascript
const migrations = [
  quickMigrations.addColumn('services', 'auto_recovery', 'BOOLEAN', {
    default: 'FALSE',
  }),
  quickMigrations.addColumn('check_results', 'is_successful', 'BOOLEAN', {
    default: 'TRUE',
  }),
  quickMigrations.createIndex('services', 'auto_recovery'),
];

const results = await helper.applyMigrations(migrations);
console.log('Applied:', results.filter(r => r.success).length);
```

## Running Schema Updates

### Command Line Usage

```bash
# Apply all pending schema updates
node scripts/apply-schema-updates.js

# Preview changes without applying (dry run)
node scripts/apply-schema-updates.js --dry-run

# Get help
node scripts/apply-schema-updates.js --help
```

### Current Missing Schema Updates

The following schema updates are needed based on the todo list:

1. **Services Table**
   - `auto_recovery` BOOLEAN column for automatic recovery settings

2. **Check Results Table**
   - `is_successful` BOOLEAN column to track check success/failure

3. **Service Monitoring Checks Table**
   - `monitoring_check_id` UUID column for proper relationships

4. **Users Table**
   - `notification_preferences` JSONB for notification settings
   - `phone_number` VARCHAR(20) for SMS notifications
   - `last_login_at` TIMESTAMP for tracking user activity

5. **On-Call Schedules Table**
   - `created_by` UUID column (optional restoration)

## API Reference

### SchemaUpdateHelper Class

#### Constructor Options

```javascript
const helper = createSchemaHelper({
  verbose: true, // Enable detailed logging
  dryRun: false, // Preview mode without applying changes
  migrationTable: 'schema_migrations', // Custom migration tracking table
});
```

#### Methods

##### `applyMigration(name, sql, rollbackSql)`

Apply a single database migration.

**Parameters:**

- `name` (string) - Unique migration name
- `sql` (string) - SQL to execute
- `rollbackSql` (string, optional) - SQL to rollback the migration

**Returns:** `{ success: boolean, checksum?: string, skipped?: boolean }`

##### `rollbackMigration(name)`

Rollback a previously applied migration.

**Parameters:**

- `name` (string) - Migration name to rollback

**Returns:** `{ success: boolean }`

##### `applyMigrations(migrations)`

Apply multiple migrations in sequence.

**Parameters:**

- `migrations` (array) - Array of migration objects with `name`, `sql`, `rollbackSql`

**Returns:** Array of results for each migration

##### `getMigrationStatus()`

Get list of all applied migrations.

**Returns:** Array of migration records with timestamps

##### `backupTable(tableName, suffix)`

Create a backup of a table before migration.

**Parameters:**

- `tableName` (string) - Table to backup
- `suffix` (string, optional) - Custom backup suffix

**Returns:** `{ success: boolean, backupTableName: string }`

##### `verifyTableSchema(tableName, expectedColumns)`

Verify table structure matches expected schema.

**Parameters:**

- `tableName` (string) - Table to verify
- `expectedColumns` (array) - Expected column definitions

**Returns:** Schema validation results

### Quick Migration Utilities

#### `quickMigrations.addColumn(tableName, columnName, columnType, options)`

Generate migration to add a column.

**Options:**

- `nullable` (boolean) - Whether column allows NULL values (default: true)
- `default` (string) - Default value for the column

#### `quickMigrations.createIndex(tableName, columnName, indexName)`

Generate migration to create an index.

#### `quickMigrations.addForeignKey(tableName, columnName, refTable, refColumn, constraintName)`

Generate migration to add a foreign key constraint.

## Safety Features

### SQL Validation

The helper validates SQL for potentially dangerous operations:

- Prevents `DROP DATABASE` commands
- Warns about `DELETE` without `WHERE` clauses
- Validates `TRUNCATE` operations
- Checks `ALTER TABLE DROP COLUMN` for proper CASCADE

### Migration Tracking

- All migrations are tracked in the `schema_migrations` table
- Duplicate migrations are automatically skipped
- Complete audit trail with timestamps and checksums
- Rollback SQL is stored for each migration

### Backup Support

```javascript
// Backup before risky migration
await helper.backupTable('users', 'before_phone_migration');

// Apply migration
await helper.applyMigration('add_phone_to_users', sql, rollbackSql);
```

## Best Practices

### 1. Always Provide Rollback SQL

```javascript
// ✅ Good - includes rollback
await helper.applyMigration(
  'add_status_column',
  "ALTER TABLE services ADD COLUMN status VARCHAR(20) DEFAULT 'active';",
  'ALTER TABLE services DROP COLUMN status;'
);

// ❌ Bad - no rollback
await helper.applyMigration(
  'add_status_column',
  "ALTER TABLE services ADD COLUMN status VARCHAR(20) DEFAULT 'active';"
);
```

### 2. Use Dry Run for Testing

```javascript
// Test migrations first
const helper = createSchemaHelper({ dryRun: true, verbose: true });
await helper.applyMigration(name, sql, rollbackSql);

// Then apply for real
const realHelper = createSchemaHelper({ dryRun: false });
await realHelper.applyMigration(name, sql, rollbackSql);
```

### 3. Backup Critical Tables

```javascript
// Backup before major changes
await helper.backupTable('users');
await helper.applyMigration('restructure_users', sql, rollbackSql);
```

### 4. Use Descriptive Migration Names

```javascript
// ✅ Good - descriptive names
'add_auto_recovery_to_services_table';
'create_index_users_email_unique';
'add_notification_preferences_to_users';

// ❌ Bad - vague names
'migration_1';
'update_table';
'fix_bug';
```

### 5. Test Rollbacks

```javascript
// Apply migration
await helper.applyMigration(name, sql, rollbackSql);

// Test rollback in development
await helper.rollbackMigration(name);

// Re-apply if rollback worked
await helper.applyMigration(name, sql, rollbackSql);
```

## Troubleshooting

### Common Issues

**Migration already applied:**

```
⚠️ Migration add_phone_to_users already applied, skipping
```

This is normal - the helper prevents duplicate migrations.

**SQL validation failed:**

```
❌ Potentially dangerous SQL detected: DROP DATABASE
```

Review your SQL for safety issues.

**Rollback failed:**

```
❌ No rollback SQL provided for migration add_phone_to_users
```

Ensure you provide rollback SQL for all migrations.

### Getting Migration Status

```javascript
const status = await helper.getMigrationStatus();
console.log('Applied migrations:', status.length);
status.forEach(m => console.log(`${m.migration_name} - ${m.applied_at}`));
```

### Manual Rollback

If you need to manually rollback a migration:

```javascript
await helper.rollbackMigration('add_phone_to_users');
```

This will execute the stored rollback SQL and remove the migration record.
