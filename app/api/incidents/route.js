import { NextResponse } from 'next/server';
import { SupabaseClient } from '../../../lib/db-supabase.js';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const status = searchParams.get('status');

    if (organizationId) {
      const incidents = await db.incidents.findByOrganizationId(
        organizationId,
        { status }
      );
      return NextResponse.json({ incidents });
    }

    // Get all incidents (with proper filtering)
    const incidents = await db.incidents.findAll({ status });
    return NextResponse.json({ incidents });
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

    // Create incident
    const incident = await db.incidents.create({
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
    });

    return NextResponse.json({ incident }, { status: 201 });
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

    const incident = await db.incidents.update(id, updateData);
    return NextResponse.json({ incident });
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

    await db.incidents.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting incident:', error);
    return NextResponse.json(
      { error: 'Failed to delete incident' },
      { status: 500 }
    );
  }
}
