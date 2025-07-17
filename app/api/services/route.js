import { SupabaseClient } from '../../../lib/db-supabase.js';

const db = new SupabaseClient();
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusPageId = searchParams.get('statusPageId');
    const organizationId = searchParams.get('organizationId');

    if (statusPageId) {
      // Get services for a specific status page
      const services = await db.services.findByStatusPageId(statusPageId);
      return NextResponse.json({ services });
    }

    if (organizationId) {
      // Get services for an organization (through status pages)
      const services = await db.services.findByOrganizationId(organizationId);
      return NextResponse.json({ services });
    }

    // Get all services (with proper filtering)
    const services = await db.services.findAll();
    return NextResponse.json({ services });
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const {
      statusPageId,
      name,
      description,
      status = 'operational',
      sortOrder = 0,
    } = await request.json();

    // Validate required fields
    if (!statusPageId || !name) {
      return NextResponse.json(
        { error: 'Status page ID and service name are required' },
        { status: 400 }
      );
    }

    // Create service
    const service = await db.services.create({
      status_page_id: statusPageId,
      name,
      description,
      status,
      sort_order: sortOrder,
    });

    return NextResponse.json({ service }, { status: 201 });
  } catch (error) {
    console.error('Error creating service:', error);
    return NextResponse.json(
      { error: 'Failed to create service' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const { id, name, description, status, sortOrder } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Service ID is required' },
        { status: 400 }
      );
    }

    const service = await db.services.update(id, {
      name,
      description,
      status,
      sort_order: sortOrder,
    });

    return NextResponse.json({ service });
  } catch (error) {
    console.error('Error updating service:', error);
    return NextResponse.json(
      { error: 'Failed to update service' },
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
        { error: 'Service ID is required' },
        { status: 400 }
      );
    }

    await db.services.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting service:', error);
    return NextResponse.json(
      { error: 'Failed to delete service' },
      { status: 500 }
    );
  }
}
