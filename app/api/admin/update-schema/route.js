import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function POST(request) {
  try {
    console.log('🔧 Applying schema updates...');

    // Add failure_status column to service_monitoring_checks table
    const addColumnSQL = `
      DO $$
      BEGIN
          -- Check if the column already exists
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'service_monitoring_checks' 
              AND column_name = 'failure_status'
          ) THEN
              -- Add the failure_status column
              ALTER TABLE public.service_monitoring_checks 
              ADD COLUMN failure_status VARCHAR(20) NOT NULL DEFAULT 'degraded' 
              CHECK (failure_status IN ('degraded', 'down', 'maintenance'));
              
              RAISE NOTICE 'Added failure_status column to service_monitoring_checks table';
          ELSE
              RAISE NOTICE 'failure_status column already exists in service_monitoring_checks table';
          END IF;
      END $$;
    `;

    // Add comment and update existing records
    const updateDataSQL = `
      -- Add a comment to explain the column
      COMMENT ON COLUMN public.service_monitoring_checks.failure_status IS 
      'Service status to set when this monitoring check fails: degraded, down, or maintenance';

      -- Update existing records to have 'degraded' as the default (less severe than 'down')
      UPDATE public.service_monitoring_checks 
      SET failure_status = 'degraded' 
      WHERE failure_status IS NULL OR failure_status = '';
    `;

    // Execute the schema update
    const { error: schemaError } = await db.client.rpc('exec_sql', {
      sql: addColumnSQL,
    });

    if (schemaError) {
      console.error('Error updating schema:', schemaError);
      return NextResponse.json(
        {
          error: 'Failed to update schema',
          details: schemaError.message,
        },
        { status: 500 }
      );
    }

    // Execute the data update
    const { error: dataError } = await db.client.rpc('exec_sql', {
      sql: updateDataSQL,
    });

    if (dataError) {
      console.warn('Warning updating data:', dataError);
    }

    console.log('✅ Schema update completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Schema updated successfully',
      updates: [
        'Added failure_status column to service_monitoring_checks table',
        'Set default failure_status to "degraded" for existing associations',
        'Added column documentation',
      ],
    });
  } catch (error) {
    console.error('Schema update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Schema update failed',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
