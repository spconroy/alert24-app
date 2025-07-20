import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient, db } from '@/lib/db-supabase';

// Use the singleton instance instead of creating a new one
// const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(req, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
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
      // visible_to_subscribers is already the correct field name in the database
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
    const session = await sessionManager.getSessionFromRequest(req);
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
      post_as_public_update = false,
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
      user_id: user.id,
      message,
      status: status || incident.status,
      visible_to_public: post_as_public_update,
    };

    const newUpdate = await db.createIncidentUpdate(updateData);

    // Handle public update posting to affected services
    if (post_as_public_update && incident.affected_services?.length > 0) {
      try {
        // In a real implementation, this would post to external service status pages
        // For now, we'll log this action and could extend to integrate with services like:
        // - StatusPage.io
        // - Atlassian Statuspage
        // - Custom status page APIs
        console.log('Public update requested for services:', incident.affected_services);
        console.log('Update message:', message);
        console.log('Update status:', status || incident.status);
        
        // TODO: Implement actual service status page integrations
        // This could involve:
        // 1. Posting to external status page APIs
        // 2. Updating service status dashboards
        // 3. Sending notifications to service subscribers
      } catch (err) {
        console.error('Error posting public update to services:', err);
        // Don't fail the entire request if public posting fails
      }
    }

    // Add user information to the newly created update for immediate display
    const updateWithUser = {
      ...newUpdate,
      posted_by_user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      visible_to_public: post_as_public_update,
    };

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
        update: updateWithUser,
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
    const session = await sessionManager.getSessionFromRequest(req);
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
    const session = await sessionManager.getSessionFromRequest(req);
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
