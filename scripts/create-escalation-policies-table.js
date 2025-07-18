#!/usr/bin/env node

/**
 * Create escalation_policies table in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createEscalationPoliciesTable() {
  try {
    console.log('🚀 Creating escalation_policies table...');
    
    // Read the SQL file
    const sqlFilePath = join(process.cwd(), 'docs', 'schema-updates', '15_create_escalation_policies_table.sql');
    const sql = readFileSync(sqlFilePath, 'utf8');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('❌ Error creating table:', error);
      return;
    }
    
    console.log('✅ Successfully created escalation_policies table');
    
    // Test the table by trying to query it
    const { data: testData, error: testError } = await supabase
      .from('escalation_policies')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Error testing table:', testError);
    } else {
      console.log('✅ Table is accessible and ready for use');
    }
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the script
createEscalationPoliciesTable();