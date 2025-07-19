import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function POST(request) {
  try {
    console.log('🚀 Creating escalation_policies table...');

    // SQL to create the escalation_policies table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS escalation_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        escalation_timeout_minutes INTEGER DEFAULT 30,
        escalation_steps JSONB DEFAULT '[]'::jsonb,
        notification_config JSONB DEFAULT '{}'::jsonb,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
      );
    `;

    const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_escalation_policies_organization_id ON escalation_policies(organization_id);
      CREATE INDEX IF NOT EXISTS idx_escalation_policies_is_active ON escalation_policies(is_active);
      CREATE INDEX IF NOT EXISTS idx_escalation_policies_deleted_at ON escalation_policies(deleted_at);
    `;

    // Try to execute the SQL using the admin client
    try {
      // Use the admin client to execute raw SQL
      const { data, error } = await db.adminClient.rpc('exec_sql', {
        sql: createTableSQL,
      });

      if (error) {
        console.error('Error creating table:', error);
        throw error;
      }

      console.log('✅ Table created successfully');

      // Create indexes
      const { data: indexData, error: indexError } = await db.adminClient.rpc(
        'exec_sql',
        {
          sql: createIndexesSQL,
        }
      );

      if (indexError) {
        console.warn('Warning creating indexes:', indexError);
      } else {
        console.log('✅ Indexes created successfully');
      }

      // Test the table
      const { data: testData, error: testError } = await db.client
        .from('escalation_policies')
        .select('count')
        .limit(1);

      if (testError) {
        console.error('Error testing table:', testError);
        throw testError;
      }

      return NextResponse.json({
        success: true,
        message: 'Escalation policies table created successfully',
        table_accessible: true,
      });
    } catch (sqlError) {
      console.error('SQL execution error:', sqlError);

      // Fallback: Try to create table using Supabase client methods
      // This won't work for CREATE TABLE but let's try accessing the table first
      const { data: existingData, error: existingError } = await db.client
        .from('escalation_policies')
        .select('count')
        .limit(1);

      if (!existingError) {
        return NextResponse.json({
          success: true,
          message: 'Escalation policies table already exists',
          table_accessible: true,
        });
      }

      throw sqlError;
    }
  } catch (error) {
    console.error('Error creating escalation policies table:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create escalation policies table',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
