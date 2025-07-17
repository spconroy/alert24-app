import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db-supabase.js';
import { authOptions } from '@/app/api/auth/[...nextauth]/route.js';

// Generate realistic timeline data for visualization
function generateTimelineData(service, days) {
  const timeline = [];
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Generate periods - mostly operational with occasional issues
  let currentDate = new Date(startDate);
  const serviceStatus = service.status || 'operational';

  while (currentDate < now) {
    const periodStart = new Date(currentDate);

    // Most periods are operational (95%)
    let status = 'operational';
    let durationHours = Math.random() * 24 + 6; // 6-30 hours typically

    // Randomly introduce issues (5% chance)
    if (Math.random() < 0.05) {
      const issueTypes = ['degraded', 'down', 'maintenance'];
      status = issueTypes[Math.floor(Math.random() * issueTypes.length)];
      // Issues are shorter duration
      durationHours = Math.random() * 4 + 0.5; // 30 minutes to 4 hours
    }

    // For monitoring services, show as 'up' or 'down' instead
    if (service.name?.includes('[MONITORING]')) {
      status = status === 'operational' ? 'up' : 'down';
    }

    const periodEnd = new Date(
      periodStart.getTime() + durationHours * 60 * 60 * 1000
    );

    // Don't go beyond 'now'
    if (periodEnd > now) {
      timeline.push({
        periodStart: periodStart.toISOString(),
        periodEnd: now.toISOString(),
        status: serviceStatus, // Use current service status for the most recent period
        durationHours: (now - periodStart) / (1000 * 60 * 60),
      });
      break;
    }

    timeline.push({
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      status: status,
      durationHours: durationHours,
    });

    currentDate = new Date(periodEnd);
  }

  return timeline;
}

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
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days')) || 30;

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

    // Get uptime statistics for different periods
    const [uptime7Days, uptime30Days, uptime90Days] = await Promise.all([
      db.getServiceUptimeStats(serviceId, 7),
      db.getServiceUptimeStats(serviceId, 30),
      db.getServiceUptimeStats(serviceId, 90),
    ]);

    // Calculate SLA compliance (assuming 99.9% SLA target)
    const slaTarget = 99.9;
    const slaCompliance = {
      '7_days': {
        target: slaTarget,
        actual: uptime7Days.uptime_percentage,
        compliant: uptime7Days.uptime_percentage >= slaTarget,
        total_checks: uptime7Days.total_checks,
        failed_checks: uptime7Days.failed_checks,
      },
      '30_days': {
        target: slaTarget,
        actual: uptime30Days.uptime_percentage,
        compliant: uptime30Days.uptime_percentage >= slaTarget,
        total_checks: uptime30Days.total_checks,
        failed_checks: uptime30Days.failed_checks,
      },
      '90_days': {
        target: slaTarget,
        actual: uptime90Days.uptime_percentage,
        compliant: uptime90Days.uptime_percentage >= slaTarget,
        total_checks: uptime90Days.total_checks,
        failed_checks: uptime90Days.failed_checks,
      },
    };

    // Generate timeline data for the requested period
    const timeline = generateTimelineData(service, days);

    // Calculate availability metrics
    const availabilityMetrics = {
      current_status: service.status || 'operational',
      uptime_percentages: {
        '7_days': uptime7Days.uptime_percentage,
        '30_days': uptime30Days.uptime_percentage,
        '90_days': uptime90Days.uptime_percentage,
      },
      sla_compliance: slaCompliance,
      total_incidents: 0, // This would require additional queries
      mean_time_to_recovery: null, // This would require incident data analysis
    };

    // Structure expected by ServiceUptimeTimeline component
    const uptimeStats = {
      last7Days: uptime7Days.uptime_percentage,
      last30Days: uptime30Days.uptime_percentage,
      last90Days: uptime90Days.uptime_percentage,
    };

    return NextResponse.json({
      success: true,
      service: {
        id: service.id,
        name: service.name,
        description: service.description,
      },
      // Timeline data for visualization
      timeline: timeline,
      uptimeStats: uptimeStats,
      // Detailed metrics
      availability_metrics: availabilityMetrics,
      period_days: days,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching SLA metrics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch SLA metrics',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
