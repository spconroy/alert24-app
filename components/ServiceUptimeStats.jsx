import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';

export default function ServiceUptimeStats({ serviceId, compact = false }) {
  const [uptimeData, setUptimeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (serviceId) {
      fetchUptimeData();
    }
  }, [serviceId]);

  const fetchUptimeData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/services/${serviceId}/sla?days=90`);
      if (!response.ok) {
        throw new Error('Failed to fetch SLA data');
      }

      const data = await response.json();
      setUptimeData(data);
    } catch (err) {
      console.error('Error fetching uptime data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getUptimeColor = percentage => {
    if (percentage >= 99.9) return 'success';
    if (percentage >= 99.0) return 'warning';
    return 'error';
  };

  const formatUptime = percentage => {
    return `${percentage.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={1} py={1}>
        <CircularProgress size={16} />
        <Typography variant="caption" color="text.secondary">
          Loading uptime stats...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ py: 0.5 }}>
        <Typography variant="caption">
          Failed to load uptime: {error}
        </Typography>
      </Alert>
    );
  }

  if (!uptimeData?.uptimeStats) {
    return (
      <Typography variant="caption" color="text.secondary">
        No uptime data available
      </Typography>
    );
  }

  const { uptimeStats } = uptimeData;

  if (compact) {
    // Compact version for service cards
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <Chip
          label={formatUptime(uptimeStats.last30Days)}
          color={getUptimeColor(uptimeStats.last30Days)}
          size="small"
          variant="outlined"
        />
        <Typography variant="caption" color="text.secondary">
          30 days
        </Typography>
      </Box>
    );
  }

  // Full version for detailed views
  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Uptime Statistics
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <Box textAlign="center">
            <Typography
              variant="h4"
              color={getUptimeColor(uptimeStats.last24Hours) + '.main'}
              fontWeight="bold"
            >
              {formatUptime(uptimeStats.last24Hours)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Last 24 Hours
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={6} sm={3}>
          <Box textAlign="center">
            <Typography
              variant="h4"
              color={getUptimeColor(uptimeStats.last7Days) + '.main'}
              fontWeight="bold"
            >
              {formatUptime(uptimeStats.last7Days)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Last 7 Days
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={6} sm={3}>
          <Box textAlign="center">
            <Typography
              variant="h4"
              color={getUptimeColor(uptimeStats.last30Days) + '.main'}
              fontWeight="bold"
            >
              {formatUptime(uptimeStats.last30Days)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Last 30 Days
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={6} sm={3}>
          <Box textAlign="center">
            <Typography
              variant="h4"
              color={getUptimeColor(uptimeStats.last90Days) + '.main'}
              fontWeight="bold"
            >
              {formatUptime(uptimeStats.last90Days)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Last 90 Days
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* Incident summary */}
      {uptimeData.incidents && Object.keys(uptimeData.incidents).length > 0 && (
        <Box mt={3}>
          <Typography variant="subtitle2" gutterBottom>
            Recent Issues (Last 30 Days)
          </Typography>
          <Grid container spacing={1}>
            {Object.entries(uptimeData.incidents).map(([status, data]) => (
              <Grid item xs={6} key={status}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                  <Typography variant="h6" color="error.main">
                    {data.count}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                  >
                    {status === 'down' ? 'Outages' : 'Degraded Periods'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {Math.round(data.totalMinutes)} minutes total
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Paper>
  );
}
