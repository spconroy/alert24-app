export const runtime = 'edge';

import { db } from '@/lib/db-supabase';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { organizationId, dateRange, services } = await request.json();

    if (!organizationId || !services || services.length === 0) {
      return NextResponse.json({
        timeline: [],
        summary: {
          avgResponseTime: 0,
          trend: 0,
          fastestResponse: 0,
          slowestResponse: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
        },
      });
    }

    // Get monitoring checks for the selected services
    const { data: monitoringChecks } = await supabase
      .from('service_monitoring_checks')
      .select('monitoring_check_id')
      .in('service_id', services);

    const checkIds =
      monitoringChecks?.map(check => check.monitoring_check_id) || [];

    if (checkIds.length === 0) {
      return NextResponse.json({
        timeline: [],
        summary: {
          avgResponseTime: 0,
          trend: 0,
          fastestResponse: 0,
          slowestResponse: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
        },
      });
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

    // Get check results for response time analysis
    const { data: checkResults } = await supabase
      .from('check_results')
      .select('response_time, created_at, is_successful')
      .in('monitoring_check_id', checkIds)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .not('response_time', 'is', null);

    // Process timeline data
    const timeline = processResponseTimeTimeline(checkResults || [], dateRange);

    // Calculate summary metrics
    const summary = calculateResponseTimeSummary(checkResults || []);

    return NextResponse.json({ timeline, summary });
  } catch (error) {
    console.error('Error in analytics performance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function processResponseTimeTimeline(results, dateRange) {
  if (!results || results.length === 0) return [];

  const groupedResults = new Map();

  results.forEach(result => {
    if (!result.response_time) return;

    const date = new Date(result.created_at);
    let key;

    switch (dateRange) {
      case '1d':
        key = date.toISOString().slice(0, 13) + ':00:00.000Z';
        break;
      case '7d':
        key = date.toISOString().slice(0, 10);
        break;
      case '30d':
      case '90d':
        key = date.toISOString().slice(0, 10);
        break;
      default:
        key = date.toISOString().slice(0, 10);
    }

    if (!groupedResults.has(key)) {
      groupedResults.set(key, { responseTimes: [], date: key });
    }

    groupedResults.get(key).responseTimes.push(result.response_time);
  });

  const timeline = Array.from(groupedResults.values()).map(group => {
    const avgResponseTime = Math.round(
      group.responseTimes.reduce((sum, rt) => sum + rt, 0) /
        group.responseTimes.length
    );

    let label;
    if (dateRange === '1d') {
      label = new Date(group.date).getHours() + ':00';
    } else {
      label = new Date(group.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }

    return {
      label,
      value: avgResponseTime,
      date: group.date,
    };
  });

  return timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function calculateResponseTimeSummary(results) {
  if (!results || results.length === 0) {
    return {
      avgResponseTime: 0,
      trend: 0,
      fastestResponse: 0,
      slowestResponse: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
    };
  }

  const responseTimes = results
    .filter(r => r.response_time && r.is_successful)
    .map(r => r.response_time)
    .sort((a, b) => a - b);

  if (responseTimes.length === 0) {
    return {
      avgResponseTime: 0,
      trend: 0,
      fastestResponse: 0,
      slowestResponse: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
    };
  }

  const avgResponseTime = Math.round(
    responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length
  );

  const fastestResponse = responseTimes[0];
  const slowestResponse = responseTimes[responseTimes.length - 1];

  const p95Index = Math.floor(responseTimes.length * 0.95);
  const p99Index = Math.floor(responseTimes.length * 0.99);
  const p95ResponseTime = responseTimes[p95Index] || 0;
  const p99ResponseTime = responseTimes[p99Index] || 0;

  // Calculate trend (simplified - compare first half vs second half)
  const midPoint = Math.floor(responseTimes.length / 2);
  const firstHalfAvg =
    responseTimes.slice(0, midPoint).reduce((sum, rt) => sum + rt, 0) /
    midPoint;
  const secondHalfAvg =
    responseTimes.slice(midPoint).reduce((sum, rt) => sum + rt, 0) /
    (responseTimes.length - midPoint);
  const trend = Math.round(secondHalfAvg - firstHalfAvg);

  return {
    avgResponseTime,
    trend,
    fastestResponse,
    slowestResponse,
    p95ResponseTime,
    p99ResponseTime,
  };
}
