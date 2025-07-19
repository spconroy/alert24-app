'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  CircularProgress,
  Paper,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  BugReport,
  Schedule,
  Timer,
  TrendingUp,
  TrendingDown,
} from '@mui/icons-material';

export default function AnalyticsIncidentMetrics({
  organizationId,
  dateRange,
  services,
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    summary: {
      totalIncidents: 0,
      openIncidents: 0,
      mttr: 0,
      mtta: 0,
      severity: { critical: 0, high: 0, medium: 0, low: 0 },
    },
    recentIncidents: [],
    timeline: [],
  });

  useEffect(() => {
    if (organizationId) {
      loadIncidentData();
    }
  }, [organizationId, dateRange, services]);

  const loadIncidentData = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/analytics/incidents', {
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
      console.error('Error loading incident data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = minutes => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    if (minutes < 1440)
      return `${Math.round(minutes / 60)}h ${Math.round(minutes % 60)}m`;
    return `${Math.round(minutes / 1440)}d ${Math.round((minutes % 1440) / 60)}h`;
  };

  const getSeverityColor = severity => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading incident data...
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
              >
                <BugReport color="error" />
                <Typography
                  variant="h6"
                  fontSize="0.875rem"
                  color="text.secondary"
                >
                  Total Incidents
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {data.summary.totalIncidents}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {data.summary.openIncidents} currently open
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
              >
                <Timer color="warning" />
                <Typography
                  variant="h6"
                  fontSize="0.875rem"
                  color="text.secondary"
                >
                  MTTR
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {formatDuration(data.summary.mttr)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Mean Time To Resolution
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
              >
                <Schedule color="info" />
                <Typography
                  variant="h6"
                  fontSize="0.875rem"
                  color="text.secondary"
                >
                  MTTA
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {formatDuration(data.summary.mtta)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Mean Time To Acknowledgment
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography
                variant="h6"
                fontSize="0.875rem"
                color="text.secondary"
                gutterBottom
              >
                By Severity
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                <Chip
                  label={`Critical: ${data.summary.severity.critical}`}
                  color="error"
                  size="small"
                />
                <Chip
                  label={`High: ${data.summary.severity.high}`}
                  color="warning"
                  size="small"
                />
                <Chip
                  label={`Medium: ${data.summary.severity.medium}`}
                  color="info"
                  size="small"
                />
                <Chip
                  label={`Low: ${data.summary.severity.low}`}
                  color="success"
                  size="small"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Incidents Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Incidents
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Duration</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.recentIncidents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography color="text.secondary">
                        No incidents found for the selected period
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.recentIncidents.map((incident, index) => (
                    <TableRow key={index}>
                      <TableCell>{incident.title}</TableCell>
                      <TableCell>
                        <Chip
                          label={incident.severity}
                          color={getSeverityColor(incident.severity)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={incident.status}
                          variant="outlined"
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(incident.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{formatDuration(incident.duration)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
