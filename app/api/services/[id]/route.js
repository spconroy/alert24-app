import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(req, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
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
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
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

    // Filter only valid fields that exist in the services table
    const validFields = {
      name: body.name,
      description: body.description,
      status: body.status,
      sort_order: body.sort_order,
      updated_at: new Date().toISOString(),
    };

    // Only include auto_recovery if it's provided
    if (body.auto_recovery !== undefined) {
      validFields.auto_recovery = body.auto_recovery;
    }

    // Remove undefined fields
    Object.keys(validFields).forEach(key => {
      if (validFields[key] === undefined) {
        delete validFields[key];
      }
    });

    // Track status change for SLA calculation if status is being updated
    if (validFields.status && validFields.status !== service.status) {
      await db.trackServiceStatusChange(
        serviceId,
        validFields.status,
        service.status
      );
    }

    // Update service with graceful handling of missing columns
    let updatedService;
    try {
      updatedService = await db.updateService(serviceId, validFields);
    } catch (error) {
      // If auto_recovery column doesn't exist, retry without it
      if (
        error.message?.includes('auto_recovery') &&
        validFields.auto_recovery !== undefined
      ) {
        console.log('Auto recovery column not found, retrying without it...');
        delete validFields.auto_recovery;
        updatedService = await db.updateService(serviceId, validFields);
      } else {
        throw error; // Re-throw if it's a different error
      }
    }

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
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
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
