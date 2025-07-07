'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Grid,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import Link from 'next/link';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import { useSession } from 'next-auth/react';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function MonitoringPage() {
  const [monitoringChecks, setMonitoringChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { data: session } = useSession();
  const { selectedOrganization } = useOrganization();

  useEffect(() => {
    if (session) {
      fetchMonitoringData();
    }
  }, [session, selectedOrganization]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      fetchMonitoringData();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [session, selectedOrganization]);

  const fetchMonitoringData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedOrganization?.id) {
        params.append('organization_id', selectedOrganization.id);
      }

      const response = await fetch(`/api/monitoring?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch monitoring checks');
      }

      const data = await response.json();
      setMonitoringChecks(data.monitoring_checks || []);
    } catch (err) {
      console.error('Error fetching monitoring data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = status => {
    switch (status) {
      case 'up':
        return <CheckCircleIcon color="success" />;
      case 'down':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      default:
        return <CircularProgress size={20} />;
    }
  };

  const getStatusColor = status => {
    switch (status) {
      case 'up':
        return 'success';
      case 'down':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getCheckTypeColor = type => {
    switch (type) {
      case 'http':
        return 'primary';
      case 'ping':
        return 'secondary';
      case 'tcp':
        return 'info';
      case 'ssl':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatResponseTime = timeMs => {
    if (!timeMs) return 'N/A';
    if (timeMs < 1000) return `${timeMs}ms`;
    return `${(timeMs / 1000).toFixed(2)}s`;
  };

  const formatNextCheckTime = (nextCheckTime, isActive) => {
    if (!isActive) return 'Paused';
    if (!nextCheckTime) return 'Unknown';

    const now = new Date();
    const nextCheck = new Date(nextCheckTime);
    const diffMs = nextCheck.getTime() - now.getTime();

    // If it's overdue (negative difference) or within 30 seconds
    if (diffMs < 30000) {
      return (
        <span style={{ color: '#ff9800' }}>
          {diffMs < 0 ? 'Overdue' : 'Now'}
        </span>
      );
    }

    // If it's within the next hour, show minutes
    if (diffMs < 3600000) {
      const minutes = Math.floor(diffMs / 60000);
      return `in ${minutes}m`;
    }

    // If it's within the next day, show hours and minutes
    if (diffMs < 86400000) {
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      return `in ${hours}h ${minutes}m`;
    }

    // For longer periods, show the actual time
    return nextCheck.toLocaleString();
  };

  // Calculate stats
  const stats = {
    total: monitoringChecks.length,
    up: monitoringChecks.filter(c => c.current_status === 'up').length,
    down: monitoringChecks.filter(c => c.current_status === 'down').length,
    warning: monitoringChecks.filter(c => c.current_status === 'warning')
      .length,
    inactive: monitoringChecks.filter(c => !c.is_active).length,
  };

  if (!session) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <Typography>Please sign in to view monitoring.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={4}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Monitoring
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor the health and performance of your services
          </Typography>
        </Box>
        <Box display="flex" gap={2} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Auto-refreshes every 30s
          </Typography>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchMonitoringData} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            component={Link}
            href="/monitoring/new"
            variant="contained"
            startIcon={<AddIcon />}
            color="primary"
          >
            Add Monitor
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Total Monitors
              </Typography>
              <Typography variant="h3" color="primary">
                {stats.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Up
              </Typography>
              <Typography variant="h3" color="success.main">
                {stats.up}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Down
              </Typography>
              <Typography variant="h3" color="error.main">
                {stats.down}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Warning
              </Typography>
              <Typography variant="h3" color="warning.main">
                {stats.warning}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Monitoring Checks Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              minHeight="200px"
            >
              <CircularProgress />
            </Box>
          ) : monitoringChecks.length === 0 ? (
            <Box textAlign="center" py={6}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No monitoring checks found
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Add your first monitoring check to start tracking service
                health.
              </Typography>
              <Button
                component={Link}
                href="/monitoring/new"
                variant="contained"
                startIcon={<AddIcon />}
                color="primary"
              >
                Add Monitor
              </Button>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Status</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Target</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Response Time</TableCell>
                    <TableCell>Last Check</TableCell>
                    <TableCell>Next Check</TableCell>
                    <TableCell>Organization</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {monitoringChecks.map(check => (
                    <TableRow key={check.id} hover>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {getStatusIcon(check.current_status)}
                          <Chip
                            label={check.current_status || 'Unknown'}
                            color={getStatusColor(check.current_status)}
                            size="small"
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight="medium">
                          {check.name}
                        </Typography>
                        {!check.is_active && (
                          <Chip
                            label="Inactive"
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={check.check_type.toUpperCase()}
                          color={getCheckTypeColor(check.check_type)}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {check.target_url}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {check.location_name || 'Default'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatResponseTime(check.last_response_time)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {check.last_check_time
                            ? new Date(check.last_check_time).toLocaleString()
                            : 'Never'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color={
                            formatNextCheckTime(
                              check.next_check_time,
                              check.is_active
                            ) === 'Now'
                              ? 'warning.main'
                              : 'text.secondary'
                          }
                        >
                          {formatNextCheckTime(
                            check.next_check_time,
                            check.is_active
                          )}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {check.organization_name}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
