import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request) {
  try {
    console.log('🔍 Debug: Checking team_groups table');

    // First, try to check if the table exists
    const { data: tables, error: tablesError } = await db.client
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'alert24_schema')
      .eq('table_name', 'team_groups');

    if (tablesError) {
      console.log('⚠️ Error checking table existence:', tablesError);
    } else {
      console.log('📊 Table existence check result:', tables);
    }

    // Try to query the team_groups table directly
    const { data: teamGroups, error: teamError } = await db.client
      .from('team_groups')
      .select('*')
      .limit(5);

    if (teamError) {
      console.log('❌ Error querying team_groups table:', teamError);
      return NextResponse.json({
        success: false,
        tableExists: false,
        error: teamError.message,
        errorCode: teamError.code,
        errorDetails: teamError.details,
      });
    }

    console.log(
      '✅ team_groups table query successful, found:',
      teamGroups?.length || 0
    );

    // Also check team_memberships table
    const { data: memberships, error: memberError } = await db.client
      .from('team_memberships')
      .select('*')
      .limit(5);

    if (memberError) {
      console.log('⚠️ Error querying team_memberships table:', memberError);
    }

    // Try to get schema information
    const { data: columns, error: columnError } = await db.client
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'alert24_schema')
      .eq('table_name', 'team_groups');

    return NextResponse.json({
      success: true,
      tableExists: true,
      teamGroupsCount: teamGroups?.length || 0,
      teamGroups: teamGroups || [],
      teamMembershipsCount: memberships?.length || 0,
      teamMemberships: memberships || [],
      tableSchema: columns || [],
      schemaError: columnError?.message,
    });
  } catch (error) {
    console.error('❌ Debug teams table error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
