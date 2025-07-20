import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(req, { params }) {
  try {
    console.log('🔍 GET /api/incidents/[id] - Starting request');
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
    console.log('📋 Session check result:', !!session, session?.user?.email);
    
    if (!session || !session.user?.email) {
      console.log('❌ Unauthorized - no session or email');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    console.log('📝 Incident ID from params:', id);
    if (!id) {
      console.log('❌ No incident ID provided');
      return NextResponse.json(
        { error: 'Incident ID is required' },
        { status: 400 }
      );
    }

    // Get user ID
    console.log('👤 Getting user by email:', session.user.email);
    const user = await db.getUserByEmail(session.user.email);
    console.log('👤 User lookup result:', !!user, user?.id);
    if (!user) {
      console.log('❌ User not found for email:', session.user.email);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get incident with organization membership check
    console.log('🎯 Getting incident by ID:', id, 'for user:', user.id);
    const incident = await db.getIncidentById(id, user.id);
    console.log('🎯 Incident lookup result:', !!incident);
    if (!incident) {
      console.log('❌ Incident not found or access denied:', id);
      return NextResponse.json(
        { error: 'Incident not found or access denied' },
        { status: 404 }
      );
    }

    // Transform the data to match expected format
    const formattedIncident = {
      ...incident,
      organization_name: incident.organizations?.name,
      created_by_name: incident.created_by_user?.name,
      created_by_email: incident.created_by_user?.email,
      assigned_to_name: incident.assigned_to_user?.name,
      assigned_to_email: incident.assigned_to_user?.email,
      escalation_policy_name: incident.escalation_policies?.name,
      escalation_timeout_minutes:
        incident.escalation_policies?.escalation_timeout_minutes,
    };

    return NextResponse.json({
      success: true,
      incident: formattedIncident,
    });
  } catch (err) {
    console.error('❌ Error fetching incident:', err);
    console.error('❌ Error stack:', err.stack);
    console.error('❌ Error details:', {
      message: err.message,
      name: err.name,
      cause: err.cause
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch incident',
        details: err.message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: 'Incident ID is required' },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Get user ID
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if incident exists and user has access
    const existingIncident = await db.getIncidentById(id, user.id);
    if (!existingIncident) {
      return NextResponse.json(
        { error: 'Incident not found or access denied' },
        { status: 404 }
      );
    }

    // Update incident
    const updatedIncident = await db.updateIncident(id, {
      ...body,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      incident: updatedIncident,
      message: 'Incident updated successfully',
    });
  } catch (err) {
    console.error('Error updating incident:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update incident',
        details: err.message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: 'Incident ID is required' },
        { status: 400 }
      );
    }

    // Get user ID
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if incident exists and user has access
    const existingIncident = await db.getIncidentById(id, user.id);
    if (!existingIncident) {
      return NextResponse.json(
        { error: 'Incident not found or access denied' },
        { status: 404 }
      );
    }

    // Delete incident
    await db.deleteIncident(id);

    return NextResponse.json({
      success: true,
      message: 'Incident deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting incident:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete incident',
        details: err.message,
      },
      { status: 500 }
    );
  }
}
