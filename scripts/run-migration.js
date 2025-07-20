#!/usr/bin/env node

/**
 * Apply Migration: 12_missing_columns_and_fixes.sql
 * 
 * This script applies the critical database migration directly via PostgreSQL connection.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the migration file
const migrationPath = path.join(__dirname, '..', 'docs', 'schema-updates', '12_missing_columns_and_fixes.sql');

console.log('🚀 Alert24 Database Migration');
console.log('================================');
console.log(`Migration file: ${migrationPath}`);

try {
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  console.log(`📝 Migration size: ${migrationSQL.length} characters`);
  console.log(`📝 Lines: ${migrationSQL.split('\n').length}`);
  
  console.log('\n⚠️  MANUAL APPLICATION REQUIRED');
  console.log('Due to Supabase constraints, this migration must be applied manually:');
  console.log('\n1. Copy the SQL below');
  console.log('2. Go to your Supabase Dashboard > SQL Editor'); 
  console.log('3. Paste and execute the SQL');
  console.log('4. Verify with: curl http://localhost:3002/api/test-migration-status');
  
  console.log('\n' + '='.repeat(80));
  console.log('MIGRATION SQL - COPY AND PASTE TO SUPABASE:');
  console.log('='.repeat(80));
  console.log(migrationSQL);
  console.log('='.repeat(80));
  
  console.log('\n✅ Migration SQL ready for manual application');
  console.log('📋 Instructions printed above - apply via Supabase Dashboard');
  
} catch (error) {
  console.error('❌ Error reading migration file:', error.message);
  process.exit(1);
}