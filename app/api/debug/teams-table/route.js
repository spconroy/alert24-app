import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request) {
  try {
    console.log('🔍 Debug: Checking team_groups and team_memberships tables');

    const results = {
      success: true,
      timestamp: new Date().toISOString(),
      tests: [],
    };

    // Test 1: Query team_groups table
    try {
      const { data: teamGroups, error: teamError } = await db.client
        .from('team_groups')
        .select('*')
        .limit(5);

      results.tests.push({
        test: 'team_groups_query',
        success: !teamError,
        error: teamError?.message,
        errorCode: teamError?.code,
        count: teamGroups?.length || 0,
        data: teamGroups || [],
      });

      console.log('📊 team_groups query:', teamGroups?.length || 0, 'records');
    } catch (error) {
      results.tests.push({
        test: 'team_groups_query',
        success: false,
        error: error.message,
        count: 0,
      });
    }

    // Test 2: Query team_memberships table
    try {
      const { data: memberships, error: memberError } = await db.client
        .from('team_memberships')
        .select('*')
        .limit(5);

      results.tests.push({
        test: 'team_memberships_query',
        success: !memberError,
        error: memberError?.message,
        errorCode: memberError?.code,
        count: memberships?.length || 0,
        data: memberships || [],
      });

      console.log(
        '📊 team_memberships query:',
        memberships?.length || 0,
        'records'
      );
    } catch (error) {
      results.tests.push({
        test: 'team_memberships_query',
        success: false,
        error: error.message,
        count: 0,
      });
    }

    // Test 3: Try the getTeamGroups method directly
    try {
      const teamGroupsMethod = await db.getTeamGroups('test-org-id');
      results.tests.push({
        test: 'getTeamGroups_method',
        success: true,
        count: teamGroupsMethod?.length || 0,
        data: teamGroupsMethod || [],
      });

      console.log(
        '📊 getTeamGroups method:',
        teamGroupsMethod?.length || 0,
        'records'
      );
    } catch (error) {
      results.tests.push({
        test: 'getTeamGroups_method',
        success: false,
        error: error.message,
        count: 0,
      });
    }

    // Test 4: Check if client is properly initialized
    results.tests.push({
      test: 'client_initialization',
      success: !!db.client,
      error: db.client ? null : 'Client is null',
      info: {
        clientExists: !!db.client,
        clientType: typeof db.client,
      },
    });

    // Summary
    const successfulTests = results.tests.filter(t => t.success).length;
    const totalTests = results.tests.length;

    results.summary = {
      totalTests,
      successfulTests,
      failedTests: totalTests - successfulTests,
      allTestsPassed: successfulTests === totalTests,
    };

    console.log(
      `✅ Debug complete: ${successfulTests}/${totalTests} tests passed`
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('❌ Debug teams table error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
