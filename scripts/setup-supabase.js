#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get Supabase credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

console.log('🚀 Setting up Alert24 database schema in Supabase...');
console.log(`📍 Supabase URL: ${supabaseUrl}`);

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runSchema() {
  try {
    // Read the schema file
    const schemaPath = join(__dirname, 'setup-supabase-schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');

    console.log('📄 Schema file loaded, executing...');

    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute`);

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';

      // Skip comments and empty statements
      if (statement.trim().startsWith('--') || statement.trim() === ';') {
        continue;
      }

      try {
        console.log(
          `\n⏳ Executing statement ${i + 1}/${statements.length}...`
        );

        // Use the rpc function for raw SQL execution
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: statement,
        });

        if (error) {
          // If exec_sql function doesn't exist, try direct query
          if (error.message.includes('function "exec_sql" does not exist')) {
            console.log('   📝 Trying direct SQL execution...');

            // For table creation and other DDL, we need to use a different approach
            // Let's try to execute via the REST API directly
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
              method: 'POST',
              headers: {
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${supabaseAnonKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
              },
              body: JSON.stringify({
                query: statement,
              }),
            });

            if (!response.ok) {
              throw new Error(
                `HTTP ${response.status}: ${await response.text()}`
              );
            }
          } else {
            throw error;
          }
        }

        console.log(`   ✅ Statement ${i + 1} executed successfully`);
        successCount++;
      } catch (err) {
        console.log(`   ❌ Error in statement ${i + 1}:`, err.message);

        // Show the problematic statement for debugging
        const preview =
          statement.substring(0, 100) + (statement.length > 100 ? '...' : '');
        console.log(`   📝 Statement: ${preview}`);

        errorCount++;

        // Continue with other statements
      }
    }

    console.log('\n📊 Schema setup summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    if (errorCount === 0) {
      console.log('\n🎉 Database schema setup completed successfully!');

      // Test the connection by trying to query a table
      console.log('\n🧪 Testing database connection...');
      const { data: orgs, error: testError } = await supabase
        .from('organizations')
        .select('count')
        .limit(1);

      if (testError) {
        console.log(`   ⚠️  Test query failed: ${testError.message}`);
      } else {
        console.log('   ✅ Database connection test successful!');
      }
    } else {
      console.log('\n⚠️  Schema setup completed with some errors.');
      console.log('   Some statements may have failed due to:');
      console.log('   - Tables or functions already existing');
      console.log('   - Permission issues');
      console.log('   - Unsupported PostgreSQL features in Supabase');
    }
  } catch (error) {
    console.error('\n💥 Fatal error during schema setup:', error);
    process.exit(1);
  }
}

// Run with better error handling
async function main() {
  try {
    await runSchema();
    console.log('\n✨ Setup complete! You can now test the connection at:');
    console.log('   http://localhost:3000/api/test-supabase');
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();
