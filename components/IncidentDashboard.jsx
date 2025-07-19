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
        <Box display="flex" gap={2}>
          <Tooltip title="Refresh Dashboard">
            <IconButton onClick={fetchDashboardData} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            component={Link}
            href="/incidents/new"
            variant="contained"
            startIcon={<AddIcon />}
            color="error"
          >
            Create Incident
          </Button>
        </Box>
      </Box>

      {/* Status Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Overall System Status */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                System Status
              </Typography>
              <Chip
                label={overallStatus.status}
                color={overallStatus.color}
                variant="filled"
                sx={{ fontSize: '0.875rem', fontWeight: 'bold' }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Active Incidents */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Active Incidents
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Badge badgeContent={activeIncidents.length} color="error">
                  <NotificationsIcon color="action" />
                </Badge>
                <Typography variant="h4">{activeIncidents.length}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Monitoring Status */}
        <Grid item xs={12} md={3}>
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
                    (monitoringStats.down || 0) + (monitoringStats.warning || 0)
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
            </CardContent>
          </Card>
        </Grid>

        {/* On-Call Status */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                On-Call Now
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <PeopleIcon color="action" />
                <Typography variant="h4">{currentlyOnCall.length}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Team Members
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
                <Typography color="text.secondary" textAlign="center" py={4}>
                  No incidents found
                </Typography>
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
                <Typography color="text.secondary" textAlign="center" py={2}>
                  No one is currently on-call
                </Typography>
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

              <Box display="flex" flexDirection="column" gap={1}>
                <Button
                  component={Link}
                  href="/monitoring/new"
                  variant="outlined"
                  startIcon={<MonitorIcon />}
                  fullWidth
                >
                  Add Monitoring Check
                </Button>
                <Button
                  component={Link}
                  href="/escalation-policies/new"
                  variant="outlined"
                  startIcon={<NotificationsIcon />}
                  fullWidth
                >
                  Create Escalation Policy
                </Button>
                <Button
                  component={Link}
                  href="/organizations/new"
                  variant="outlined"
                  startIcon={<AddIcon />}
                  fullWidth
                >
                  Add Organization
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
