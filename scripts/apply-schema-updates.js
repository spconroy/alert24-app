#!/usr/bin/env node

/**
 * Apply Schema Updates Script
 * Uses the SchemaUpdateHelper to apply missing database columns and constraints
 */

import {
  createSchemaHelper,
  quickMigrations,
  migrationExamples,
} from '../lib/schema-helper.js';

async function main() {
  // Initialize schema helper with verbose logging
  const helper = createSchemaHelper({
    verbose: true,
    dryRun: process.argv.includes('--dry-run'),
  });

  console.log('🚀 Starting schema updates...');

  try {
    // Define missing schema updates based on our todo list
    const migrations = [
      // Add auto_recovery column to services table
      migrationExamples.addAutoRecoveryToServices,

      // Add is_successful column to check_results table
      migrationExamples.addIsSuccessfulToCheckResults,

      // Add monitoring_check_id to service_monitoring_checks table
      migrationExamples.addMonitoringCheckIdToServiceMonitoringChecks,

      // Add indexes for better performance
      quickMigrations.createIndex('services', 'auto_recovery'),
      quickMigrations.createIndex('check_results', 'is_successful'),
      quickMigrations.createIndex(
        'service_monitoring_checks',
        'monitoring_check_id'
      ),

      // Add created_by column back to on_call_schedules (optional)
      quickMigrations.addColumn('on_call_schedules', 'created_by', 'UUID', {
        nullable: true,
      }),

      // Add foreign key relationships
      quickMigrations.addForeignKey(
        'on_call_schedules',
        'created_by',
        'users',
        'id',
        'fk_on_call_schedules_created_by'
      ),

      // Add notification preferences to users table
      quickMigrations.addColumn('users', 'notification_preferences', 'JSONB', {
        default: '\'{"email": true, "sms": false, "push": true}\'',
      }),

      // Add phone number for SMS notifications
      quickMigrations.addColumn('users', 'phone_number', 'VARCHAR(20)', {
        nullable: true,
      }),

      // Add last_login tracking
      quickMigrations.addColumn(
        'users',
        'last_login_at',
        'TIMESTAMP WITH TIME ZONE',
        { nullable: true }
      ),
    ];

    // Apply all migrations
    console.log(`📋 Applying ${migrations.length} migrations...`);
    const results = await helper.applyMigrations(migrations);

    // Report results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const skipped = results.filter(r => r.skipped);

    console.log('\n📊 Migration Results:');
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`⏭️  Skipped: ${skipped.length}`);
    console.log(`❌ Failed: ${failed.length}`);

    if (failed.length > 0) {
      console.log('\n❌ Failed Migrations:');
      failed.forEach(result => {
        console.log(`  - ${result.name}: ${result.error}`);
      });
    }

    if (skipped.length > 0) {
      console.log('\n⏭️  Skipped Migrations (already applied):');
      skipped.forEach(result => {
        console.log(`  - ${result.name}`);
      });
    }

    // Get migration status
    console.log('\n📋 Current Migration Status:');
    const status = await helper.getMigrationStatus();
    console.log(`Total applied migrations: ${status.length}`);

    if (status.length > 0) {
      console.log('Recent migrations:');
      status.slice(0, 5).forEach(migration => {
        console.log(
          `  - ${migration.migration_name} (${new Date(migration.applied_at).toLocaleDateString()})`
        );
      });
    }
  } catch (error) {
    console.error('💥 Schema update failed:', error.message);
    process.exit(1);
  }
}

// CLI usage information
function showUsage() {
  console.log(`
🔧 Schema Update Script

Usage:
  node scripts/apply-schema-updates.js [options]

Options:
  --dry-run    Show what would be changed without applying
  --help       Show this help message

Examples:
  # Apply all pending schema updates
  node scripts/apply-schema-updates.js
  
  # Preview changes without applying
  node scripts/apply-schema-updates.js --dry-run
  `);
}

// Handle CLI arguments
if (process.argv.includes('--help')) {
  showUsage();
  process.exit(0);
}

// Run the main function
main().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
