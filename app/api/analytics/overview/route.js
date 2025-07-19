import { supabase } from '@/lib/db-supabase';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { organizationId, dateRange, services } = await request.json();

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    if (!services || services.length === 0) {
      return NextResponse.json({
        overallUptime: 99.9,
        avgResponseTime: 0,
        totalIncidents: 0,
        mttr: 0,
        mtta: 0,
        healthScore: 100,
        checksPerformed: 0,
        failureRate: 0,
        uptimeTrend: 0,
        responseTimeTrend: 0,
        incidentTrend: 0,
        mttrTrend: 0,
        mttaTrend: 0,
        failureRateTrend: 0,
        openIncidents: 0,
        checksPerDay: 0
      });
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    const previousStartDate = new Date();
    const previousEndDate = new Date();

    switch (dateRange) {
      case '1d':
        startDate.setDate(endDate.getDate() - 1);
        previousStartDate.setDate(endDate.getDate() - 2);
        previousEndDate.setDate(endDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        previousStartDate.setDate(endDate.getDate() - 14);
        previousEndDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        previousStartDate.setDate(endDate.getDate() - 60);
        previousEndDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        previousStartDate.setDate(endDate.getDate() - 180);
        previousEndDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
        previousStartDate.setDate(endDate.getDate() - 14);
        previousEndDate.setDate(endDate.getDate() - 7);
    }

    // Get monitoring checks for the selected services
    const { data: monitoringChecks, error: checksError } = await supabase
      .from('service_monitoring_checks')
      .select('monitoring_check_id')
      .in('service_id', services);

    if (checksError) {
      console.error('Error fetching monitoring checks:', checksError);
      return NextResponse.json({ error: 'Failed to fetch monitoring data' }, { status: 500 });
    }

    const checkIds = monitoringChecks.map(check => check.monitoring_check_id);

    if (checkIds.length === 0) {
      return NextResponse.json({
        overallUptime: 99.9,
        avgResponseTime: 0,
        totalIncidents: 0,
        mttr: 0,
        mtta: 0,
        healthScore: 100,
        checksPerformed: 0,
        failureRate: 0,
        uptimeTrend: 0,
        responseTimeTrend: 0,
        incidentTrend: 0,
        mttrTrend: 0,
        mttaTrend: 0,
        failureRateTrend: 0,
        openIncidents: 0,
        checksPerDay: 0
      });
    }

    // Calculate current period metrics
    const currentMetrics = await calculateMetrics(checkIds, services, startDate, endDate, organizationId);
    
    // Calculate previous period metrics for trends
    const previousMetrics = await calculateMetrics(checkIds, services, previousStartDate, previousEndDate, organizationId);

    // Calculate trends
    const uptimeTrend = currentMetrics.overallUptime - previousMetrics.overallUptime;
    const responseTimeTrend = currentMetrics.avgResponseTime - previousMetrics.avgResponseTime;
    const incidentTrend = currentMetrics.totalIncidents - previousMetrics.totalIncidents;
    const mttrTrend = currentMetrics.mttr - previousMetrics.mttr;
    const mttaTrend = currentMetrics.mtta - previousMetrics.mtta;
    const failureRateTrend = currentMetrics.failureRate - previousMetrics.failureRate;

    return NextResponse.json({
      ...currentMetrics,
      uptimeTrend,
      responseTimeTrend,
      incidentTrend,
      mttrTrend,
      mttaTrend,
      failureRateTrend
    });

  } catch (error) {
    console.error('Error in analytics overview:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function calculateMetrics(checkIds, services, startDate, endDate, organizationId) {
  // Get monitoring statistics for uptime and performance
  const { data: stats, error: statsError } = await supabase
    .from('monitoring_statistics')
    .select('*')
    .in('monitoring_check_id', checkIds)
    .gte('date_hour', startDate.toISOString())
    .lte('date_hour', endDate.toISOString());

  if (statsError) {
    console.error('Error fetching monitoring statistics:', statsError);
  }

  // Get check results for detailed analysis
  const { data: checkResults, error: resultsError } = await supabase
    .from('check_results')
    .select('*')
    .in('monitoring_check_id', checkIds)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (resultsError) {
    console.error('Error fetching check results:', resultsError);
  }

  // Get incidents for MTTR/MTTA calculation
  const { data: incidents, error: incidentsError } = await supabase
    .from('incidents')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (incidentsError) {
    console.error('Error fetching incidents:', incidentsError);
  }

  // Calculate metrics
  const totalChecks = checkResults?.length || 0;
  const successfulChecks = checkResults?.filter(r => r.is_successful).length || 0;
  const failedChecks = totalChecks - successfulChecks;

  const overallUptime = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 99.9;
  const avgResponseTime = totalChecks > 0 
    ? Math.round(checkResults.reduce((sum, r) => sum + (r.response_time || 0), 0) / totalChecks)
    : 0;

  const totalIncidents = incidents?.length || 0;
  const openIncidents = incidents?.filter(i => i.status !== 'resolved').length || 0;
  
  // Calculate MTTR (Mean Time To Resolution)
  const resolvedIncidents = incidents?.filter(i => i.resolved_at) || [];
  const mttr = resolvedIncidents.length > 0
    ? resolvedIncidents.reduce((sum, incident) => {
        const created = new Date(incident.created_at);
        const resolved = new Date(incident.resolved_at);
        return sum + (resolved - created) / (1000 * 60); // Convert to minutes
      }, 0) / resolvedIncidents.length
    : 0;

  // Calculate MTTA (Mean Time To Acknowledgment)
  const acknowledgedIncidents = incidents?.filter(i => i.acknowledged_at) || [];
  const mtta = acknowledgedIncidents.length > 0
    ? acknowledgedIncidents.reduce((sum, incident) => {
        const created = new Date(incident.created_at);
        const acknowledged = new Date(incident.acknowledged_at);
        return sum + (acknowledged - created) / (1000 * 60); // Convert to minutes
      }, 0) / acknowledgedIncidents.length
    : 0;

  const failureRate = totalChecks > 0 ? (failedChecks / totalChecks) * 100 : 0;

  // Calculate health score (weighted combination of metrics)
  const uptimeWeight = 0.4;
  const performanceWeight = 0.3;
  const incidentWeight = 0.3;

  const uptimeScore = overallUptime;
  const performanceScore = avgResponseTime > 0 ? Math.max(0, 100 - (avgResponseTime / 1000)) : 100;
  const incidentScore = Math.max(0, 100 - (totalIncidents * 10));

  const healthScore = Math.round(
    (uptimeScore * uptimeWeight) +
    (performanceScore * performanceWeight) +
    (incidentScore * incidentWeight)
  );

  // Calculate checks per day
  const daysDiff = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24));
  const checksPerDay = Math.round(totalChecks / daysDiff);

  return {
    overallUptime,
    avgResponseTime,
    totalIncidents,
    mttr,
    mtta,
    healthScore,
    checksPerformed: totalChecks,
    failureRate,
    openIncidents,
    checksPerDay
  };
}