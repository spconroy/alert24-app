import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';

const statusColors = {
  operational: '#10b981', // Green
  degraded: '#f59e0b', // Orange
  down: '#ef4444', // Red
  maintenance: '#3b82f6', // Blue
  up: '#10b981', // Green (for monitoring services)
};

const statusLabels = {
  operational: 'Operational',
  degraded: 'Degraded Performance',
  down: 'Outage',
  maintenance: 'Under Maintenance',
  up: 'Up',
};

export default function ServiceUptimeTimeline({ serviceId, days = 30, isPublic = false }) {
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (serviceId) {
      fetchTimelineData();
    }
  }, [serviceId, days]);

  const fetchTimelineData = async () => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = isPublic 
        ? `/api/services/${serviceId}/sla/public?days=${days}`
        : `/api/services/${serviceId}/sla?days=${days}`;
      
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch SLA data');
      }

      const data = await response.json();
      console.log('📊 ServiceUptimeTimeline data received:', {
        serviceId,
        days,
        timeline: data.timeline,
        timelineLength: data.timeline?.length,
      });
      setTimelineData(data);
    } catch (err) {
      console.error('Error fetching timeline data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = hours => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    } else if (hours < 24) {
      return `${Math.round(hours)}h`;
    } else {
      return `${Math.round(hours / 24)}d`;
    }
  };

  const formatDate = dateString => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderTimelineBar = () => {
    if (!timelineData?.timeline) return null;

    const totalPeriodHours = days * 24;
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return (
      <Box sx={{ position: 'relative', height: 8, mb: 1 }}>
        {/* Background bar */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '100%',
            backgroundColor: 'grey.200',
            borderRadius: 1,
          }}
        />

        {/* Status segments */}
        {timelineData.timeline.map((period, index) => {
          const periodStart = new Date(period.periodStart);
          const periodEnd = new Date(period.periodEnd);
          
          console.log(`📊 Period ${index}: status=${period.status}, color=${statusColors[period.status]}, duration=${period.durationHours}h`);

          // Calculate position and width as percentage of total period
          const startOffset =
            Math.max(0, (periodStart - startDate) / (now - startDate)) * 100;
          const endOffset =
            Math.min(100, (periodEnd - startDate) / (now - startDate)) * 100;
          const width = endOffset - startOffset;
          
          console.log(`📊 Period ${index} render: left=${startOffset.toFixed(1)}%, width=${width.toFixed(1)}%, bgColor=${statusColors[period.status]}, willRender=${width > 0}`);

          if (width <= 0) return null;

          return (
            <Tooltip
              key={index}
              title={
                <Box>
                  <Typography variant="body2" fontWeight="bold">
                    {statusLabels[period.status]}
                  </Typography>
                  <Typography variant="caption" display="block">
                    {formatDate(period.periodStart)} -{' '}
                    {formatDate(period.periodEnd)}
                  </Typography>
                  <Typography variant="caption" display="block">
                    Duration: {formatDuration(period.durationHours)}
                  </Typography>
                </Box>
              }
              arrow
              placement="top"
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: `${startOffset}%`,
                  width: `${width}%`,
                  height: '100%',
                  backgroundColor: statusColors[period.status],
                  cursor: 'pointer',
                  zIndex: index + 1, // Ensure later periods render on top
                  '&:hover': {
                    opacity: 0.8,
                  },
                }}
              />
            </Tooltip>
          );
        })}
      </Box>
    );
  };

  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={1} py={1}>
        <CircularProgress size={16} />
        <Typography variant="caption" color="text.secondary">
          Loading timeline...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ py: 0.5 }}>
        <Typography variant="caption">
          Failed to load timeline: {error}
        </Typography>
      </Alert>
    );
  }

  if (!timelineData?.timeline?.length) {
    return (
      <Box py={1}>
        <Typography variant="caption" color="text.secondary">
          No timeline data available
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Timeline visualization */}
      {renderTimelineBar()}

      {/* Period labels */}
      <Box display="flex" justifyContent="space-between" mt={0.5}>
        <Typography variant="caption" color="text.secondary">
          {days} days ago
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Today
        </Typography>
      </Box>
    </Box>
  );
}
