'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Grid,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Build as BuildIcon
} from '@mui/icons-material';

export default function StatusPageOverallStatus({ statusPageId }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (statusPageId) {
      fetchServices();
    }
  }, [statusPageId]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/services?status_page_id=${statusPageId}`);
      if (!response.ok) throw new Error('Failed to fetch services');
      const data = await response.json();
      setServices(data.services || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getOverallStatus = () => {
    if (services.length === 0) {
      return { status: 'No Services', color: 'default', icon: <CheckCircleIcon />, count: 0 };
    }

    const downServices = services.filter(s => s.status === 'down');
    const degradedServices = services.filter(s => s.status === 'degraded');
    const maintenanceServices = services.filter(s => s.status === 'maintenance');
    const operationalServices = services.filter(s => s.status === 'operational');

    if (downServices.length > 0) {
      return {
        status: 'Major Outage',
        color: 'error',
        icon: <ErrorIcon />,
        count: downServices.length,
        description: `${downServices.length} service${downServices.length > 1 ? 's' : ''} down`
      };
    }

    if (degradedServices.length > 0) {
      return {
        status: 'Partial Outage',
        color: 'warning',
        icon: <WarningIcon />,
        count: degradedServices.length,
        description: `${degradedServices.length} service${degradedServices.length > 1 ? 's' : ''} degraded`
      };
    }

    if (maintenanceServices.length > 0) {
      return {
        status: 'Under Maintenance',
        color: 'info',
        icon: <BuildIcon />,
        count: maintenanceServices.length,
        description: `${maintenanceServices.length} service${maintenanceServices.length > 1 ? 's' : ''} in maintenance`
      };
    }

    return {
      status: 'All Systems Operational',
      color: 'success',
      icon: <CheckCircleIcon />,
      count: operationalServices.length,
      description: `${operationalServices.length} service${operationalServices.length !== 1 ? 's' : ''} operational`
    };
  };

  const getStatusCounts = () => {
    return {
      operational: services.filter(s => s.status === 'operational').length,
      degraded: services.filter(s => s.status === 'degraded').length,
      down: services.filter(s => s.status === 'down').length,
      maintenance: services.filter(s => s.status === 'maintenance').length
    };
  };

  if (loading) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading status: {error}
      </Alert>
    );
  }

  const overallStatus = getOverallStatus();
  const statusCounts = getStatusCounts();

  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Overall Status
        </Typography>
        
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <Chip
            icon={overallStatus.icon}
            label={overallStatus.status}
            color={overallStatus.color}
            size="large"
            sx={{ fontSize: '0.9rem', px: 2, py: 1 }}
          />
          {overallStatus.description && (
            <Typography variant="body2" color="text.secondary">
              {overallStatus.description}
            </Typography>
          )}
        </Box>

        {services.length > 0 && (
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="success.main">
                  {statusCounts.operational}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Operational
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="warning.main">
                  {statusCounts.degraded}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Degraded
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="error.main">
                  {statusCounts.down}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Down
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h4" color="info.main">
                  {statusCounts.maintenance}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Maintenance
                </Typography>
              </Box>
            </Grid>
          </Grid>
        )}
      </CardContent>
    </Card>
  );
} 