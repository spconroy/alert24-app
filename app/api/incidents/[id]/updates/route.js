import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(req, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: incidentId } = params;
    if (!incidentId) {
      return NextResponse.json(
        { error: 'Incident ID is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user has access to the incident
    const incident = await db.getIncidentById(incidentId, user.id);
    if (!incident) {
      return NextResponse.json(
        { error: 'Incident not found or access denied' },
        { status: 404 }
      );
    }

    // Get incident updates
    const updates = await db.getIncidentUpdates(incidentId);

    // Transform the data to match expected format
    const formattedUpdates = updates.map(update => ({
      ...update,
      posted_by_name: update.posted_by_user?.name,
      posted_by_email: update.posted_by_user?.email,
    }));

    return NextResponse.json({
      success: true,
      updates: formattedUpdates,
    });
  } catch (err) {
    console.error('Error fetching incident updates:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch incident updates',
        details: err.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: incidentId } = params;
    if (!incidentId) {
      return NextResponse.json(
        { error: 'Incident ID is required' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      message,
      status,
      update_type = 'update',
      visible_to_subscribers = true,
    } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user has access to the incident
    const incident = await db.getIncidentById(incidentId, user.id);
    if (!incident) {
      return NextResponse.json(
        { error: 'Incident not found or access denied' },
        { status: 404 }
      );
    }

    // Create incident update
    const updateData = {
      incident_id: incidentId,
      message,
      status: status || incident.status,
      update_type,
      posted_by: user.id,
      visible_to_subscribers,
    };

    const newUpdate = await db.createIncidentUpdate(updateData);

    // If status changed, update the incident
    if (status && status !== incident.status) {
      await db.updateIncident(incidentId, {
        status,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        success: true,
        update: newUpdate,
        message: 'Incident update created successfully',
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error creating incident update:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create incident update',
        details: err.message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: incidentId } = params;
    const { searchParams } = new URL(req.url);
    const updateId = searchParams.get('updateId');

    if (!incidentId || !updateId) {
      return NextResponse.json(
        { error: 'Incident ID and Update ID are required' },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user has access to the incident
    const incident = await db.getIncidentById(incidentId, user.id);
    if (!incident) {
      return NextResponse.json(
        { error: 'Incident not found or access denied' },
        { status: 404 }
      );
    }

    // Update incident update
    const updatedUpdate = await db.updateIncidentUpdate(updateId, {
      ...body,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      update: updatedUpdate,
      message: 'Incident update updated successfully',
    });
  } catch (err) {
    console.error('Error updating incident update:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update incident update',
        details: err.message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: incidentId } = params;
    const { searchParams } = new URL(req.url);
    const updateId = searchParams.get('updateId');

    if (!incidentId || !updateId) {
      return NextResponse.json(
        { error: 'Incident ID and Update ID are required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user has access to the incident
    const incident = await db.getIncidentById(incidentId, user.id);
    if (!incident) {
      return NextResponse.json(
        { error: 'Incident not found or access denied' },
        { status: 404 }
      );
    }

    // Delete incident update
    await db.deleteIncidentUpdate(updateId);

    return NextResponse.json({
      success: true,
      message: 'Incident update deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting incident update:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete incident update',
        details: err.message,
      },
      { status: 500 }
    );
  }
}
