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
import InfoIcon from '@mui/icons-material/Info';
import { useOrganization } from '@/contexts/OrganizationContext';
import NoSSR from './NoSSR';

// CSS for pulse animation
const pulseAnimation = `
  @keyframes pulse {
    0% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.1); }
    100% { opacity: 1; transform: scale(1); }
  }
`;

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
      {/* Add pulse animation styles */}
      <style>{pulseAnimation}</style>

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
                <Box>
                  {currentlyOnCall.map((schedule, index) => (
                    <Box
                      key={schedule.id}
                      sx={{
                        mb: 2,
                        p: 2,
                        backgroundColor: 'success.50',
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'success.200',
                        position: 'relative',
                      }}
                    >
                      {/* Online indicator */}
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          width: 8,
                          height: 8,
                          backgroundColor: 'success.main',
                          borderRadius: '50%',
                          animation: 'pulse 2s infinite',
                        }}
                      />

                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 1,
                        }}
                      >
                        <PeopleIcon color="success" fontSize="small" />
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 600 }}
                        >
                          {schedule.user_name}
                        </Typography>
                      </Box>

                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mb: 1 }}
                      >
                        {schedule.organization_name}
                      </Typography>

                      {/* Schedule info */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          mb: 1,
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="success.main"
                          sx={{ fontWeight: 500 }}
                        >
                          🕐 On-Call Now
                        </Typography>
                      </Box>

                      {/* Contact actions */}
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          component={Link}
                          href={`/incidents/new?assignTo=${schedule.user_id}`}
                          size="small"
                          variant="outlined"
                          color="success"
                          sx={{ flex: 1, fontSize: '0.75rem' }}
                        >
                          Assign Incident
                        </Button>
                        <Tooltip title={`Contact ${schedule.user_name}`}>
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            sx={{ minWidth: 'auto', px: 1 }}
                          >
                            📞
                          </Button>
                        </Tooltip>
                      </Box>
                    </Box>
                  ))}

                  {/* Summary footer */}
                  <Box
                    sx={{
                      mt: 2,
                      p: 1,
                      backgroundColor: 'grey.50',
                      borderRadius: 1,
                      textAlign: 'center',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {currentlyOnCall.length} team member
                      {currentlyOnCall.length > 1 ? 's' : ''} actively
                      monitoring
                    </Typography>
                  </Box>
                </Box>
              )}

              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button
                  component={Link}
                  href="/on-call"
                  variant="outlined"
                  fullWidth
                  startIcon={<PeopleIcon />}
                >
                  {currentlyOnCall.length > 0
                    ? 'View All Schedules'
                    : 'Manage Schedules'}
                </Button>
                {currentlyOnCall.length === 0 && (
                  <Button
                    component={Link}
                    href="/on-call/new"
                    variant="contained"
                    color="warning"
                    startIcon={<AddIcon />}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    Add Schedule
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1,
                }}
              >
                <Typography variant="h6">Quick Actions</Typography>
                {/* Setup progress indicator */}
                <Tooltip title="Setup completion progress">
                  <Chip
                    label={`${Math.round((((monitoringStats.total > 0 ? 1 : 0) + (currentlyOnCall.length > 0 ? 1 : 0)) / 2) * 100)}%`}
                    color={
                      (monitoringStats.total > 0 ? 1 : 0) +
                        (currentlyOnCall.length > 0 ? 1 : 0) ===
                      2
                        ? 'success'
                        : 'primary'
                    }
                    size="small"
                  />
                </Tooltip>
              </Box>
              <Divider sx={{ mb: 2 }} />

              {/* Setup Progress Bar */}
              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  gutterBottom
                >
                  Platform Setup Progress
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mt: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      flex: 1,
                      height: 6,
                      backgroundColor: 'grey.200',
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        width: `${(((monitoringStats.total > 0 ? 1 : 0) + (currentlyOnCall.length > 0 ? 1 : 0)) / 2) * 100}%`,
                        backgroundColor:
                          (monitoringStats.total > 0 ? 1 : 0) +
                            (currentlyOnCall.length > 0 ? 1 : 0) ===
                          2
                            ? '#4caf50'
                            : '#2196f3',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {(monitoringStats.total > 0 ? 1 : 0) +
                      (currentlyOnCall.length > 0 ? 1 : 0)}
                    /2
                  </Typography>
                </Box>
              </Box>

              {/* Initial Setup Section */}
              {(monitoringStats.total === 0 ||
                currentlyOnCall.length === 0) && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="subtitle2"
                    color="primary"
                    sx={{
                      mb: 2,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    🚀 Essential Setup
                    <Typography variant="caption" color="text.secondary">
                      (
                      {2 -
                        ((monitoringStats.total > 0 ? 1 : 0) +
                          (currentlyOnCall.length > 0 ? 1 : 0))}{' '}
                      remaining)
                    </Typography>
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={2}>
                    {monitoringStats.total === 0 && (
                      <Box
                        sx={{
                          p: 2,
                          border: '2px solid',
                          borderColor: 'primary.main',
                          borderRadius: 2,
                          backgroundColor: 'primary.50',
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            mb: 1,
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600 }}
                          >
                            Add Monitoring
                          </Typography>
                          <Chip
                            label="~3 min"
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mb: 2 }}
                        >
                          Monitor your services to track uptime and get alerts
                          when issues occur
                        </Typography>
                        <Button
                          component={Link}
                          href="/monitoring/new"
                          variant="contained"
                          startIcon={<MonitorIcon />}
                          fullWidth
                          size="small"
                        >
                          Add Your First Monitor
                        </Button>
                      </Box>
                    )}
                    {currentlyOnCall.length === 0 && (
                      <Box
                        sx={{
                          p: 2,
                          border: '2px solid',
                          borderColor: 'warning.main',
                          borderRadius: 2,
                          backgroundColor: 'warning.50',
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            mb: 1,
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600 }}
                          >
                            On-Call Schedule
                          </Typography>
                          <Chip
                            label="~5 min"
                            size="small"
                            color="warning"
                            variant="outlined"
                          />
                        </Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mb: 2 }}
                        >
                          Ensure someone is always available to handle incidents
                          24/7
                        </Typography>
                        <Button
                          component={Link}
                          href="/on-call/new"
                          variant="contained"
                          color="warning"
                          startIcon={<PeopleIcon />}
                          fullWidth
                          size="small"
                        >
                          Set Up On-Call Team
                        </Button>
                      </Box>
                    )}
                  </Box>
                </Box>
              )}

              {/* Completed Setup Celebration */}
              {monitoringStats.total > 0 && currentlyOnCall.length > 0 && (
                <Box
                  sx={{
                    mb: 3,
                    p: 2,
                    backgroundColor: 'success.50',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'success.200',
                    textAlign: 'center',
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    color="success.main"
                    sx={{ fontWeight: 600, mb: 1 }}
                  >
                    🎉 Setup Complete!
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Your incident management system is ready. You can now create
                    incidents, manage escalations, and monitor your services.
                  </Typography>
                </Box>
              )}

              {/* Advanced Configuration */}
              <Box>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{
                    mb: 2,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  ⚙️ Advanced Configuration
                  <Tooltip title="Optional features to enhance your incident management">
                    <InfoIcon fontSize="small" color="action" />
                  </Tooltip>
                </Typography>
                <Box display="flex" flexDirection="column" gap={1.5}>
                  <Box>
                    <Tooltip
                      title="Create rules for automatic incident escalation when they're not resolved quickly enough"
                      placement="left"
                    >
                      <Button
                        component={Link}
                        href="/escalation-policies/new"
                        variant="outlined"
                        startIcon={<NotificationsIcon />}
                        fullWidth
                        sx={{ justifyContent: 'space-between' }}
                        endIcon={
                          <Typography variant="caption" color="text.secondary">
                            ~4 min
                          </Typography>
                        }
                      >
                        Create Escalation Policy
                      </Button>
                    </Tooltip>
                  </Box>

                  {monitoringStats.total > 0 && (
                    <Box>
                      <Tooltip
                        title="Add additional monitoring checks for more comprehensive coverage"
                        placement="left"
                      >
                        <Button
                          component={Link}
                          href="/monitoring/new"
                          variant="outlined"
                          startIcon={<MonitorIcon />}
                          fullWidth
                          sx={{ justifyContent: 'space-between' }}
                          endIcon={
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              ~3 min
                            </Typography>
                          }
                        >
                          Add More Monitoring
                        </Button>
                      </Tooltip>
                    </Box>
                  )}

                  <Box>
                    <Tooltip
                      title="Invite team members or create additional organizations for multi-tenant management"
                      placement="left"
                    >
                      <Button
                        component={Link}
                        href="/organizations/new"
                        variant="outlined"
                        startIcon={<AddIcon />}
                        fullWidth
                        sx={{ justifyContent: 'space-between' }}
                        endIcon={
                          <Typography variant="caption" color="text.secondary">
                            ~2 min
                          </Typography>
                        }
                      >
                        Add Organization
                      </Button>
                    </Tooltip>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
