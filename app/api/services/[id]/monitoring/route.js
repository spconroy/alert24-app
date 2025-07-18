import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request, { params }) {
  try {
    const session = await auth();
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
    const session = await auth();
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

// Helper function to clear existing associations for a service
async function clearExistingAssociations(serviceId) {
  console.log(`🧹 Clearing existing associations for service ${serviceId}`);

  try {
    // Delete all existing associations for this service from the junction table
    const { error } = await db.client
      .from('service_monitoring_checks')
      .delete()
      .eq('service_id', serviceId);

    if (error) {
      console.error('Error clearing existing associations:', error);
      throw error;
    }

    console.log(
      `✅ Cleared all existing associations for service ${serviceId}`
    );
  } catch (error) {
    console.error('Error in clearExistingAssociations:', error);
    throw error;
  }
}

// Helper function to create a monitoring association
async function createMonitoringAssociation(
  monitoringCheckId,
  serviceId,
  config
) {
  console.log(
    `🔗 Creating association: check ${monitoringCheckId} -> service ${serviceId}`
  );

  try {
    // Verify the monitoring check exists
    const { data: monitoringCheck, error: fetchError } = await db.client
      .from('monitoring_checks')
      .select('id, name')
      .eq('id', monitoringCheckId)
      .single();

    if (fetchError) {
      console.warn(
        `Monitoring check ${monitoringCheckId} not found:`,
        fetchError
      );
      return;
    }

    // Create the association in the junction table
    const associationData = {
      service_id: serviceId,
      monitoring_check_id: monitoringCheckId,
      failure_threshold_minutes: config.failure_threshold_minutes || 5,
      failure_message: config.failure_message || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: insertError } = await db.client
      .from('service_monitoring_checks')
      .insert(associationData);

    if (insertError) {
      console.error(
        `Error creating association for check ${monitoringCheckId}:`,
        insertError
      );
      throw insertError;
    }

    console.log(
      `✅ Created association: monitoring check "${monitoringCheck.name}" (${monitoringCheckId}) -> service ${serviceId}`
    );
  } catch (error) {
    console.error('Error in createMonitoringAssociation:', error);
    throw error;
  }
}

export async function PUT(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: serviceId } = params;
    const body = await request.json();

    console.log('🔄 PUT request received for service:', serviceId);
    console.log('📝 Request body:', body);

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
    // Extract associations from body
    const { associations } = body;

    try {
      console.log(`🔄 Processing ${associations?.length || 0} associations`);

      // First, clear any existing associations for this service
      await clearExistingAssociations(serviceId);

      // Then create new associations
      for (const association of associations || []) {
        await createMonitoringAssociation(
          association.monitoring_check_id,
          serviceId,
          association
        );
      }

      console.log('✅ Service monitoring associations updated successfully');

      return NextResponse.json({
        success: true,
        message: 'Service monitoring associations updated successfully',
        associations_count: associations?.length || 0,
      });
    } catch (error) {
      console.error('Error updating service monitoring associations:', error);
      throw error;
    }
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
