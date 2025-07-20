import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const incidentId = searchParams.get('incident_id');
    
    const db = new SupabaseClient();

    if (incidentId) {
      // Check incident updates for specific incident
      const { data: updates, error } = await db.adminClient
        .from('incident_updates')
        .select('*')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false });

      return NextResponse.json({
        success: true,
        incident_id: incidentId,
        updates: updates || [],
        count: updates?.length || 0,
        error: error?.message
      });
    } else {
      // Get all incident updates
      const { data: allUpdates, error } = await db.adminClient
        .from('incident_updates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      return NextResponse.json({
        success: true,
        all_updates: allUpdates || [],
        count: allUpdates?.length || 0,
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