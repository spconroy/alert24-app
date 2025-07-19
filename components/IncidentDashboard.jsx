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
  Divider,
  IconButton,
  Tooltip,
  Badge,
} from '@mui/material';
import Link from 'next/link';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MonitorIcon from '@mui/icons-material/Monitor';
import PeopleIcon from '@mui/icons-material/People';
import { useOrganization } from '@/contexts/OrganizationContext';
import NoSSR from './NoSSR';

export default function IncidentDashboard() {
  const [incidents, setIncidents] = useState([]);
  const [monitoringStats, setMonitoringStats] = useState({
    total: 0,
    up: 0,
    down: 0,
    warning: 0,
  });
  const [onCallInfo, setOnCallInfo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { selectedOrganization, session } = useOrganization();

  useEffect(() => {
    if (session) {
      fetchDashboardData();
    }
  }, [session, selectedOrganization]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params based on selected organization
      const params = new URLSearchParams();
      if (selectedOrganization) {
        params.append('organization_id', selectedOrganization.id);
      }
      params.append('limit', '10');

      // Fetch incidents
      const incidentsResponse = await fetch(
        `/api/incidents?${params.toString()}`
      );
      if (incidentsResponse.ok) {
        const incidentsData = await incidentsResponse.json();
        setIncidents(incidentsData.incidents || []);
      }

      // Fetch monitoring stats
      const monitoringResponse = await fetch(
        `/api/monitoring?${params.toString()}`
      );
      if (monitoringResponse.ok) {
        const monitoringData = await monitoringResponse.json();
        const checks = monitoringData.monitoring_checks || [];

        // Calculate monitoring statistics with safe defaults
        const stats = {
          total: checks.length || 0,
          up: checks.filter(c => c?.current_status === 'up').length || 0,
          down: checks.filter(c => c?.current_status === 'down').length || 0,
          warning:
            checks.filter(c => c?.current_status === 'warning').length || 0,
          inactive:
            checks.filter(c => c?.current_status === 'inactive').length || 0,
        };
        setMonitoringStats(stats);
      } else {
        // Set default stats if API call fails
        setMonitoringStats({
          total: 0,
          up: 0,
          down: 0,
          warning: 0,
        });
      }

      // Fetch on-call info
      const onCallParams = new URLSearchParams();
      if (selectedOrganization) {
        onCallParams.append('organization_id', selectedOrganization.id);
      }
      onCallParams.append('start_date', new Date().toISOString());
      onCallParams.append(
        'end_date',
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      );
      onCallParams.append('active_only', 'true');

      const onCallResponse = await fetch(
        `/api/on-call-schedules?${onCallParams.toString()}`
      );
      if (onCallResponse.ok) {
        const onCallData = await onCallResponse.json();
        setOnCallInfo(onCallData.on_call_schedules || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getIncidentSeverityColor = severity => {
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

  const getIncidentStatusColor = status => {
    switch (status) {
      case 'open':
        return 'error';
      case 'investigating':
        return 'warning';
      case 'monitoring':
        return 'info';
      case 'resolved':
        return 'success';
      default:
        return 'default';
    }
  };

  const getMonitoringStatusColor = () => {
    if ((monitoringStats.down || 0) > 0) return 'error';
    if ((monitoringStats.warning || 0) > 0) return 'warning';
    return 'success';
  };

  const getOverallSystemStatus = () => {
    const activeIncidents = incidents.filter(
      i => i.status !== 'resolved'
    ).length;
    const monitoringIssues =
      (monitoringStats.down || 0) + (monitoringStats.warning || 0);

    if (activeIncidents > 0 && monitoringIssues > 0) {
      return { status: 'Outage', color: 'error' };
    }
    if (activeIncidents > 0) {
      return { status: 'Active Incidents', color: 'warning' };
    }
    if (monitoringIssues > 0) {
      return { status: 'Monitoring Issues', color: 'warning' };
    }
    return { status: 'All Systems Operational', color: 'success' };
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Error loading dashboard data: {error}
      </Alert>
    );
  }

  const overallStatus = getOverallSystemStatus();
  const activeIncidents = incidents.filter(i => i.status !== 'resolved');

  // Extract currently on-call people from schedule data
  const currentlyOnCall = onCallInfo
    .filter(schedule => schedule.is_active && schedule.current_on_call_member)
    .map(schedule => ({
      ...schedule,
      user_name: schedule.current_on_call_member.name,
      user_email: schedule.current_on_call_member.email,
      is_currently_on_call: true,
    }));

  return (
    <Box>
      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={4}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Incident Management Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor incidents, services, and team status across your
            organization
          </Typography>
        </Box>
        <Box display="flex" gap={2} alignItems="center">
          <Tooltip title="Refresh Dashboard">
            <IconButton onClick={fetchDashboardData} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          {/* Contextual Primary CTA based on app state */}
          {monitoringStats.total === 0 ? (
            <Button
              component={Link}
              href="/monitoring/new"
              variant="contained"
              startIcon={<MonitorIcon />}
              color="primary"
              size="large"
              sx={{ px: 3 }}
            >
              Add First Monitor
            </Button>
          ) : currentlyOnCall.length === 0 ? (
            <Button
              component={Link}
              href="/on-call/new"
              variant="contained"
              startIcon={<PeopleIcon />}
              color="primary"
              size="large"
              sx={{ px: 3 }}
            >
              Set Up On-Call
            </Button>
          ) : (
            <Button
              component={Link}
              href="/incidents/new"
              variant="contained"
              startIcon={<AddIcon />}
              color="error"
              sx={{ px: 3 }}
            >
              Create Incident
            </Button>
          )}

          {/* Secondary action - always available but less prominent */}
          {(monitoringStats.total > 0 || currentlyOnCall.length > 0) && (
            <Button
              component={Link}
              href="/incidents/new"
              variant="outlined"
              startIcon={<AddIcon />}
              color="error"
              size="small"
            >
              Create Incident
            </Button>
          )}
        </Box>
      </Box>

      {/* Status Overview Cards */}
      <Box sx={{ mb: 4 }}>
        {/* Section Headers */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography
            variant="h6"
            color="text.secondary"
            sx={{ fontWeight: 500 }}
          >
            🔧 System Health
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            sx={{ fontWeight: 500 }}
          >
            🚨 Incident Response
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* System Health Cards */}
          {/* Overall System Status */}
          <Grid
            item
            xs={12}
            md={3}
            sx={{
              '& .MuiCard-root': {
                backgroundColor: 'rgba(33, 150, 243, 0.02)',
                borderLeft: '3px solid transparent',
                borderLeftColor: 'primary.light',
              },
            }}
          >
            <Card>
              <CardContent>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  System Status
                </Typography>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
                >
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor:
                        overallStatus.color === 'success'
                          ? '#4caf50'
                          : overallStatus.color === 'warning'
                            ? '#ff9800'
                            : '#f44336',
                    }}
                  />
                  <Chip
                    label={overallStatus.status}
                    color={overallStatus.color}
                    variant="filled"
                    sx={{ fontSize: '0.875rem', fontWeight: 'bold' }}
                  />
                </Box>
                {overallStatus.color === 'success' && (
                  <Typography variant="caption" color="text.secondary">
                    All services reporting normally
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Incident Response Cards */}
          {/* Active Incidents */}
          <Grid
            item
            xs={12}
            md={3}
            sx={{
              '& .MuiCard-root': {
                backgroundColor: 'rgba(255, 152, 0, 0.02)',
                borderLeft: '3px solid transparent',
                borderLeftColor: 'warning.light',
              },
            }}
          >
            <Card>
              <CardContent>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Active Incidents
                </Typography>
                <Box display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
                  <Badge badgeContent={activeIncidents.length} color="error">
                    <NotificationsIcon color="action" />
                  </Badge>
                  <Typography variant="h4">{activeIncidents.length}</Typography>
                </Box>
                {activeIncidents.length === 0 ? (
                  <Typography
                    variant="body2"
                    color="success.main"
                    sx={{ fontWeight: 500 }}
                  >
                    ✅ All Clear
                  </Typography>
                ) : (
                  <Box sx={{ mt: 1 }}>
                    <Button
                      component={Link}
                      href="/incidents"
                      variant="outlined"
                      size="small"
                      color="error"
                      fullWidth
                    >
                      View All
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Monitoring Status */}
          <Grid
            item
            xs={12}
            md={3}
            sx={{
              '& .MuiCard-root': {
                backgroundColor: 'rgba(33, 150, 243, 0.02)',
                borderLeft: '3px solid transparent',
                borderLeftColor: 'primary.light',
              },
            }}
          >
            {monitoringStats.total === 0 ? (
              <Card
                sx={{
                  border: '2px solid',
                  borderColor: 'primary.main',
                  backgroundColor: 'primary.50',
                  position: 'relative',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 4,
                  },
                  transition: 'all 0.2s ease-in-out',
                }}
              >
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <MonitorIcon
                    sx={{
                      fontSize: 32,
                      color: 'primary.main',
                      mb: 1,
                    }}
                  />
                  <Typography
                    variant="h6"
                    color="primary.main"
                    gutterBottom
                    sx={{ fontWeight: 600 }}
                  >
                    Start Monitoring
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    Add your first service to monitor uptime and performance
                  </Typography>
                  <Button
                    component={Link}
                    href="/monitoring/new"
                    variant="contained"
                    color="primary"
                    size="small"
                    startIcon={<AddIcon />}
                    fullWidth
                  >
                    Add Monitor
                  </Button>
                </CardContent>
                {/* Priority indicator */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'warning.main',
                    color: 'white',
                    borderRadius: '50%',
                    width: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                >
                  1
                </Box>
              </Card>
            ) : (
              <Card
                component={Link}
                href="/monitoring"
                sx={{
                  textDecoration: 'none',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    transform: 'translateY(-1px)',
                    boxShadow: 2,
                  },
                  transition: 'all 0.2s ease-in-out',
                }}
              >
                <CardContent>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Monitoring
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Badge
                      badgeContent={
                        (monitoringStats.down || 0) +
                        (monitoringStats.warning || 0)
                      }
                      color={getMonitoringStatusColor()}
                    >
                      <MonitorIcon color="action" />
                    </Badge>
                    <Typography variant="h4">
                      {monitoringStats.up || 0}/{monitoringStats.total || 0}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Services Up • Click to view details
                  </Typography>
                  {/* Add more button for existing monitoring */}
                  <Box sx={{ mt: 1 }}>
                    <Button
                      component={Link}
                      href="/monitoring/new"
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      fullWidth
                      onClick={e => e.stopPropagation()}
                    >
                      Add More
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            )}
          </Grid>

          {/* On-Call Status */}
          <Grid
            item
            xs={12}
            md={3}
            sx={{
              '& .MuiCard-root': {
                backgroundColor: 'rgba(255, 152, 0, 0.02)',
                borderLeft: '3px solid transparent',
                borderLeftColor: 'warning.light',
              },
            }}
          >
            {currentlyOnCall.length === 0 && monitoringStats.total > 0 ? (
              <Card
                sx={{
                  border: '2px solid',
                  borderColor: 'warning.main',
                  backgroundColor: 'warning.50',
                  position: 'relative',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 4,
                  },
                  transition: 'all 0.2s ease-in-out',
                }}
              >
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <PeopleIcon
                    sx={{
                      fontSize: 32,
                      color: 'warning.main',
                      mb: 1,
                    }}
                  />
                  <Typography
                    variant="h6"
                    color="warning.main"
                    gutterBottom
                    sx={{ fontWeight: 600 }}
                  >
                    Set Up On-Call
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    Ensure incidents are handled 24/7 with on-call schedules
                  </Typography>
                  <Button
                    component={Link}
                    href="/on-call/new"
                    variant="contained"
                    color="warning"
                    size="small"
                    startIcon={<AddIcon />}
                    fullWidth
                  >
                    Create Schedule
                  </Button>
                </CardContent>
                {/* Priority indicator */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'error.main',
                    color: 'white',
                    borderRadius: '50%',
                    width: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                >
                  2
                </Box>
              </Card>
            ) : (
              <Card>
                <CardContent>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    On-Call Now
                  </Typography>
                  <Box
                    display="flex"
                    alignItems="center"
                    gap={1}
                    sx={{ mb: 1 }}
                  >
                    <PeopleIcon color="action" />
                    <Typography variant="h4">
                      {currentlyOnCall.length}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Team Members
                  </Typography>
                  {currentlyOnCall.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Button
                        component={Link}
                        href="/on-call"
                        variant="outlined"
                        size="small"
                        fullWidth
                      >
                        View Schedule
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      </Box>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Recent Incidents */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={2}
              >
                <Typography variant="h6">Recent Incidents</Typography>
                <Button
                  component={Link}
                  href="/incidents"
                  variant="outlined"
                  size="small"
                >
                  View All
                </Button>
              </Box>
              <Divider sx={{ mb: 2 }} />

              {incidents.length === 0 ? (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 4,
                    backgroundColor: 'grey.50',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <NotificationsIcon
                    sx={{
                      fontSize: 48,
                      color: 'text.disabled',
                      mb: 2,
                    }}
                  />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No incidents yet
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    Great! Your systems are running smoothly. When issues arise,
                    they&apos;ll appear here.
                  </Typography>
                  <Box
                    sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}
                  >
                    <Button
                      component={Link}
                      href="/incidents/new"
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon />}
                    >
                      Create Test Incident
                    </Button>
                    <Button
                      component={Link}
                      href="/monitoring/new"
                      variant="outlined"
                      size="small"
                      startIcon={<MonitorIcon />}
                    >
                      Add Monitoring
                    </Button>
                  </Box>
                </Box>
              ) : (
                incidents.slice(0, 5).map(incident => (
                  <Box
                    key={incident.id}
                    sx={{ mb: 2, pb: 2, borderBottom: '1px solid #f0f0f0' }}
                  >
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      mb={1}
                    >
                      <Typography variant="subtitle1" fontWeight="medium">
                        <Link
                          href={`/incidents/${incident.id}`}
                          style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                          {incident.title}
                        </Link>
                      </Typography>
                      <Box display="flex" gap={1}>
                        <Chip
                          label={incident.severity}
                          color={getIncidentSeverityColor(incident.severity)}
                          size="small"
                        />
                        <Chip
                          label={incident.status}
                          color={getIncidentStatusColor(incident.status)}
                          size="small"
                        />
                      </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {incident.organization_name} •{' '}
                      {incident.assigned_to_name || 'Unassigned'} •{' '}
                      <NoSSR fallback="Loading...">
                        {new Date(incident.created_at).toLocaleDateString()}
                      </NoSSR>
                    </Typography>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* On-Call Schedule & Quick Actions */}
        <Grid item xs={12} lg={4}>
          {/* Current On-Call */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Currently On-Call
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {currentlyOnCall.length === 0 ? (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 3,
                    backgroundColor: 'grey.50',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <PeopleIcon
                    sx={{
                      fontSize: 40,
                      color: 'text.disabled',
                      mb: 1,
                    }}
                  />
                  <Typography
                    variant="subtitle1"
                    color="text.secondary"
                    gutterBottom
                  >
                    No on-call team configured
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    Set up your first on-call schedule to ensure incidents are
                    handled 24/7.
                  </Typography>
                  <Button
                    component={Link}
                    href="/on-call/new"
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                  >
                    Create Schedule
                  </Button>
                </Box>
              ) : (
                currentlyOnCall.map(schedule => (
                  <Box key={schedule.id} sx={{ mb: 1 }}>
                    <Typography variant="subtitle2">
                      {schedule.user_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {schedule.organization_name}
                    </Typography>
                  </Box>
                ))
              )}

              <Button
                component={Link}
                href="/on-call"
                variant="outlined"
                fullWidth
                sx={{ mt: 2 }}
              >
                Manage Schedules
              </Button>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {/* Initial Setup Section */}
              {(monitoringStats.total === 0 ||
                currentlyOnCall.length === 0) && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="subtitle2"
                    color="primary"
                    sx={{ mb: 1, fontWeight: 600 }}
                  >
                    🚀 Initial Setup
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={1}>
                    {monitoringStats.total === 0 && (
                      <Button
                        component={Link}
                        href="/monitoring/new"
                        variant="contained"
                        startIcon={<MonitorIcon />}
                        fullWidth
                        sx={{ justifyContent: 'flex-start' }}
                      >
                        Add Your First Monitoring Check
                      </Button>
                    )}
                    {currentlyOnCall.length === 0 && (
                      <Button
                        component={Link}
                        href="/on-call/new"
                        variant="contained"
                        startIcon={<PeopleIcon />}
                        fullWidth
                        sx={{ justifyContent: 'flex-start' }}
                      >
                        Set Up On-Call Schedule
                      </Button>
                    )}
                  </Box>
                </Box>
              )}

              {/* Advanced Configuration */}
              <Box>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{ mb: 1, fontWeight: 600 }}
                >
                  ⚙️ Advanced Configuration
                </Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  <Button
                    component={Link}
                    href="/escalation-policies/new"
                    variant="outlined"
                    startIcon={<NotificationsIcon />}
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    Create Escalation Policy
                  </Button>
                  <Button
                    component={Link}
                    href="/organizations/new"
                    variant="outlined"
                    startIcon={<AddIcon />}
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    Add Organization
                  </Button>
                  {monitoringStats.total > 0 && (
                    <Button
                      component={Link}
                      href="/monitoring/new"
                      variant="outlined"
                      startIcon={<MonitorIcon />}
                      fullWidth
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      Add More Monitoring
                    </Button>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
