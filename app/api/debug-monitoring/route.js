import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

export const runtime = 'edge';

export async function GET() {
  try {
    console.log('🔍 Debug Monitoring API - Environment check:', {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      runtime: process.env.NODE_ENV,
    });

    // Test database connection
    let dbConnection = null;
    try {
      const db = new SupabaseClient();
      dbConnection = await db.testConnection();
      console.log('✅ Database connection test result:', dbConnection);
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError);
      dbConnection = {
        success: false,
        error: dbError.message,
        code: dbError.code,
      };
    }

    // Test if we can query the monitoring_checks table (without authentication)
    let tableAccess = null;
    try {
      const db = new SupabaseClient();
      // Try to get table structure info without actual data
      const { data, error } = await db.client
        .from('monitoring_checks')
        .select('count')
        .limit(0);

      tableAccess = {
        success: !error,
        error: error?.message,
        code: error?.code,
      };
      console.log('📊 Table access test result:', tableAccess);
    } catch (tableError) {
      console.error('❌ Table access failed:', tableError);
      tableAccess = {
        success: false,
        error: tableError.message,
        code: tableError.code,
      };
    }

    return NextResponse.json({
      success: dbConnection?.success && tableAccess?.success,
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        supabaseUrlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(
          0,
          30
        ),
        runtime: 'edge',
      },
      database: dbConnection,
      tableAccess: tableAccess,
      diagnostics: {
        message: dbConnection?.success
          ? 'Database connection successful'
          : 'Database connection failed - check environment variables',
        nextSteps: dbConnection?.success
          ? [
              'Database is accessible',
              'Check authentication in main monitoring API',
            ]
          : [
              'Verify NEXT_PUBLIC_SUPABASE_URL is set',
              'Verify NEXT_PUBLIC_SUPABASE_ANON_KEY is set',
              'Check Cloudflare Pages environment variables',
            ],
      },
    });
  } catch (error) {
    console.error('🔥 Debug monitoring API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString(),
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          runtime: 'edge',
        },
      },
      { status: 500 }
    );
  }
}
