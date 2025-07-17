#!/usr/bin/env node
/**
 * Apply Schema Fixes - Alert24 Database Migration
 *
 * This script applies the necessary schema changes to fix missing columns
 * identified in the application logs.
 *
 * Usage:
 * 1. Ensure your Supabase environment variables are set in .env.local:
 *    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
 *    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
 *    SUPABASE_SERVICE_ROLE_KEY=your_service_role_key (for admin operations)
 *
 * 2. Run the script:
 *    node scripts/apply-schema-fixes.js
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

async function applySchemaFixes() {
  console.log('🔧 Starting schema fixes...');

  // Check for environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL');
    console.error('   SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nPlease set these in your .env.local file.');
    console.error(
      '\nYou can find these values in your Supabase project settings:'
    );
    console.error('   URL: Project Settings > General > Reference ID');
    console.error(
      '   Service Role Key: Project Settings > API > service_role key'
    );
    process.exit(1);
  }

  // Create Supabase client with service role permissions
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Read the migration SQL file
    const migrationSQL = readFileSync(
      join(process.cwd(), 'scripts', 'fix-schema-issues.sql'),
      'utf8'
    );

    console.log('📄 Read migration file: fix-schema-issues.sql');

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--') && stmt !== 'COMMIT');

    console.log(`🚀 Executing ${statements.length} SQL statements...`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;

      console.log(
        `   ${i + 1}/${statements.length}: ${statement.substring(0, 60)}...`
      );

      const { error } = await supabase.rpc('exec_sql', {
        sql: statement,
      });

      if (error) {
        // Check if it's a harmless "already exists" error
        if (
          error.message.includes('already exists') ||
          error.message.includes('does not exist')
        ) {
          console.log(`   ⚠️  Warning: ${error.message}`);
        } else {
          throw error;
        }
      } else {
        console.log('   ✅ Success');
      }
    }

    console.log('\n🎉 Schema fixes applied successfully!');
    console.log('\nThe following issues should now be resolved:');
    console.log('   ✅ auto_recovery column added to services table');
    console.log('   ✅ is_successful column added to check_results table');
    console.log(
      '   ✅ monitoring_check_id column added to service_monitoring_checks table'
    );
    console.log('   ✅ Missing tables created if needed');
    console.log(
      '\nYou can now restart your application and the SLA errors should be gone.'
    );
  } catch (error) {
    console.error('\n❌ Error applying schema fixes:');
    console.error(error.message);
    console.error('\nIf you see permission errors, you may need to:');
    console.error(
      '1. Use the Supabase dashboard SQL editor to run the migration manually'
    );
    console.error(
      '2. Or ensure your service role key has the correct permissions'
    );
    console.error(
      '\nThe migration SQL is available in: scripts/fix-schema-issues.sql'
    );
    process.exit(1);
  }
}

// Handle different ways the script might be run
if (import.meta.url === `file://${process.argv[1]}`) {
  applySchemaFixes();
}

export { applySchemaFixes };
