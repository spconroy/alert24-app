import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('id');
    
    const db = new SupabaseClient();

    if (serviceId) {
      // Look up specific service
      const { data, error } = await db.client
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .single();

      return NextResponse.json({
        success: true,
        service: data,
        error: error?.message
      });
    } else {
      // Get all services
      const { data, error } = await db.client
        .from('services')
        .select('*')
        .limit(20);

      return NextResponse.json({
        success: true,
        services: data || [],
        error: error?.message
      });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}