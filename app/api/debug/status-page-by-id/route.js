import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'ID parameter required' }, { status: 400 });
    }

    const db = new SupabaseClient();

    const { data, error } = await db.client
      .from('status_pages')
      .select('*')
      .eq('id', id)
      .single();

    return NextResponse.json({
      success: true,
      statusPage: data,
      error: error?.message
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}