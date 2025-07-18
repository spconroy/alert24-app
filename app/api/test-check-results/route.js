import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(req) {
  try {
    const session = await auth();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
      check_results_table: null,
      monitoring_locations_table: null,
      sample_data_test: null,
      fallback_status: null,
    };

    // Test 1: Check if check_results table exists and is accessible
    try {
      const { data: checkResultsTest, error: checkResultsError } =
        await db.client.from('check_results').select('*').limit(1);

      if (checkResultsError) {
        results.check_results_table = {
          status: 'error',
          error: checkResultsError.message,
          accessible: false,
        };
      } else {
        results.check_results_table = {
          status: 'success',
          accessible: true,
          row_count: checkResultsTest?.length || 0,
        };
      }
    } catch (error) {
      results.check_results_table = {
        status: 'error',
        error: error.message,
        accessible: false,
      };
    }

    // Test 2: Check if monitoring_locations table exists and is accessible
    try {
      const { data: locationsTest, error: locationsError } = await db.client
        .from('monitoring_locations')
        .select('*')
        .limit(5);

      if (locationsError) {
        results.monitoring_locations_table = {
          status: 'error',
          error: locationsError.message,
          accessible: false,
        };
      } else {
        results.monitoring_locations_table = {
          status: 'success',
          accessible: true,
          locations: locationsTest || [],
          row_count: locationsTest?.length || 0,
        };
      }
    } catch (error) {
      results.monitoring_locations_table = {
        status: 'error',
        error: error.message,
        accessible: false,
      };
    }

    // Test 3: Test createCheckResult method
    try {
      const testResultData = {
        monitoring_check_id: '12345678-1234-1234-1234-123456789012', // Dummy UUID
        monitoring_location_id: '00000000-0000-0000-0000-000000000001', // Default location
        is_successful: true,
        response_time_ms: 150,
        status_code: 200,
        response_body: null,
        response_headers: null,
        error_message: null,
        ssl_info: null,
      };

      const testResult = await db.createCheckResult(testResultData);

      if (testResult) {
        results.sample_data_test = {
          status: 'success',
          created_result_id: testResult.id,
          message: 'Successfully created test check result',
        };

        // Clean up test data
        try {
          await db.client
            .from('check_results')
            .delete()
            .eq('id', testResult.id);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      } else {
        results.sample_data_test = {
          status: 'fallback',
          message: 'createCheckResult returned null (using fallback)',
        };
      }
    } catch (error) {
      results.sample_data_test = {
        status: 'error',
        error: error.message,
        message: 'Failed to create test check result',
      };
    }

    // Test 4: Check fallback behavior
    results.fallback_status = {
      default_locations_available:
        (await db.getDefaultMonitoringLocations()).length > 0,
      using_fallback_logic: results.check_results_table?.accessible === false,
    };

    return NextResponse.json({
      success: true,
      message: 'Check results storage functionality test completed',
      results,
      recommendations: generateRecommendations(results),
    });
  } catch (error) {
    console.error('Error testing check results storage:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test check results storage',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'create_tables') {
      return NextResponse.json({
        success: false,
        message: 'Table creation must be done manually in Supabase SQL Editor',
        instructions: [
          '1. Open your Supabase Dashboard → SQL Editor',
          '2. Copy the contents of scripts/create-check-results-table.sql',
          '3. Paste and execute the SQL script',
          '4. Run this test again to verify the tables were created',
        ],
        sql_file: 'scripts/create-check-results-table.sql',
      });
    }

    return NextResponse.json(
      {
        error:
          'Invalid action. Use GET to test or POST with action=create_tables for instructions.',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in POST handler:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process request',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

function generateRecommendations(results) {
  const recommendations = [];

  if (!results.check_results_table?.accessible) {
    recommendations.push({
      priority: 'high',
      issue: 'check_results table not accessible',
      action:
        'Run the migration script: scripts/create-check-results-table.sql',
      impact:
        'Monitoring results are being stored as workaround in services table',
    });
  }

  if (!results.monitoring_locations_table?.accessible) {
    recommendations.push({
      priority: 'medium',
      issue: 'monitoring_locations table not accessible',
      action: 'Run the migration script to create monitoring_locations table',
      impact:
        'Using default fallback locations instead of real geographic distribution',
    });
  }

  if (results.sample_data_test?.status === 'fallback') {
    recommendations.push({
      priority: 'medium',
      issue: 'Check results storage using fallback mechanism',
      action: 'Verify database permissions and table structure',
      impact: 'Monitoring data not stored in optimal format',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'success',
      issue: 'No issues found',
      action: 'Check results storage is working properly',
      impact: 'Monitoring system fully functional',
    });
  }

  return recommendations;
}
