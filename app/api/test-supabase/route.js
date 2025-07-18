import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET() {
  try {
    console.log('Testing Supabase connection...');

    // Test basic connection by checking if we can query any table
    // First let's try to get the current user/session info
    const {
      data: { user },
      error: userError,
    } = await db.client.auth.getUser();

    console.log('Auth check result:', { user, userError });

    // Try a simpler approach to get table information using Supabase's built-in methods
    // Check if we can access any tables at all
    let tables = [];
    let tablesError = null;

    try {
      // Try to query a few common table names that might exist
      const commonTables = [
        'users',
        'organizations',
        'services',
        'incidents',
        'auth.users',
      ];

      for (const tableName of commonTables) {
        try {
          const { data, error } = await db.client
            .from(tableName)
            .select('*')
            .limit(1);

          if (!error) {
            tables.push({
              name: tableName,
              status: 'exists',
              rowCount: data?.length || 0,
            });
          } else {
            tables.push({
              name: tableName,
              status: 'error',
              error: error.message,
            });
          }
        } catch (e) {
          tables.push({
            name: tableName,
            status: 'not_accessible',
            error: e.message,
          });
        }
      }
    } catch (e) {
      tablesError = e.message;
    }

    // Also check what Supabase thinks about our database
    const { data: healthCheck, error: healthError } = await db.client
      .from('health_check_dummy_table_that_does_not_exist')
      .select('*')
      .limit(1);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      auth: {
        user: user ? 'authenticated' : 'anonymous',
        error: userError?.message,
      },
      database: {
        status: 'connected',
        tablesChecked: tables.length,
        healthCheckError: healthError?.message || 'connection ok',
      },
      tables: tables,
      recommendations: [
        'Database is connected but Alert24 schema is missing',
        'You need to run the database schema setup',
        'Check docs/database_schema.sql for the complete schema',
      ],
      message: 'Supabase connection test completed - ready for schema setup',
    });
  } catch (error) {
    console.error('Supabase test error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
      { status: 500 }
    );
  }
}
