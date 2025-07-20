import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export async function GET(request) {
  try {
    // Check incident_updates table structure
    const { data, error } = await db.client
      .from('incident_updates')
      .select('*')
      .limit(1);

    let columns = [];
    if (data && data.length > 0) {
      columns = Object.keys(data[0]);
    } else {
      // Get a sample with empty result to see structure
      const { data: emptyData, error: emptyError } = await db.client
        .from('incident_updates')
        .select('*')
        .limit(0);
      
      if (!emptyError) {
        columns = ['Table exists but empty'];
      }
    }

    return NextResponse.json({
      success: true,
      table_name: 'incident_updates',
      columns,
      sample_data: data,
      error: error?.message
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}