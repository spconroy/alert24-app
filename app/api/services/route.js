import { SupabaseClient } from '@/lib/db-supabase';
import { SessionManager } from '@/lib/session-manager';
import { NextResponse } from 'next/server';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusPageId =
      searchParams.get('status_page_id') || searchParams.get('statusPageId');
    const organizationId =
      searchParams.get('organization_id') || searchParams.get('organizationId');

    if (statusPageId) {
      try {
        // Try to get services with monitoring checks using the junction table
        const { data: services, error } = await db.client
          .from('services')
          .select('*')
          .eq('status_page_id', statusPageId)
          .is('deleted_at', null)
          .not('name', 'ilike', '[[]MONITORING]%')
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true });

        if (error) throw error;

        // Manually fetch monitoring checks for each service
        const servicesWithMonitoring = await Promise.all(
          services.map(async service => {
            try {
              // First, check if the service_monitoring_checks table exists
              let associations = [];
              try {
                const { data: assocData, error: assocError } = await db.client
                  .from('service_monitoring_checks')
                  .select('*')
                  .eq('service_id', service.id);

                if (assocError) {
                  console.warn(
                    `Table service_monitoring_checks may not exist:`,
                    assocError.message
                  );
                  // Try alternative approach using the monitoring_checks table directly
                  const { data: directChecks, error: directError } =
                    await db.client
                      .from('monitoring_checks')
                      .select('*')
                      .eq('linked_service_id', service.id);

                  if (directError) {
                    console.warn(
                      `Error fetching direct monitoring checks:`,
                      directError.message
                    );
                    return { ...service, monitoring_checks: [] };
                  }

                  return {
                    ...service,
                    monitoring_checks: directChecks || [],
                  };
                } else {
                  associations = assocData || [];
                }
              } catch (tableError) {
                console.warn(
                  `Junction table error for service ${service.id}:`,
                  tableError
                );
                return { ...service, monitoring_checks: [] };
              }

              // Get monitoring checks for this service
              const monitoringChecks = [];
              for (const assoc of associations) {
                try {
                  const { data: check, error: checkError } = await db.client
                    .from('monitoring_checks')
                    .select('*')
                    .eq('id', assoc.monitoring_check_id)
                    .single();

                  if (checkError) {
                    console.warn(
                      `Error fetching monitoring check ${assoc.monitoring_check_id}:`,
                      checkError
                    );
                    continue;
                  }

                  monitoringChecks.push({
                    ...check,
                    failure_threshold: assoc.failure_threshold_minutes,
                    failure_message: assoc.failure_message,
                    // Apply proper current_status transformation for disabled checks
                    current_status:
                      check.status !== 'active'
                        ? 'inactive'
                        : !check.last_check_at && check.status === 'active'
                          ? 'pending'
                          : check.current_status || 'unknown',
                  });
                } catch (checkErr) {
                  console.warn(
                    `Error processing check ${assoc.monitoring_check_id}:`,
                    checkErr
                  );
                }
              }

              return {
                ...service,
                monitoring_checks: monitoringChecks,
              };
            } catch (err) {
              console.warn(
                `Error processing monitoring for service ${service.id}:`,
                err
              );
              return { ...service, monitoring_checks: [] };
            }
          })
        );

        return NextResponse.json({
          success: true,
          services: servicesWithMonitoring,
        });
      } catch (error) {
        console.error('Error in services API:', error);

        // Fallback: return services without monitoring checks
        const { data: services, error: fallbackError } = await db.client
          .from('services')
          .select('*')
          .eq('status_page_id', statusPageId)
          .is('deleted_at', null)
          .not('name', 'ilike', '[[]MONITORING]%')
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true });

        if (fallbackError) throw fallbackError;

        // Add empty monitoring_checks array to each service
        const servicesWithEmptyMonitoring = services.map(service => ({
          ...service,
          monitoring_checks: [],
        }));

        return NextResponse.json({
          success: true,
          services: servicesWithEmptyMonitoring,
        });
      }
    }

    if (organizationId) {
      // Get services for an organization (through status pages, excluding monitoring check workarounds)
      console.log('Fetching services for organization:', organizationId);
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
        .not('name', 'ilike', '[[]MONITORING]%')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching services for organization:', error);
        throw error;
      }
      console.log('Found services for organization:', services?.length || 0);
      return NextResponse.json({ success: true, services });
    }

    // Get all services - require authentication for this
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
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
    return NextResponse.json({ success: true, services });
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
