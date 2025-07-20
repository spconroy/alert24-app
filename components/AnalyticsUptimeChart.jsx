'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  CircularProgress,
  Paper,
  Chip,
  Tooltip,
} from '@mui/material';
import { TrendingUp, TrendingDown, Info } from '@mui/icons-material';
import LoadingTransition from './skeletons/LoadingTransition';
import ChartSkeleton from './skeletons/ChartSkeleton';

// Simple chart component using CSS
function UptimeChart({ data, title }) {
  const maxValue = Math.max(...data.map(d => d.value), 100);
  const minValue = Math.min(...data.map(d => d.value));

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Box sx={{ height: 200, position: 'relative', mt: 2 }}>
          <Box
            sx={{ display: 'flex', alignItems: 'end', height: '100%', gap: 1 }}
          >
            {data.map((point, index) => {
              const height =
                ((point.value - minValue) / (maxValue - minValue)) * 100;
              const color =
                point.value >= 99.5
                  ? '#4caf50'
                  : point.value >= 95
                    ? '#ff9800'
                    : '#f44336';

              return (
                <Tooltip
                  key={index}
                  title={`${point.label}: ${point.value.toFixed(2)}%`}
                  arrow
                >
                  <Box
                    sx={{
                      height: `${Math.max(height, 5)}%`,
                      backgroundColor: color,
                      flex: 1,
                      borderRadius: '2px 2px 0 0',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        opacity: 0.8,
                        transform: 'scaleY(1.05)',
                      },
                    }}
                  />
                </Tooltip>
              );
            })}
          </Box>

          {/* Y-axis labels */}
          <Box
            sx={{
              position: 'absolute',
              left: -40,
              top: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column-reverse',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {minValue.toFixed(1)}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {((maxValue + minValue) / 2).toFixed(1)}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {maxValue.toFixed(1)}%
            </Typography>
          </Box>
        </Box>

        {/* Legend */}
        <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                backgroundColor: '#4caf50',
                borderRadius: 1,
              }}
            />
            <Typography variant="caption">Excellent (≥99.5%)</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                backgroundColor: '#ff9800',
                borderRadius: 1,
              }}
            />
            <Typography variant="caption">Good (95-99.5%)</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                backgroundColor: '#f44336',
                borderRadius: 1,
              }}
            />
            <Typography variant="caption">Poor (&lt;95%)</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function UptimeHeatmap({ data }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Uptime Heatmap (Last 7 Days)
        </Typography>
        <Box sx={{ overflow: 'auto' }}>
          <Box sx={{ minWidth: 600, mt: 2 }}>
            {/* Hours header */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '80px repeat(24, 1fr)',
                gap: 1,
                mb: 1,
              }}
            >
              <Box />
              {hours.map(hour => (
                <Typography
                  key={hour}
                  variant="caption"
                  sx={{ textAlign: 'center', fontSize: '0.7rem' }}
                >
                  {hour}
                </Typography>
              ))}
            </Box>

            {/* Days and heatmap */}
            {days.map((day, dayIndex) => (
              <Box
                key={day}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '80px repeat(24, 1fr)',
                  gap: 1,
                  mb: 1,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '0.8rem',
                  }}
                >
                  {day}
                </Typography>
                {hours.map(hour => {
                  const uptimeValue = data[dayIndex]?.[hour] || 100;
                  const opacity = uptimeValue / 100;
                  const color =
                    uptimeValue >= 99.5
                      ? '#4caf50'
                      : uptimeValue >= 95
                        ? '#ff9800'
                        : '#f44336';

                  return (
                    <Tooltip
                      key={hour}
                      title={`${day} ${hour}:00 - ${uptimeValue.toFixed(1)}% uptime`}
                      arrow
                    >
                      <Box
                        sx={{
                          height: 20,
                          backgroundColor: color,
                          opacity: opacity,
                          borderRadius: 1,
                          cursor: 'pointer',
                          border: '1px solid rgba(0,0,0,0.1)',
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsUptimeChart({
  organizationId,
  dateRange,
  services,
}) {
  const [chartType, setChartType] = useState('timeline');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    timeline: [],
    heatmap: [],
    summary: {
      averageUptime: 0,
      trend: 0,
      bestDay: '',
      worstDay: '',
      totalDowntime: 0,
    },
  });

  useEffect(() => {
    if (organizationId) {
      loadUptimeData();
    }
  }, [organizationId, dateRange, services]);

  const loadUptimeData = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/analytics/uptime', {
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
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error loading uptime data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDowntime = minutes => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    if (minutes < 1440)
      return `${Math.round(minutes / 60)}h ${Math.round(minutes % 60)}m`;
    return `${Math.round(minutes / 1440)}d ${Math.round((minutes % 1440) / 60)}h`;
  };

  if (loading) {
    return (
      <LoadingTransition
        loading={loading}
        loaderProps={{
          type: 'progressive',
          complexity: 'medium',
          estimatedLoadTime: 3000
        }}
        loadingMessage="Loading uptime charts and analytics data"
        completedMessage="Uptime analytics loaded successfully"
      >
        <></>
      </LoadingTransition>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography
                variant="h6"
                component="div"
                fontSize="0.875rem"
                color="text.secondary"
              >
                Average Uptime
              </Typography>
              <Typography
                variant="h4"
                component="div"
                fontWeight="bold"
                color="success.main"
              >
                {data.summary.averageUptime.toFixed(2)}%
              </Typography>
              {data.summary.trend !== 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mt: 1,
                  }}
                >
                  {data.summary.trend > 0 ? (
                    <TrendingUp color="success" />
                  ) : (
                    <TrendingDown color="error" />
                  )}
                  <Typography
                    variant="caption"
                    color={
                      data.summary.trend > 0 ? 'success.main' : 'error.main'
                    }
                  >
                    {Math.abs(data.summary.trend).toFixed(2)}% vs previous
                    period
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography
                variant="h6"
                component="div"
                fontSize="0.875rem"
                color="text.secondary"
              >
                Total Downtime
              </Typography>
              <Typography
                variant="h4"
                component="div"
                fontWeight="bold"
                color="error.main"
              >
                {formatDowntime(data.summary.totalDowntime)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography
                variant="h6"
                component="div"
                fontSize="0.875rem"
                color="text.secondary"
              >
                Best Day
              </Typography>
              <Typography variant="h4" component="div" fontWeight="bold">
                {data.summary.bestDay || 'N/A'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography
                variant="h6"
                component="div"
                fontSize="0.875rem"
                color="text.secondary"
              >
                Worst Day
              </Typography>
              <Typography variant="h4" component="div" fontWeight="bold">
                {data.summary.worstDay || 'N/A'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Chart Type Selector */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Chart Type</InputLabel>
            <Select
              value={chartType}
              onChange={e => setChartType(e.target.value)}
              label="Chart Type"
            >
              <MenuItem value="timeline">Timeline View</MenuItem>
              <MenuItem value="heatmap">Heatmap View</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="body2" color="text.secondary">
            Uptime tracking over time with detailed visualization
          </Typography>
        </Box>
      </Paper>

      {/* Charts */}
      {chartType === 'timeline' ? (
        <UptimeChart data={data.timeline} title="Uptime Timeline" />
      ) : (
        <UptimeHeatmap data={data.heatmap} />
      )}

      {/* SLA Information */}
      <Paper
        sx={{
          p: 2,
          mt: 3,
          backgroundColor: 'info.light',
          color: 'info.contrastText',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Info />
          <Typography variant="body2">
            <strong>SLA Targets:</strong> 99.9% (8.76h downtime/year) | 99.95%
            (4.38h downtime/year) | 99.99% (52.6min downtime/year)
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
