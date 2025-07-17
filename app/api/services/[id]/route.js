import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { SupabaseClient } from '../../../../lib/db-supabase.js';
import { authOptions } from '../../auth/[...nextauth]/route.js';

const db = new SupabaseClient();

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceId = params.id;

    // Get the service and verify access
    const service = await db.getServiceById(serviceId);

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Check if user has access to this organization
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 403 });
    }

    // Check organization membership
    const organizationId = service.status_pages?.organization_id;
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Service organization not found' },
        { status: 404 }
      );
    }

    const membership = await db.getOrganizationMember(organizationId, user.id);
    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied - not a member of this organization' },
        { status: 403 }
      );
    }

    // Transform the data to match expected format
    const formattedService = {
      ...service,
      status_page_name: service.status_pages?.name,
      organization_id: service.status_pages?.organization_id,
      organization_name: service.status_pages?.organizations?.name,
    };

    return NextResponse.json({
      success: true,
      service: formattedService,
    });
  } catch (err) {
    console.error('Error fetching service:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch service',
        details: err.message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceId = params.id;
    const body = await req.json();

    // Get the service and verify access
    const service = await db.getServiceById(serviceId);
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Check if user has access to this organization
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 403 });
    }

    // Check organization membership
    const organizationId = service.status_pages?.organization_id;
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Service organization not found' },
        { status: 404 }
      );
    }

    const membership = await db.getOrganizationMember(organizationId, user.id);
    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied - not a member of this organization' },
        { status: 403 }
      );
    }

    // Update service
    const updatedService = await db.updateService(serviceId, {
      ...body,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      service: updatedService,
      message: 'Service updated successfully',
    });
  } catch (err) {
    console.error('Error updating service:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update service',
        details: err.message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceId = params.id;

    // Get the service and verify access
    const service = await db.getServiceById(serviceId);
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Check if user has access to this organization
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 403 });
    }

    // Check organization membership
    const organizationId = service.status_pages?.organization_id;
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Service organization not found' },
        { status: 404 }
      );
    }

    const membership = await db.getOrganizationMember(organizationId, user.id);
    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied - not a member of this organization' },
        { status: 403 }
      );
    }

    // Soft delete service
    const deletedService = await db.deleteService(serviceId);

    return NextResponse.json({
      success: true,
      service: deletedService,
      message: 'Service deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting service:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete service',
        details: err.message,
      },
      { status: 500 }
    );
  }
}
