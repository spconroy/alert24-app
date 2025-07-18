import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export async function GET(request) {
  return handleRequest();
}

export async function POST(request) {
  return handleRequest();
}

async function handleRequest() {
  try {
    console.log('🔧 Testing service_monitoring_checks table structure...');

    // Test if the table exists and what columns it has by attempting a select
    const { data: testSelect, error: selectError } = await db.client
      .from('service_monitoring_checks')
      .select('*')
      .limit(1);

    if (selectError) {
      return NextResponse.json(
        {
          error: 'service_monitoring_checks table error',
          details: selectError.message,
          code: selectError.code,
        },
        { status: 500 }
      );
    }

    // Test if we can insert with failure_message column
    const testData = {
      service_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
      monitoring_check_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
      failure_threshold_minutes: 5,
      failure_message: 'test', // This will fail if column doesn't exist
    };

    // Attempt dry-run insert (we'll immediately delete if successful)
    const { data: insertData, error: insertError } = await db.client
      .from('service_monitoring_checks')
      .insert(testData)
      .select();

    // Delete the test record immediately if it was inserted
    if (insertData && insertData.length > 0) {
      const { error: deleteError } = await db.client
        .from('service_monitoring_checks')
        .delete()
        .eq('id', insertData[0].id);

      if (deleteError) {
        console.warn('Could not delete test record:', deleteError);
      }
    }

    if (insertError) {
      if (
        insertError.message &&
        insertError.message.includes('failure_message')
      ) {
        return NextResponse.json({
          success: false,
          table_exists: true,
          failure_message_column_exists: false,
          error: 'failure_message column is missing',
          fix_required: true,
          manual_fix_sql:
            'ALTER TABLE public.service_monitoring_checks ADD COLUMN failure_message TEXT;',
          instructions: [
            '1. Go to your Supabase Dashboard',
            '2. Navigate to SQL Editor',
            '3. Run: ALTER TABLE public.service_monitoring_checks ADD COLUMN failure_message TEXT;',
            '4. Try linking monitoring checks to services again',
          ],
          error_details: insertError.message,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: 'Other table structure issue',
          details: insertError.message,
          code: insertError.code,
        });
      }
    }

    // If we got here, the column exists and the test was successful
    return NextResponse.json({
      success: true,
      table_exists: true,
      failure_message_column_exists: true,
      message: 'service_monitoring_checks table has all required columns',
      test_completed: true,
    });
  } catch (error) {
    console.error('Schema test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test schema',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
