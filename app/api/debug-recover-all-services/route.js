import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

export const runtime = 'edge';

const db = new SupabaseClient();

export async function POST(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { statusPageId } = await req.json();

    if (!statusPageId) {
      return NextResponse.json(
        { error: 'Status page ID is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log(
      `🔄 Debug: Recovering all services for status page ${statusPageId}`
    );

    // Get all services for the status page
    const { data: services, error: servicesError } = await db.client
      .from('services')
      .select('*')
      .eq('status_page_id', statusPageId)
      .is('deleted_at', null);

    if (servicesError) {
      console.error('Error fetching services:', servicesError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!services || services.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No services found for this status page',
        services: [],
      });
    }

    console.log(`Found ${services.length} services to recover`);

    const results = [];
    let recoveredCount = 0;
    let statusUpdatesCreated = 0;

    // Process each service
    for (const service of services) {
      try {
        // Only process if service is not already operational
        if (service.status === 'operational') {
          results.push({
            serviceId: service.id,
            serviceName: service.name,
            status: 'skipped',
            message: 'Already operational',
            previousStatus: service.status,
          });
          continue;
        }

        console.log(
          `🔄 Recovering service ${service.name} from ${service.status} to operational`
        );

        // Update service status to operational
        const { error: updateError } = await db.client
          .from('services')
          .update({
            status: 'operational',
            updated_at: new Date().toISOString(),
          })
          .eq('id', service.id);

        if (updateError) {
          results.push({
            serviceId: service.id,
            serviceName: service.name,
            status: 'error',
            message: `Error updating service: ${updateError.message}`,
            previousStatus: service.status,
          });
          continue;
        }

        recoveredCount++;

        // Create a recovery status update
        let statusUpdateCreated = false;
        const recoveryMessage = `${service.name} has been manually restored to operational status via debug tools.`;

        const { error: statusUpdateError } = await db.client
          .from('status_updates')
          .insert({
            status_page_id: statusPageId,
            title: `${service.name} Restored`,
            message: recoveryMessage,
            status: 'operational',
            update_type: 'general',
            created_by: user.id,
          });

        if (statusUpdateError) {
          console.error(
            'Error creating recovery status update:',
            statusUpdateError
          );
        } else {
          console.log(`✅ Created recovery status update for ${service.name}`);
          statusUpdateCreated = true;
          statusUpdatesCreated++;
        }

        results.push({
          serviceId: service.id,
          serviceName: service.name,
          status: 'recovered',
          message: `Service recovered to operational status`,
          statusUpdateCreated,
          previousStatus: service.status,
        });

        console.log(`✅ Successfully recovered service ${service.name}`);
      } catch (serviceError) {
        console.error(
          `Error processing service ${service.name}:`,
          serviceError
        );
        results.push({
          serviceId: service.id,
          serviceName: service.name,
          status: 'error',
          message: `Processing error: ${serviceError.message}`,
          previousStatus: service.status,
        });
      }
    }

    console.log(
      `🎉 Debug recovery complete: ${recoveredCount} services recovered, ${statusUpdatesCreated} status updates created`
    );

    return NextResponse.json({
      success: true,
      message: `Debug recovery completed: ${recoveredCount} services recovered`,
      statusPageId,
      summary: {
        totalServices: services.length,
        servicesRecovered: recoveredCount,
        statusUpdatesCreated,
        servicesSkipped: results.filter(r => r.status === 'skipped').length,
        errors: results.filter(r => r.status === 'error').length,
      },
      results,
    });
  } catch (error) {
    console.error('Error in debug service recovery:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to recover services',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
