import { NextResponse } from 'next/server';
import { db } from '@/lib/db-supabase';
import { Auth } from '@/lib/api-utils';

export const runtime = 'edge';

export const GET = async (request) => {
  try {
    const session = await Auth.requireAuth(request);
    const user = await Auth.requireUser(db, session.user.email);

    // Get all escalations for debugging
    const allEscalations = await db.getAllIncidentEscalations();
    
    // Get timed out escalations
    const timedOutEscalations = await db.getTimedOutEscalations();
    
    // Get all active escalations (we'll filter by status in the query)
    const { searchParams } = new URL(request.url);
    const incidentId = searchParams.get('incident_id');
    
    let activeEscalations = [];
    if (incidentId) {
      activeEscalations = await db.getActiveIncidentEscalations(incidentId);
    } else {
      // Get all active escalations across all incidents
      const { data, error } = await db.client
        .from('incident_escalations')
        .select('*')
        .in('status', ['pending', 'notified'])
        .order('created_at', { ascending: false });
      
      if (!error) {
        activeEscalations = data || [];
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        all_escalations: allEscalations,
        timed_out_escalations: timedOutEscalations,
        active_escalations: activeEscalations,
        current_time: new Date().toISOString(),
      },
      debug_info: {
        total_escalations: allEscalations?.length || 0,
        timed_out_count: timedOutEscalations?.length || 0,
        active_count: activeEscalations?.length || 0,
      }
    });
    
  } catch (error) {
    console.error('Debug escalations error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
};

export const POST = async (request) => {
  try {
    const session = await Auth.requireAuth(request);
    const user = await Auth.requireUser(db, session.user.email);

    // Manually trigger escalation processing by calling the cron endpoint
    const cronResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/escalations/cron`, {
      method: 'GET',
    });
    
    const cronResult = await cronResponse.json();
    
    return NextResponse.json({
      success: true,
      message: 'Manually triggered escalation processing',
      cron_result: cronResult,
    });
    
  } catch (error) {
    console.error('Manual escalation trigger error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
};