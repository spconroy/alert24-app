import { NextResponse } from 'next/server';
import { SupabaseClient } from '../../../lib/db-supabase.js';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(req) {
  try {
    // Test database connection
    const testConnection = await db.testConnection();
    
    // Try to select from on_call_schedules table
    let tableTest = null;
    let tableError = null;
    
    try {
      const { data, error } = await db.client
        .from('on_call_schedules')
        .select('*')
        .limit(1);
      
      if (error) {
        tableError = error;
      } else {
        tableTest = { 
          success: true, 
          sampleData: data,
          message: 'Table accessible' 
        };
      }
    } catch (err) {
      tableError = err;
    }

    // Try to insert test data
    let insertTest = null;
    let insertError = null;
    
    try {
      const testData = {
        organization_id: '80fe7a23-0a4d-461b-bb4a-f0a5fd251781',
        name: 'Debug Test Schedule',
        description: 'Test',
        is_active: true,
        timezone: 'UTC',
        rotation_config: { type: 'weekly' },
        members: [{ user_id: '3b3e5e75-a6ca-4680-83b0-35455901f1d1', order: 1 }]
      };
      
      const { data, error } = await db.client
        .from('on_call_schedules')
        .insert(testData)
        .select()
        .single();
      
      if (error) {
        insertError = error;
      } else {
        insertTest = { success: true, data };
        // Clean up test data
        await db.client
          .from('on_call_schedules')
          .delete()
          .eq('id', data.id);
      }
    } catch (err) {
      insertError = err;
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tests: {
        connection: testConnection,
        tableAccess: tableTest || { success: false, error: tableError },
        insertTest: insertTest || { success: false, error: insertError }
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}