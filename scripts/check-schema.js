#!/usr/bin/env node

// Simple script to check if the required tables exist
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envVars = {};

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      envVars[key.trim()] = value.trim();
    }
  });
} catch (error) {
  console.error('Could not read .env.local file');
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  console.log('🔍 Checking database schema...');

  try {
    // Check monitoring_checks table
    const { data: monitoringChecks, error: mcError } = await supabase
      .from('monitoring_checks')
      .select('count(*)')
      .limit(1);

    if (mcError) {
      console.error('❌ monitoring_checks table issue:', mcError.message);
    } else {
      console.log('✅ monitoring_checks table exists');
    }

    // Check service_monitoring_checks table
    const { data: junctionTable, error: jError } = await supabase
      .from('service_monitoring_checks')
      .select('count(*)')
      .limit(1);

    if (jError) {
      console.error(
        '❌ service_monitoring_checks table issue:',
        jError.message
      );
    } else {
      console.log('✅ service_monitoring_checks table exists');
    }

    // Check services table
    const { data: services, error: sError } = await supabase
      .from('services')
      .select('count(*)')
      .limit(1);

    if (sError) {
      console.error('❌ services table issue:', sError.message);
    } else {
      console.log('✅ services table exists');
    }

    // Try to get table schema info
    const { data: tableInfo, error: infoError } = await supabase.rpc(
      'get_table_columns',
      { table_name: 'service_monitoring_checks' }
    );

    if (infoError) {
      console.warn('⚠️  Could not get table schema info:', infoError.message);
    } else {
      console.log(
        '📋 service_monitoring_checks columns:',
        tableInfo?.map(t => t.column_name)
      );
    }
  } catch (error) {
    console.error('❌ Schema check failed:', error);
  }
}

checkTables();
