import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { SupabaseClient } from '../../../../../lib/db-supabase.js';
import { authOptions } from '../../../auth/[...nextauth]/route.js';

const db = new SupabaseClient();

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: serviceId } = params;

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get service and verify access
    const service = await db.getServiceById(serviceId);
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
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

    // Get monitoring configuration
    const monitoring = await db.getServiceMonitoring(serviceId);

    return NextResponse.json({
      success: true,
      monitoring: monitoring || null,
    });
  } catch (error) {
    console.error('Error fetching service monitoring:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch service monitoring',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: serviceId } = params;
    const body = await request.json();

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get service and verify access
    const service = await db.getServiceById(serviceId);
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
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
    if (
      !membership ||
      !['owner', 'admin', 'responder'].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: 'Access denied - insufficient permissions' },
        { status: 403 }
      );
    }

    // Create monitoring configuration
    const monitoringData = {
      service_id: serviceId,
      ...body,
      created_by: user.id,
    };

    const monitoring = await db.createServiceMonitoring(monitoringData);

    return NextResponse.json(
      {
        success: true,
        monitoring,
        message: 'Service monitoring created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating service monitoring:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create service monitoring',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: serviceId } = params;
    const body = await request.json();

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get service and verify access
    const service = await db.getServiceById(serviceId);
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
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
    if (
      !membership ||
      !['owner', 'admin', 'responder'].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: 'Access denied - insufficient permissions' },
        { status: 403 }
      );
    }

    // Update monitoring configuration
    const updatedMonitoring = await db.updateServiceMonitoringByServiceId(
      serviceId,
      {
        ...body,
        updated_at: new Date().toISOString(),
      }
    );

    return NextResponse.json({
      success: true,
      monitoring: updatedMonitoring,
      message: 'Service monitoring updated successfully',
    });
  } catch (error) {
    console.error('Error updating service monitoring:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update service monitoring',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
