import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export async function POST() {
  try {
    console.log('🔧 Adding incident_number column...');
    
    // Initialize Supabase client with service role key for admin operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Simple SQL to add the column
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: 'ALTER TABLE incidents ADD COLUMN IF NOT EXISTS incident_number INTEGER;'
    });
    
    if (error) {
      console.error('Failed to add column:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to add incident_number column',
        details: error.message
      }, { status: 500 });
    }

    console.log('✅ Column added successfully');

    return NextResponse.json({
      success: true,
      message: 'incident_number column added successfully',
      data
    });

  } catch (error) {
    console.error('Admin operation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to add column',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}