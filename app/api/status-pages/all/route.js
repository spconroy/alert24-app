import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { db } from '@/lib/db-supabase.js';

export const runtime = 'edge';

export async function GET(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    // Get all status pages from organizations the user is a member of
    const statusPages = await db.getAllStatusPagesForUser(user.id);

    // For each status page, get service summary (simplified for now)
    const statusPagesWithServices = await Promise.all(
      statusPages.map(async statusPage => {
        try {
          // Get services for this status page
          const services = await db.select('services', '*', {
            status_page_id: statusPage.id,
          });

          // Filter out deleted services and monitoring check workarounds
          const activeServices = services.filter(
            service =>
              !service.deleted_at && !service.name?.startsWith('[MONITORING]')
          );

          // Calculate service status summary
          const serviceStatusCounts = {
            operational: 0,
            degraded: 0,
            down: 0,
            maintenance: 0,
          };

          activeServices.forEach(service => {
            const status = service.status || 'operational';
            if (serviceStatusCounts.hasOwnProperty(status)) {
              serviceStatusCounts[status]++;
            } else {
              serviceStatusCounts.operational++;
            }
          });

          // Determine overall status
          let overallStatus = 'operational';
          if (serviceStatusCounts.down > 0) {
            overallStatus = 'down';
          } else if (serviceStatusCounts.degraded > 0) {
            overallStatus = 'degraded';
          } else if (serviceStatusCounts.maintenance > 0) {
            overallStatus = 'maintenance';
          }

          return {
            ...statusPage,
            organization_name: statusPage.organizations?.name,
            organization_slug: statusPage.organizations?.slug,
            service_count: activeServices.length,
            service_status_counts: serviceStatusCounts,
            overall_status: overallStatus,
            services: activeServices,
          };
        } catch (error) {
          console.error(
            `Error processing status page ${statusPage.id}:`,
            error
          );
          return {
            ...statusPage,
            organization_name: statusPage.organizations?.name,
            organization_slug: statusPage.organizations?.slug,
            service_count: 0,
            service_status_counts: {
              operational: 0,
              degraded: 0,
              down: 0,
              maintenance: 0,
            },
            overall_status: 'unknown',
            services: [],
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      status_pages: statusPagesWithServices,
      count: statusPagesWithServices.length,
    });
  } catch (error) {
    console.error('Error fetching all status pages:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch status pages',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
