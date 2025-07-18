import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request) {
  try {
    console.log('🔧 Creating monitoring tables...');

    // Create service_monitoring_checks table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.service_monitoring_checks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
        monitoring_check_id UUID NOT NULL REFERENCES public.monitoring_checks(id) ON DELETE CASCADE,
        failure_threshold_minutes INTEGER NOT NULL DEFAULT 5,
        failure_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(service_id, monitoring_check_id)
      );
    `;

    // Create indexes
    const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_service_monitoring_checks_service_id 
      ON public.service_monitoring_checks(service_id);

      CREATE INDEX IF NOT EXISTS idx_service_monitoring_checks_monitoring_check_id 
      ON public.service_monitoring_checks(monitoring_check_id);
    `;

    // Run table creation
    const { error: createError } = await db.client.rpc('exec_sql', {
      sql: createTableSQL,
    });

    if (createError) {
      console.error('Error creating table:', createError);
      return NextResponse.json(
        {
          error: 'Failed to create table',
          details: createError.message,
        },
        { status: 500 }
      );
    }

    // Run index creation
    const { error: indexError } = await db.client.rpc('exec_sql', {
      sql: createIndexesSQL,
    });

    if (indexError) {
      console.warn('Warning creating indexes:', indexError);
    }

    // Check if tables exist
    const { data: tables, error: checkError } = await db.client
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', [
        'service_monitoring_checks',
        'monitoring_checks',
        'services',
      ]);

    if (checkError) {
      console.error('Error checking tables:', checkError);
    }

    return NextResponse.json({
      success: true,
      message: 'Tables created successfully',
      tables: tables?.map(t => t.table_name) || [],
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in create-tables API:', error);
    return NextResponse.json(
      {
        error: 'Failed to create tables',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
