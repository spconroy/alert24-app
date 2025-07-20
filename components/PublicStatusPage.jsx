'use client';
import React from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Chip,
  Grid,
  Divider,
  Paper,
} from '@mui/material';
import StatusUpdatesFeed from './StatusUpdatesFeed';
import StatusPageSubscribe from './StatusPageSubscribe';
import ServiceUptimeTimeline from './ServiceUptimeTimeline';
import ServiceUptimeStats from './ServiceUptimeStats';
import NoSSR from './NoSSR';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import BuildIcon from '@mui/icons-material/Build';

export default function PublicStatusPage({
  statusPage,
  services,
  statusUpdates,
}) {
  const getStatusIcon = status => {
    switch (status) {
      case 'operational':
        return <CheckCircleIcon sx={{ fontSize: 20 }} />;
      case 'degraded':
        return <WarningIcon sx={{ fontSize: 20 }} />;
      case 'down':
        return <ErrorIcon sx={{ fontSize: 20 }} />;
      case 'maintenance':
        return <BuildIcon sx={{ fontSize: 20 }} />;
      default:
        return <CheckCircleIcon sx={{ fontSize: 20 }} />;
    }
  };

  const getStatusColor = status => {
    switch (status) {
      case 'operational':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'down':
        return 'error';
      case 'maintenance':
        return 'info';
      default:
        return 'success';
    }
  };

  const getStatusText = status => {
    switch (status) {
      case 'operational':
        return 'Operational';
      case 'degraded':
        return 'Degraded Performance';
      case 'down':
        return 'Outage';
      case 'maintenance':
        return 'Under Maintenance';
      default:
        return 'Operational';
    }
  };

  const getOverallStatus = () => {
    if (services.length === 0) {
      return {
        status: 'No Services',
        color: 'default',
        description: 'No services are currently being monitored.',
      };
    }

    const downServices = services.filter(s => s.status === 'down');
    const degradedServices = services.filter(s => s.status === 'degraded');
    const maintenanceServices = services.filter(
      s => s.status === 'maintenance'
    );

    if (downServices.length > 0) {
      return {
        status: 'Outage',
        color: 'error',
        description: `${downServices.length} service${downServices.length > 1 ? 's are' : ' is'} currently experiencing an outage.`,
      };
    }

    if (degradedServices.length > 0) {
      return {
        status: 'Partial Outage',
        color: 'warning',
        description: `${degradedServices.length} service${degradedServices.length > 1 ? 's are' : ' is'} experiencing degraded performance.`,
      };
    }

    if (maintenanceServices.length > 0) {
      return {
        status: 'Under Maintenance',
        color: 'info',
        description: `${maintenanceServices.length} service${maintenanceServices.length > 1 ? 's are' : ' is'} currently under maintenance.`,
      };
    }

    return {
      status: 'All Systems Operational',
      color: 'success',
      description: 'All services are operating normally.',
    };
  };

  const overallStatus = getOverallStatus();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      {/* Header */}
      <Box
        sx={{
          bgcolor: 'white',
          borderBottom: 1,
          borderColor: 'divider',
          py: 3,
        }}
      >
        <Container maxWidth="lg">
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="flex-start"
          >
            <Box flex={1}>
              <Typography variant="h3" component="h1" gutterBottom>
                {statusPage.name}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {statusPage.organization_name}
              </Typography>
              {statusPage.description && (
                <Typography variant="body1" sx={{ mt: 1 }}>
                  {statusPage.description}
                </Typography>
              )}
            </Box>
            <Box sx={{ ml: 2, mt: 1 }}>
              <StatusPageSubscribe
                statusPageId={statusPage.id}
                statusPageName={statusPage.name}
              />
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Overall Status */}
        <Paper elevation={1} sx={{ p: 3, mb: 4 }}>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Chip
              icon={getStatusIcon(
                overallStatus.color === 'success'
                  ? 'operational'
                  : overallStatus.color === 'warning'
                    ? 'degraded'
                    : overallStatus.color === 'error'
                      ? 'down'
                      : 'maintenance'
              )}
              label={overallStatus.status}
              color={overallStatus.color}
              size="large"
              sx={{ fontSize: '1rem', px: 2, py: 1 }}
            />
          </Box>
          <Typography variant="body1" color="text.secondary">
            {overallStatus.description}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: 'block' }}
          >
            <NoSSR fallback="Last updated: Loading...">
              Last updated: {new Date().toLocaleString()}
            </NoSSR>
          </Typography>
        </Paper>

        {/* Services with SLA Tracking */}
        <Typography variant="h4" component="h2" gutterBottom>
          Services
        </Typography>

        {services.length === 0 ? (
          <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Services
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No services are currently being monitored on this status page.
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {services.map(service => (
              <Paper key={service.id} elevation={1} sx={{ p: 3 }}>
                {/* Service Header */}
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  mb={2}
                >
                  <Box flex={1}>
                    <Typography variant="h5" component="h3" gutterBottom>
                      {service.name}
                    </Typography>
                    {service.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        {service.description}
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    icon={getStatusIcon(service.status)}
                    label={getStatusText(service.status)}
                    color={getStatusColor(service.status)}
                    size="medium"
                  />
                </Box>

                {/* SLA Section */}
                <Grid container spacing={3} alignItems="center">
                  {/* Timeline Visualization */}
                  <Grid size={{ xs: 12, md: 8 }}>
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      mb={1}
                    >
                      7 days uptime history
                    </Typography>
                    <ServiceUptimeTimeline serviceId={service.id} days={7} isPublic={true} />
                  </Grid>

                  {/* Uptime Stats */}
                  <Grid size={{ xs: 12, md: 4 }}>
                    <ServiceUptimeStats serviceId={service.id} compact={true} isPublic={true} days={7} />
                  </Grid>
                </Grid>
              </Paper>
            ))}
          </Box>
        )}

        {/* Status Updates Feed */}
        <Box sx={{ mt: 6 }}>
          <StatusUpdatesFeed
            statusPageId={statusPage.id}
            statusUpdates={statusUpdates}
          />
        </Box>

        {/* Footer */}
        <Box sx={{ mt: 6, pt: 3, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary" align="center">
            Powered by Alert24 • Status page for {statusPage.organization_name}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
