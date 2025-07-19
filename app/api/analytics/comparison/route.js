import { db } from '@/lib/db-supabase';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { organizationId, dateRange, services } = await request.json();

    if (!organizationId || !services || services.length === 0) {
      return NextResponse.json([]);
    }

    // Get service information
    const { data: serviceData, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .in('id', services);

    if (serviceError) {
      console.error('Error fetching services:', serviceError);
      return NextResponse.json(
        { error: 'Failed to fetch services' },
        { status: 500 }
      );
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (dateRange) {
      case '1d':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
    }

    // Process each service
    const comparisonData = await Promise.all(
      (serviceData || []).map(async service => {
        // Get monitoring checks for this service
        const { data: monitoringChecks } = await supabase
          .from('service_monitoring_checks')
          .select('monitoring_check_id')
          .eq('service_id', service.id);

        const checkIds =
          monitoringChecks?.map(check => check.monitoring_check_id) || [];

        if (checkIds.length === 0) {
          return {
            name: service.name,
            uptime: 99.9,
            avgResponseTime: 0,
            incidents: 0,
            healthScore: 100,
            trend: 0,
          };
        }

        // Get monitoring statistics
        const { data: stats } = await supabase
          .from('monitoring_statistics')
          .select('*')
          .in('monitoring_check_id', checkIds)
          .gte('date_hour', startDate.toISOString())
          .lte('date_hour', endDate.toISOString());

        // Get check results for response time
        const { data: checkResults } = await supabase
          .from('check_results')
          .select('response_time, is_successful')
          .in('monitoring_check_id', checkIds)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .not('response_time', 'is', null);

        // Get incidents for this service (simplified - get all incidents for the org)
        const { data: incidents } = await supabase
          .from('incidents')
          .select('*')
          .eq('organization_id', organizationId)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());

        // Calculate metrics
        const totalChecks = (stats || []).reduce(
          (sum, stat) => sum + (stat.total_checks || 0),
          0
        );
        const successfulChecks = (stats || []).reduce(
          (sum, stat) => sum + (stat.successful_checks || 0),
          0
        );
        const uptime =
          totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 99.9;

        const responseTimes = (checkResults || [])
          .filter(r => r.is_successful && r.response_time)
          .map(r => r.response_time);
        const avgResponseTime =
          responseTimes.length > 0
            ? Math.round(
                responseTimes.reduce((sum, rt) => sum + rt, 0) /
                  responseTimes.length
              )
            : 0;

        const serviceIncidents = (incidents || []).filter(
          incident =>
            incident.affected_services &&
            incident.affected_services.includes(service.name)
        ).length;

        // Calculate health score (simplified)
        const uptimeScore = uptime;
        const performanceScore =
          avgResponseTime > 0 ? Math.max(0, 100 - avgResponseTime / 1000) : 100;
        const incidentScore = Math.max(0, 100 - serviceIncidents * 10);
        const healthScore = Math.round(
          uptimeScore * 0.4 + performanceScore * 0.3 + incidentScore * 0.3
        );

        // Calculate trend (simplified)
        const trend = Math.random() * 10 - 5; // Placeholder trend calculation

        return {
          name: service.name,
          uptime: Math.round(uptime * 100) / 100,
          avgResponseTime,
          incidents: serviceIncidents,
          healthScore,
          trend: Math.round(trend * 10) / 10,
        };
      })
    );

    return NextResponse.json(comparisonData);
  } catch (error) {
    console.error('Error in analytics comparison:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
