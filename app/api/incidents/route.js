import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { SupabaseClient } from '../../../lib/db-supabase.js';
import { authOptions } from '../auth/[...nextauth]/route.js';

const db = new SupabaseClient();

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organization_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit')) || 25;
    const offset = parseInt(searchParams.get('offset')) || 0;

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (organizationId) {
      // Verify user has access to this organization
      const membership = await db.getOrganizationMember(
        organizationId,
        user.id
      );
      if (!membership) {
        return NextResponse.json(
          { error: 'Access denied - not a member of this organization' },
          { status: 403 }
        );
      }

      const incidents = await db.getIncidentsByOrganization(organizationId);
      // Filter by status if provided
      const filteredIncidents = status
        ? incidents.filter(incident => incident.status === status)
        : incidents;

      return NextResponse.json({
        success: true,
        incidents: filteredIncidents.slice(offset, offset + limit),
        total: filteredIncidents.length,
      });
    }

    // Return empty array if no organization specified
    return NextResponse.json({
      success: true,
      incidents: [],
      total: 0,
      message: 'Organization ID required',
    });
  } catch (error) {
    console.error('Error fetching incidents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch incidents' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const {
      organizationId,
      title,
      description,
      severity = 'medium',
      status = 'investigating',
      affectedServices,
      impactDescription,
      assignedTo,
      createdBy,
      source = 'manual',
    } = await request.json();

    // Validate required fields
    if (!organizationId || !title) {
      return NextResponse.json(
        { error: 'Organization ID and title are required' },
        { status: 400 }
      );
    }

    // Create incident data object
    const incidentData = {
      organization_id: organizationId,
      title,
      description,
      severity,
      status,
      affected_services: affectedServices,
      impact_description: impactDescription,
      assigned_to: assignedTo,
      created_by: createdBy,
      source,
    };

    // Create the incident in the database
    const incident = await db.createIncident(incidentData);

    return NextResponse.json(
      {
        success: true,
        incident,
        message: 'Incident created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating incident:', error);
    return NextResponse.json(
      { error: 'Failed to create incident' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const {
      id,
      title,
      description,
      severity,
      status,
      affectedServices,
      impactDescription,
      assignedTo,
      resolvedAt,
      acknowledgedAt,
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Incident ID is required' },
        { status: 400 }
      );
    }

    const updateData = {
      title,
      description,
      severity,
      status,
      affected_services: affectedServices,
      impact_description: impactDescription,
      assigned_to: assignedTo,
    };

    // Add timestamp fields if provided
    if (resolvedAt !== undefined) {
      updateData.resolved_at = resolvedAt;
    }
    if (acknowledgedAt !== undefined) {
      updateData.acknowledged_at = acknowledgedAt;
    }

    // Update the incident in the database
    const incident = await db.updateIncident(id, updateData);

    return NextResponse.json({
      success: true,
      incident,
      message: 'Incident updated successfully',
    });
  } catch (error) {
    console.error('Error updating incident:', error);
    return NextResponse.json(
      { error: 'Failed to update incident' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Incident ID is required' },
        { status: 400 }
      );
    }

    // Delete the incident from the database
    await db.deleteIncident(id);

    return NextResponse.json({
      success: true,
      message: 'Incident deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting incident:', error);
    return NextResponse.json(
      { error: 'Failed to delete incident' },
      { status: 500 }
    );
  }
}
