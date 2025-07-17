#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load environment variables from .env.local
try {
  const envFile = readFileSync('.env.local', 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
} catch (error) {
  console.log(
    'Note: .env.local file not found, using system environment variables'
  );
}

// Get Supabase credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

console.log('🚀 Adding auto_recovery column to services table...');

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function addAutoRecoveryColumn() {
  try {
    // Add the auto_recovery column
    const { error } = await supabase.rpc('execute_sql', {
      query:
        'ALTER TABLE services ADD COLUMN IF NOT EXISTS auto_recovery BOOLEAN DEFAULT true;',
    });

    if (error) {
      console.error('❌ Error adding column:', error);
      process.exit(1);
    }

    console.log('✅ Successfully added auto_recovery column to services table');

    // Update existing services to have auto_recovery enabled
    const { error: updateError } = await supabase.rpc('execute_sql', {
      query:
        'UPDATE services SET auto_recovery = true WHERE auto_recovery IS NULL;',
    });

    if (updateError) {
      console.error('❌ Error updating existing services:', updateError);
      process.exit(1);
    }

    console.log(
      '✅ Successfully updated existing services with auto_recovery = true'
    );
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addAutoRecoveryColumn();
