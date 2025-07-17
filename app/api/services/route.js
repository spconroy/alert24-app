import { SupabaseClient } from '../../../lib/db-supabase.js';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route.js';

const db = new SupabaseClient();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusPageId =
      searchParams.get('status_page_id') || searchParams.get('statusPageId');
    const organizationId =
      searchParams.get('organization_id') || searchParams.get('organizationId');

    if (statusPageId) {
      // Get services for a specific status page
      const { data: services, error } = await db.client
        .from('services')
        .select('*')
        .eq('status_page_id', statusPageId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return NextResponse.json({ services });
    }

    if (organizationId) {
      // Get services for an organization (through status pages)
      const { data: services, error } = await db.client
        .from('services')
        .select(
          `
          *,
          status_pages!inner(
            organization_id
          )
        `
        )
        .eq('status_pages.organization_id', organizationId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return NextResponse.json({ services });
    }

    // Get all services - require authentication for this
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: services, error } = await db.client
      .from('services')
      .select('*')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
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
    const service = await db.createService({
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
