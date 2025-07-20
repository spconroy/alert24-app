'use client';

import { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import LoadingTransition from './skeletons/LoadingTransition';
import AnalyticsCardSkeleton from './skeletons/AnalyticsCardSkeleton';
import {
  TrendingUp,
  TrendingDown,
  Timer,
  CheckCircle,
  Error,
  Speed,
  Assessment,
  Schedule,
  BugReport,
  InfoOutlined,
} from '@mui/icons-material';

function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  color = 'primary',
  loading = false,
  progress = null,
  tooltip,
}) {
  const IconComponent = icon;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconComponent color={color} />
            <Typography
              variant="h6"
              component="h3"
              fontSize="0.875rem"
              fontWeight="600"
            >
              {title}
            </Typography>
            {tooltip && (
              <Tooltip title={tooltip}>
                <IconButton size="small" sx={{ p: 0.5 }}>
                  <InfoOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          {trend && (
            <Chip
              size="small"
              icon={trend === 'up' ? <TrendingUp /> : <TrendingDown />}
              label={trendValue}
              color={trend === 'up' ? 'success' : 'error'}
              variant="outlined"
            />
          )}
        </Box>

        <LoadingTransition
          loading={loading}
          loaderProps={{ 
            variant: 'metric',
            type: 'skeleton',
            complexity: 'simple'
          }}
          preventLayoutShift={true}
          loadingMessage={`Loading ${title} metric`}
          completedMessage={`${title} metric loaded: ${value}`}
        >
          <Typography variant="h4" component="div" fontWeight="bold">
            {value}
          </Typography>
          {subtitle && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              {subtitle}
            </Typography>
          )}
          {progress !== null && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress
                variant="determinate"
                value={progress}
                color={
                  progress >= 95
                    ? 'success'
                    : progress >= 90
                      ? 'warning'
                      : 'error'
                }
                sx={{ height: 6, borderRadius: 3 }}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5, display: 'block' }}
              >
                {progress.toFixed(2)}%
              </Typography>
            </Box>
          )}
        </LoadingTransition>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsOverviewCards({
  organizationId,
  dateRange,
  services,
}) {
  const [metrics, setMetrics] = useState({
    overallUptime: { value: 0, loading: true },
    avgResponseTime: { value: 0, loading: true },
    totalIncidents: { value: 0, loading: true },
    mttr: { value: 0, loading: true },
    mtta: { value: 0, loading: true },
    healthScore: { value: 0, loading: true },
    checksPerformed: { value: 0, loading: true },
    failureRate: { value: 0, loading: true },
  });

  useEffect(() => {
    if (organizationId && services.length > 0) {
      loadMetrics();
    }
  }, [organizationId, dateRange, services]);

  const loadMetrics = async () => {
    try {
      // Set all metrics to loading
      setMetrics(prev => {
        const updated = {};
        Object.keys(prev).forEach(key => {
          updated[key] = { ...prev[key], loading: true };
        });
        return updated;
      });

      const response = await fetch('/api/analytics/overview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          dateRange,
          services,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMetrics({
          overallUptime: {
            value: data.overallUptime.toFixed(2) + '%',
            loading: false,
            progress: data.overallUptime,
            trend: data.uptimeTrend > 0 ? 'up' : 'down',
            trendValue: Math.abs(data.uptimeTrend).toFixed(2) + '%',
          },
          avgResponseTime: {
            value: data.avgResponseTime + 'ms',
            loading: false,
            trend: data.responseTimeTrend < 0 ? 'up' : 'down',
            trendValue: Math.abs(data.responseTimeTrend).toFixed(0) + 'ms',
          },
          totalIncidents: {
            value: data.totalIncidents,
            loading: false,
            subtitle: `${data.openIncidents} currently open`,
            trend: data.incidentTrend < 0 ? 'up' : 'down',
            trendValue: Math.abs(data.incidentTrend),
          },
          mttr: {
            value: formatDuration(data.mttr),
            loading: false,
            subtitle: 'Mean Time To Resolution',
            trend: data.mttrTrend < 0 ? 'up' : 'down',
            trendValue: formatDuration(Math.abs(data.mttrTrend)),
          },
          mtta: {
            value: formatDuration(data.mtta),
            loading: false,
            subtitle: 'Mean Time To Acknowledgment',
            trend: data.mttaTrend < 0 ? 'up' : 'down',
            trendValue: formatDuration(Math.abs(data.mttaTrend)),
          },
          healthScore: {
            value: data.healthScore,
            loading: false,
            progress: data.healthScore,
            subtitle: getHealthScoreLabel(data.healthScore),
          },
          checksPerformed: {
            value: data.checksPerformed.toLocaleString(),
            loading: false,
            subtitle: `${data.checksPerDay} avg per day`,
          },
          failureRate: {
            value: data.failureRate.toFixed(2) + '%',
            loading: false,
            progress: 100 - data.failureRate,
            trend: data.failureRateTrend < 0 ? 'up' : 'down',
            trendValue: Math.abs(data.failureRateTrend).toFixed(2) + '%',
          },
        });
      }
    } catch (error) {
      console.error('Error loading overview metrics:', error);
      // Set loading to false for all metrics
      setMetrics(prev => {
        const updated = {};
        Object.keys(prev).forEach(key => {
          updated[key] = { ...prev[key], loading: false, value: 'Error' };
        });
        return updated;
      });
    }
  };

  const formatDuration = minutes => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    if (minutes < 1440)
      return `${Math.round(minutes / 60)}h ${Math.round(minutes % 60)}m`;
    return `${Math.round(minutes / 1440)}d ${Math.round((minutes % 1440) / 60)}h`;
  };

  const getHealthScoreLabel = score => {
    if (score >= 95) return 'Excellent';
    if (score >= 90) return 'Good';
    if (score >= 80) return 'Fair';
    if (score >= 70) return 'Poor';
    return 'Critical';
  };

  return (
    <Grid container spacing={3} sx={{ p: 3 }}>
      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Overall Uptime"
          value={metrics.overallUptime.value}
          loading={metrics.overallUptime.loading}
          progress={metrics.overallUptime.progress}
          trend={metrics.overallUptime.trend}
          trendValue={metrics.overallUptime.trendValue}
          icon={CheckCircle}
          color="success"
          tooltip="Percentage of time services were operational"
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Avg Response Time"
          value={metrics.avgResponseTime.value}
          loading={metrics.avgResponseTime.loading}
          trend={metrics.avgResponseTime.trend}
          trendValue={metrics.avgResponseTime.trendValue}
          icon={Speed}
          color="info"
          tooltip="Average response time across all monitoring checks"
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Total Incidents"
          value={metrics.totalIncidents.value}
          subtitle={metrics.totalIncidents.subtitle}
          loading={metrics.totalIncidents.loading}
          trend={metrics.totalIncidents.trend}
          trendValue={metrics.totalIncidents.trendValue}
          icon={Error}
          color="error"
          tooltip="Total number of incidents in the selected period"
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Health Score"
          value={metrics.healthScore.value}
          subtitle={metrics.healthScore.subtitle}
          loading={metrics.healthScore.loading}
          progress={metrics.healthScore.progress}
          icon={Assessment}
          color="primary"
          tooltip="Overall health score based on uptime, performance, and incidents"
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="MTTR"
          value={metrics.mttr.value}
          subtitle={metrics.mttr.subtitle}
          loading={metrics.mttr.loading}
          trend={metrics.mttr.trend}
          trendValue={metrics.mttr.trendValue}
          icon={Timer}
          color="warning"
          tooltip="Average time to resolve incidents"
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="MTTA"
          value={metrics.mtta.value}
          subtitle={metrics.mtta.subtitle}
          loading={metrics.mtta.loading}
          trend={metrics.mtta.trend}
          trendValue={metrics.mtta.trendValue}
          icon={Schedule}
          color="warning"
          tooltip="Average time to acknowledge incidents"
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Checks Performed"
          value={metrics.checksPerformed.value}
          subtitle={metrics.checksPerformed.subtitle}
          loading={metrics.checksPerformed.loading}
          icon={BugReport}
          color="primary"
          tooltip="Total monitoring checks executed"
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Failure Rate"
          value={metrics.failureRate.value}
          loading={metrics.failureRate.loading}
          progress={metrics.failureRate.progress}
          trend={metrics.failureRate.trend}
          trendValue={metrics.failureRate.trendValue}
          icon={Error}
          color="error"
          tooltip="Percentage of monitoring checks that failed"
        />
      </Grid>
    </Grid>
  );
}
