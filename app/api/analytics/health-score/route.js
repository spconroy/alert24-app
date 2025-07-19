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
        overallScore: 100,
        factors: [],
        recommendations: []
      });
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (dateRange) {
      case '1d': startDate.setDate(endDate.getDate() - 1); break;
      case '7d': startDate.setDate(endDate.getDate() - 7); break;
      case '30d': startDate.setDate(endDate.getDate() - 30); break;
      case '90d': startDate.setDate(endDate.getDate() - 90); break;
      default: startDate.setDate(endDate.getDate() - 7);
    }

    // Get monitoring checks for selected services
    const { data: monitoringChecks } = await supabase
      .from('service_monitoring_checks')
      .select('monitoring_check_id')
      .in('service_id', services);

    const checkIds = monitoringChecks?.map(check => check.monitoring_check_id) || [];

    // Get monitoring data
    const { data: stats } = await supabase
      .from('monitoring_statistics')
      .select('*')
      .in('monitoring_check_id', checkIds)
      .gte('date_hour', startDate.toISOString())
      .lte('date_hour', endDate.toISOString());

    // Get check results
    const { data: checkResults } = await supabase
      .from('check_results')
      .select('*')
      .in('monitoring_check_id', checkIds)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    // Get incidents
    const { data: incidents } = await supabase
      .from('incidents')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    // Get alerts
    const { data: alerts } = await supabase
      .from('monitoring_alerts')
      .select('*')
      .in('monitoring_check_id', checkIds)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    // Calculate health factors
    const factors = calculateHealthFactors(stats || [], checkResults || [], incidents || [], alerts || []);
    
    // Calculate overall score
    const overallScore = calculateOverallScore(factors);
    
    // Generate recommendations
    const recommendations = generateRecommendations(factors);

    return NextResponse.json({
      overallScore,
      factors,
      recommendations
    });

  } catch (error) {
    console.error('Error in analytics health score:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function calculateHealthFactors(stats, checkResults, incidents, alerts) {
  const factors = [];

  // Uptime Factor
  const totalChecks = stats.reduce((sum, stat) => sum + (stat.total_checks || 0), 0);
  const successfulChecks = stats.reduce((sum, stat) => sum + (stat.successful_checks || 0), 0);
  const uptimePercentage = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 100;
  const uptimeScore = Math.round(uptimePercentage);

  factors.push({
    type: 'uptime',
    name: 'Uptime Reliability',
    score: uptimeScore,
    description: `${uptimePercentage.toFixed(2)}% uptime across all services`
  });

  // Performance Factor
  const responseTimes = checkResults
    .filter(r => r.is_successful && r.response_time)
    .map(r => r.response_time);
  
  let performanceScore = 100;
  if (responseTimes.length > 0) {
    const avgResponseTime = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
    performanceScore = Math.max(0, Math.round(100 - (avgResponseTime / 2000) * 100)); // Scale based on 2s max
  }

  factors.push({
    type: 'performance',
    name: 'Response Performance',
    score: performanceScore,
    description: `Average response time: ${responseTimes.length > 0 ? Math.round(responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length) : 0}ms`
  });

  // Incident Factor
  const totalIncidents = incidents.length;
  const openIncidents = incidents.filter(i => i.status !== 'resolved').length;
  const incidentScore = Math.max(0, Math.round(100 - (totalIncidents * 5) - (openIncidents * 10)));

  factors.push({
    type: 'incidents',
    name: 'Incident Management',
    score: incidentScore,
    description: `${totalIncidents} incidents total, ${openIncidents} currently open`
  });

  // Alert Factor
  const totalAlerts = alerts.length;
  const activeAlerts = alerts.filter(a => a.is_active).length;
  const alertScore = Math.max(0, Math.round(100 - (totalAlerts * 3) - (activeAlerts * 5)));

  factors.push({
    type: 'alerts',
    name: 'Alert Activity',
    score: alertScore,
    description: `${totalAlerts} alerts generated, ${activeAlerts} currently active`
  });

  return factors;
}

function calculateOverallScore(factors) {
  if (factors.length === 0) return 100;
  
  // Weighted average of all factors
  const weights = {
    uptime: 0.4,
    performance: 0.3,
    incidents: 0.2,
    alerts: 0.1
  };

  let totalScore = 0;
  let totalWeight = 0;

  factors.forEach(factor => {
    const weight = weights[factor.type] || 0.25;
    totalScore += factor.score * weight;
    totalWeight += weight;
  });

  return Math.round(totalScore / totalWeight);
}

function generateRecommendations(factors) {
  const recommendations = [];

  factors.forEach(factor => {
    if (factor.score < 80) {
      switch (factor.type) {
        case 'uptime':
          recommendations.push({
            title: 'Improve Service Reliability',
            description: 'Consider implementing redundancy, load balancing, or reviewing infrastructure stability.',
            impact: Math.round((80 - factor.score) * 0.4) // Weighted by uptime importance
          });
          break;
        case 'performance':
          recommendations.push({
            title: 'Optimize Response Times',
            description: 'Review API performance, database queries, or consider CDN implementation.',
            impact: Math.round((80 - factor.score) * 0.3) // Weighted by performance importance
          });
          break;
        case 'incidents':
          recommendations.push({
            title: 'Enhance Incident Prevention',
            description: 'Implement better monitoring, alerting, and preventive measures to reduce incidents.',
            impact: Math.round((80 - factor.score) * 0.2) // Weighted by incident importance
          });
          break;
        case 'alerts':
          recommendations.push({
            title: 'Optimize Alert Configuration',
            description: 'Review alert thresholds to reduce noise while maintaining effective monitoring.',
            impact: Math.round((80 - factor.score) * 0.1) // Weighted by alert importance
          });
          break;
      }
    }
  });

  return recommendations;
}