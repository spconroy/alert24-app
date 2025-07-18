import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { SupabaseClient } from '@/lib/db-supabase';

export const runtime = 'edge';

const db = new SupabaseClient();

export async function POST(req) {
  try {
    const session = await auth();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { checkId } = await req.json();

    if (!checkId) {
      return NextResponse.json(
        { error: 'Check ID is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the monitoring check
    const monitoringCheck = await db.getMonitoringCheckById(checkId);
    if (!monitoringCheck) {
      return NextResponse.json(
        { error: 'Monitoring check not found' },
        { status: 404 }
      );
    }

    console.log(`🧪 Testing recovery for check: ${monitoringCheck.name}`);

    // Find all services associated with this monitoring check
    const { data: associations, error: associationError } = await db.client
      .from('service_monitoring_checks')
      .select('service_id, failure_message')
      .eq('monitoring_check_id', checkId);

    if (associationError) {
      console.error(
        'Error fetching service associations for recovery:',
        associationError
      );
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!associations || associations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No service associations found for this check',
        associations: [],
      });
    }

    console.log(
      `Found ${associations.length} service(s) associated with check`
    );

    const results = [];

    // Process each associated service
    for (const association of associations) {
      const serviceId = association.service_id;

      // Get the service details
      const { data: service, error: serviceError } = await db.client
        .from('services')
        .select('*, status_pages(id)')
        .eq('id', serviceId)
        .single();

      if (serviceError || !service) {
        results.push({
          serviceId,
          status: 'error',
          message: 'Service not found',
        });
        continue;
      }

      // Only process if service is currently degraded or down
      if (!['degraded', 'down', 'maintenance'].includes(service.status)) {
        results.push({
          serviceId,
          serviceName: service.name,
          status: 'skipped',
          message: `Service is already ${service.status}, no recovery needed`,
        });
        continue;
      }

      // Check if there are any other ACTIVE monitoring checks that might be affecting this service
      const { data: otherFailingChecks, error: checksError } = await db.client
        .from('service_monitoring_checks')
        .select(
          `
          monitoring_checks!inner(
            id, 
            name, 
            status, 
            current_status
          )
        `
        )
        .eq('service_id', serviceId)
        .neq('monitoring_check_id', checkId) // Exclude the check we're testing
        .eq('monitoring_checks.status', 'active'); // Only active checks

      if (checksError) {
        results.push({
          serviceId,
          serviceName: service.name,
          status: 'error',
          message: 'Error checking other monitoring checks',
        });
        continue;
      }

      // Count how many active checks are currently failing for this service
      const activeFailingChecks = (otherFailingChecks || []).filter(
        assoc => assoc.monitoring_checks?.current_status === 'down'
      );

      console.log(
        `Service ${service.name}: ${activeFailingChecks.length} other active failing checks`
      );

      // If no other active checks are failing, recover the service
      if (activeFailingChecks.length === 0) {
        console.log(
          `🔄 Recovering service ${service.name} to operational status`
        );

        // Update service status to operational
        const { error: updateError } = await db.client
          .from('services')
          .update({
            status: 'operational',
            updated_at: new Date().toISOString(),
          })
          .eq('id', serviceId);

        if (updateError) {
          results.push({
            serviceId,
            serviceName: service.name,
            status: 'error',
            message: `Error updating service status: ${updateError.message}`,
          });
          continue;
        }

        // Create a recovery status update
        let statusUpdateCreated = false;
        if (service.status_pages?.id) {
          const recoveryMessage = association.failure_message?.trim()
            ? `${service.name} has been restored to normal operation.`
            : `${service.name} monitoring has been disabled and the service is now marked as operational.`;

          const { error: statusUpdateError } = await db.client
            .from('status_updates')
            .insert({
              status_page_id: service.status_pages.id,
              title: `${service.name} Restored`,
              message: recoveryMessage,
              status: 'operational',
              update_type: 'monitoring',
              created_by: user.id,
            });

          if (statusUpdateError) {
            console.error(
              'Error creating recovery status update:',
              statusUpdateError
            );
          } else {
            console.log(
              `✅ Created recovery status update for ${service.name}`
            );
            statusUpdateCreated = true;
          }
        }

        results.push({
          serviceId,
          serviceName: service.name,
          status: 'recovered',
          message: `Service recovered to operational status`,
          statusUpdateCreated,
          previousStatus: service.status,
        });

        console.log(`✅ Successfully recovered service ${service.name}`);
      } else {
        results.push({
          serviceId,
          serviceName: service.name,
          status: 'not_recovered',
          message: `Service has ${activeFailingChecks.length} other failing checks`,
          otherFailingChecks: activeFailingChecks.map(c => ({
            id: c.monitoring_checks.id,
            name: c.monitoring_checks.name,
            status: c.monitoring_checks.current_status,
          })),
        });
        console.log(
          `Service ${service.name} still has ${activeFailingChecks.length} other failing checks, not recovering`
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${associations.length} service associations`,
      checkId,
      checkName: monitoringCheck.name,
      results,
    });
  } catch (error) {
    console.error('Error in test recovery:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test recovery',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
