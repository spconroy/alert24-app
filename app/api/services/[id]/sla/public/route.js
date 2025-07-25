import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

// Get real timeline data from service_status_history - PUBLIC VERSION
async function getTimelineData(serviceId, days) {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get real status history from database using admin client to bypass RLS
    const client = db.adminClient || db.client;
    const { data: statusHistory, error } = await client
      .from('service_status_history')
      .select('status, started_at, ended_at')
      .eq('service_id', serviceId)
      .gte('started_at', startDate.toISOString())
      .order('started_at', { ascending: true });

    if (error) {
      console.warn('Error fetching status history:', error);
      return [];
    }

    if (!statusHistory || statusHistory.length === 0) {
      // If no history, show current period as operational
      return [
        {
          periodStart: startDate.toISOString(),
          periodEnd: new Date().toISOString(),
          status: 'operational',
          durationHours: days * 24,
        },
      ];
    }

    // Convert status history to timeline format
    const timeline = statusHistory.map(period => {
      const periodStart = new Date(period.started_at);
      const periodEnd = period.ended_at
        ? new Date(period.ended_at)
        : new Date();
      const durationHours = (periodEnd - periodStart) / (1000 * 60 * 60);

      return {
        periodStart: period.started_at,
        periodEnd: period.ended_at || new Date().toISOString(),
        status: period.status,
        durationHours: durationHours,
      };
    });

    return timeline;
  } catch (error) {
    console.warn('Error in getTimelineData:', error);
    return [];
  }
}

export async function GET(request, { params }) {
  try {
    const { id: serviceId } = params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days')) || 30;

    // Get service to verify it exists and is public
    const service = await db.getServiceById(serviceId);
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Verify the service belongs to a public status page
    const { data: statusPage, error: statusPageError } = await db.client
      .from('status_pages')
      .select('is_public')
      .eq('id', service.status_page_id)
      .single();

    if (statusPageError || !statusPage || !statusPage.is_public) {
      return NextResponse.json(
        { error: 'Service not found on public status page' },
        { status: 404 }
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
    const timeline = await getTimelineData(serviceId, days);

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

    console.log('📊 PUBLIC SLA API - Timeline data for service:', serviceId, {
      timelineLength: timeline?.length,
      timeline: timeline,
    });

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
    console.error('Error fetching public SLA metrics:', error);
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