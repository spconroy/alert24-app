import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const db = new SupabaseClient();
    
    // Get the table structure using a simple select to see what columns exist
    const { data: sampleData, error: sampleError } = await db.adminClient
      .from('incident_updates')
      .select('*')
      .limit(1);

    if (sampleError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to query incident_updates table',
        details: sampleError.message
      }, { status: 500 });
    }

    // If we have data, we can see the columns
    let columns = [];
    if (sampleData && sampleData.length > 0) {
      columns = Object.keys(sampleData[0]).map(col => ({
        column_name: col,
        has_data: true
      }));
    } else {
      // Table exists but is empty, try to insert a test record to see what columns are expected
      try {
        const testData = {
          incident_id: '00000000-0000-0000-0000-000000000000', // This will fail but show us the expected columns
          message: 'test',
          user_id: '00000000-0000-0000-0000-000000000000'
        };
        
        const { data: insertData, error: insertError } = await db.adminClient
          .from('incident_updates')
          .insert(testData)
          .select();
          
        if (insertError) {
          // Extract column info from error message
          columns = [{ column_name: 'Error reveals structure', error: insertError.message }];
        }
      } catch (e) {
        columns = [{ column_name: 'Could not determine', error: e.message }];
      }
    }

    const data = columns;
    const error = null;

    if (error) {
      console.error('Schema query error:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to get table structure',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      table_name: 'incident_updates',
      columns: data
    });
  } catch (error) {
    console.error('Table structure error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get table structure',
      details: error.message
    }, { status: 500 });
  }
}