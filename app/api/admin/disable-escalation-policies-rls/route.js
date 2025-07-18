import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function POST(request) {
  try {
    console.log('🔧 Disabling RLS for escalation_policies table...');
    
    // SQL to disable RLS for escalation_policies table
    const disableRlsSQL = `
      ALTER TABLE escalation_policies DISABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS escalation_policies_organization_access ON escalation_policies;
    `;
    
    // Try to execute the SQL using the admin client
    try {
      const { data, error } = await db.adminClient.rpc('exec_sql', {
        sql: disableRlsSQL
      });
      
      if (error) {
        console.error('Error disabling RLS:', error);
        throw error;
      }
      
      console.log('✅ RLS disabled successfully');
      
      // Test the table access
      const { data: testData, error: testError } = await db.client
        .from('escalation_policies')
        .select('count')
        .limit(1);
      
      if (testError) {
        console.error('Error testing table access:', testError);
      } else {
        console.log('✅ Table is accessible without RLS');
      }
      
      return NextResponse.json({
        success: true,
        message: 'RLS disabled for escalation_policies table',
        table_accessible: !testError
      });
      
    } catch (sqlError) {
      console.error('SQL execution error:', sqlError);
      throw sqlError;
    }
    
  } catch (error) {
    console.error('Error disabling RLS:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to disable RLS',
        details: error.message
      },
      { status: 500 }
    );
  }
}