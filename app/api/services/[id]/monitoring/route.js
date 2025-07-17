import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { SupabaseClient } from '../../../../../lib/db-supabase.js';

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
      // Process each association by updating the monitoring check data
      // This follows the established pattern of storing linked_service_id in monitoring check data

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

      return NextResponse.json({
        success: true,
        message: 'Service monitoring associations updated successfully',
        associations_count: associations?.length || 0,
      });
    } catch (error) {
      console.error('Error updating service monitoring associations:', error);
      throw error;
    }

    // Helper function to clear existing associations for a service
    async function clearExistingAssociations(serviceId) {
      // Get all monitoring checks that are currently linked to this service
      const { data: monitoringChecks, error } = await db.client
        .from('services')
        .select('*')
        .ilike('name', '[[]MONITORING]%');

      if (error) throw error;

      for (const check of monitoringChecks || []) {
        try {
          const checkData = JSON.parse(check.description);
          if (checkData.linked_service_id === serviceId) {
            // Remove the association
            delete checkData.linked_service_id;

            const dbData = {
              description: JSON.stringify(checkData),
              updated_at: new Date().toISOString(),
            };

            await db.client.from('services').update(dbData).eq('id', check.id);
          }
        } catch (parseError) {
          console.warn('Error parsing monitoring check data:', parseError);
        }
      }
    }

    // Helper function to create a monitoring association
    async function createMonitoringAssociation(
      monitoringCheckId,
      serviceId,
      config
    ) {
      // Get the monitoring check data
      const { data: monitoringCheck, error: fetchError } = await db.client
        .from('services')
        .select('*')
        .eq('id', monitoringCheckId)
        .ilike('name', '[[]MONITORING]%')
        .single();

      if (fetchError) {
        console.warn(
          `Monitoring check ${monitoringCheckId} not found:`,
          fetchError
        );
        return;
      }

      try {
        // Parse and update the stored monitoring data
        const checkData = JSON.parse(monitoringCheck.description);

        // Set the association
        checkData.linked_service_id = serviceId;

        // Store additional configuration if provided
        if (config.failure_threshold_minutes) {
          checkData.failure_threshold_minutes =
            config.failure_threshold_minutes;
        }
        if (config.failure_message) {
          checkData.failure_message = config.failure_message;
        }

        const dbData = {
          description: JSON.stringify(checkData),
          updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await db.client
          .from('services')
          .update(dbData)
          .eq('id', monitoringCheckId);

        if (updateError) {
          console.error(
            `Error updating monitoring check ${monitoringCheckId}:`,
            updateError
          );
        } else {
          console.log(
            `✅ Associated monitoring check ${monitoringCheckId} with service ${serviceId}`
          );
        }
      } catch (parseError) {
        console.error('Error parsing monitoring check data:', parseError);
      }
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
