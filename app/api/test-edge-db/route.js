import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

export const runtime = 'edge';

export async function GET() {
  try {
    console.log('🧪 Testing database connection in edge runtime...');
    
    // Test environment variables
    const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('Environment check:', { hasUrl, hasAnonKey, hasServiceKey });
    
    if (!hasUrl || !hasAnonKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing Supabase environment variables',
        details: { hasUrl, hasAnonKey, hasServiceKey }
      }, { status: 500 });
    }
    
    // Test database connection
    const db = new SupabaseClient();
    
    // Simple test query
    const { data, error } = await db.client
      .from('organizations')
      .select('id, name')
      .limit(1);
    
    if (error) {
      console.error('Database test failed:', error);
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        details: error.message
      }, { status: 500 });
    }
    
    console.log('✅ Database test successful');
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      data: data || [],
      env_check: { hasUrl, hasAnonKey, hasServiceKey }
    });
    
  } catch (error) {
    console.error('Edge runtime test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Edge runtime test failed',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}