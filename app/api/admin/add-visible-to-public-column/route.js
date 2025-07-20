import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

export const runtime = 'edge';

export async function POST(request) {
  try {
    const db = new SupabaseClient();
    
    // Use raw SQL to add the column if it doesn't exist
    const { data, error } = await db.adminClient.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN 
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'incident_updates' 
            AND column_name = 'visible_to_public'
          ) THEN
            ALTER TABLE incident_updates 
            ADD COLUMN visible_to_public BOOLEAN DEFAULT false;
          END IF;
        END $$;
      `
    });

    if (error) {
      console.error('SQL execution error:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to add column',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'visible_to_public column added to incident_updates table',
      data
    });
  } catch (error) {
    console.error('Add column error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to add column',
      details: error.message
    }, { status: 500 });
  }
}