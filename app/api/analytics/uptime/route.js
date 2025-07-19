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
        timeline: [],
        heatmap: [],
        summary: {
          averageUptime: 99.9,
          trend: 0,
          bestDay: '',
          worstDay: '',
          totalDowntime: 0
        }
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
        timeline: [],
        heatmap: [],
        summary: {
          averageUptime: 99.9,
          trend: 0,
          bestDay: '',
          worstDay: '',
          totalDowntime: 0
        }
      });
    }

    // Get monitoring statistics for the period
    const { data: stats, error: statsError } = await supabase
      .from('monitoring_statistics')
      .select('*')
      .in('monitoring_check_id', checkIds)
      .gte('date_hour', startDate.toISOString())
      .lte('date_hour', endDate.toISOString())
      .order('date_hour');

    if (statsError) {
      console.error('Error fetching monitoring statistics:', statsError);
    }

    // Get previous period statistics for trend calculation
    const { data: previousStats, error: previousStatsError } = await supabase
      .from('monitoring_statistics')
      .select('*')
      .in('monitoring_check_id', checkIds)
      .gte('date_hour', previousStartDate.toISOString())
      .lte('date_hour', previousEndDate.toISOString());

    if (previousStatsError) {
      console.error('Error fetching previous monitoring statistics:', previousStatsError);
    }

    // Process timeline data
    const timeline = processTimelineData(stats || [], dateRange);
    
    // Process heatmap data (for last 7 days only)
    const heatmap = dateRange === '7d' ? processHeatmapData(stats || []) : [];
    
    // Calculate summary metrics
    const summary = calculateSummary(stats || [], previousStats || [], timeline);

    return NextResponse.json({
      timeline,
      heatmap,
      summary
    });

  } catch (error) {
    console.error('Error in analytics uptime:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function processTimelineData(stats, dateRange) {
  if (!stats || stats.length === 0) return [];

  // Group stats by time period based on date range
  const groupedStats = new Map();

  stats.forEach(stat => {
    const date = new Date(stat.date_hour);
    let key;

    switch (dateRange) {
      case '1d':
        // Group by hour
        key = date.toISOString().slice(0, 13) + ':00:00.000Z';
        break;
      case '7d':
        // Group by day
        key = date.toISOString().slice(0, 10);
        break;
      case '30d':
      case '90d':
        // Group by day
        key = date.toISOString().slice(0, 10);
        break;
      default:
        key = date.toISOString().slice(0, 10);
    }

    if (!groupedStats.has(key)) {
      groupedStats.set(key, {
        totalChecks: 0,
        successfulChecks: 0,
        date: key
      });
    }

    const group = groupedStats.get(key);
    group.totalChecks += stat.total_checks || 0;
    group.successfulChecks += stat.successful_checks || 0;
  });

  // Convert to timeline format
  const timeline = Array.from(groupedStats.values()).map(group => {
    const uptimePercentage = group.totalChecks > 0 ? (group.successfulChecks / group.totalChecks) * 100 : 100;
    
    let label;
    if (dateRange === '1d') {
      label = new Date(group.date).getHours() + ':00';
    } else {
      label = new Date(group.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }

    return {
      label,
      value: uptimePercentage,
      date: group.date
    };
  });

  return timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function processHeatmapData(stats) {
  if (!stats || stats.length === 0) return Array(7).fill().map(() => Array(24).fill(100));

  const heatmapData = Array(7).fill().map(() => Array(24).fill(null));
  const now = new Date();

  stats.forEach(stat => {
    const date = new Date(stat.date_hour);
    const daysFromNow = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    const dayOfWeek = (now.getDay() - daysFromNow + 7) % 7;
    const hour = date.getHours();

    if (daysFromNow >= 0 && daysFromNow < 7) {
      const uptimePercentage = stat.total_checks > 0 ? (stat.successful_checks / stat.total_checks) * 100 : 100;
      
      if (heatmapData[dayOfWeek][hour] === null) {
        heatmapData[dayOfWeek][hour] = uptimePercentage;
      } else {
        // Average if multiple checks in same hour
        heatmapData[dayOfWeek][hour] = (heatmapData[dayOfWeek][hour] + uptimePercentage) / 2;
      }
    }
  });

  // Fill null values with 100% (no data = assumed up)
  return heatmapData.map(day => 
    day.map(hour => hour !== null ? hour : 100)
  );
}

function calculateSummary(currentStats, previousStats, timeline) {
  const totalChecks = currentStats.reduce((sum, stat) => sum + (stat.total_checks || 0), 0);
  const successfulChecks = currentStats.reduce((sum, stat) => sum + (stat.successful_checks || 0), 0);
  const averageUptime = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 99.9;

  // Calculate previous period uptime for trend
  const previousTotalChecks = previousStats.reduce((sum, stat) => sum + (stat.total_checks || 0), 0);
  const previousSuccessfulChecks = previousStats.reduce((sum, stat) => sum + (stat.successful_checks || 0), 0);
  const previousAverageUptime = previousTotalChecks > 0 ? (previousSuccessfulChecks / previousTotalChecks) * 100 : 99.9;
  const trend = averageUptime - previousAverageUptime;

  // Find best and worst days
  let bestDay = '';
  let worstDay = '';
  let bestUptime = -1;
  let worstUptime = 101;

  timeline.forEach(point => {
    if (point.value > bestUptime) {
      bestUptime = point.value;
      bestDay = point.label;
    }
    if (point.value < worstUptime) {
      worstUptime = point.value;
      worstDay = point.label;
    }
  });

  // Calculate total downtime in minutes
  const totalDowntime = currentStats.reduce((sum, stat) => {
    const uptimePercentage = stat.total_checks > 0 ? (stat.successful_checks / stat.total_checks) * 100 : 100;
    const downtimePercentage = 100 - uptimePercentage;
    // Assume each stat represents 1 hour, so downtime is percentage of 60 minutes
    return sum + (downtimePercentage / 100) * 60;
  }, 0);

  return {
    averageUptime,
    trend,
    bestDay,
    worstDay,
    totalDowntime
  };
}