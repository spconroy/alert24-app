import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all services for the user's organizations
    const { data: organizations } = await db.client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id);

    if (!organizations?.length) {
      return NextResponse.json(
        { error: 'No organizations found' },
        { status: 404 }
      );
    }

    const orgIds = organizations.map(o => o.organization_id);

    // Get services from these organizations
    const { data: services } = await db.client
      .from('services')
      .select(
        'id, name, status, status_page_id, status_pages!inner(organization_id)'
      )
      .in('status_pages.organization_id', orgIds)
      .is('deleted_at', null)
      .limit(5);

    if (!services?.length) {
      return NextResponse.json({ error: 'No services found' }, { status: 404 });
    }

    // Test SLA calculation for each service
    const slaResults = [];
    for (const service of services) {
      try {
        // Test 7, 30, and 90 day calculations
        const [sla7, sla30, sla90] = await Promise.all([
          db.getServiceUptimeStats(service.id, 7),
          db.getServiceUptimeStats(service.id, 30),
          db.getServiceUptimeStats(service.id, 90),
        ]);

        // Check for status history data
        const { data: statusHistory } = await db.client
          .from('service_status_history')
          .select('status, started_at, ended_at')
          .eq('service_id', service.id)
          .order('started_at', { ascending: false })
          .limit(5);

        slaResults.push({
          service: {
            id: service.id,
            name: service.name,
            current_status: service.status,
          },
          uptime_stats: {
            '7_days': sla7,
            '30_days': sla30,
            '90_days': sla90,
          },
          status_history_count: statusHistory?.length || 0,
          recent_status_history: statusHistory || [],
        });
      } catch (error) {
        slaResults.push({
          service: {
            id: service.id,
            name: service.name,
            current_status: service.status,
          },
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'SLA calculation test completed',
      results: slaResults,
      test_info: {
        services_tested: services.length,
        user_id: user.id,
        organizations: orgIds.length,
      },
    });
  } catch (error) {
    console.error('Error testing SLA fix:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test SLA calculation',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

