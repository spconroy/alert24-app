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

// CSS for animations
const animations = `
  @keyframes pulse {
    0% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.1); }
    100% { opacity: 1; transform: scale(1); }
  }
  
  @keyframes celebration-pulse {
    0% { opacity: 0.3; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(1.2); }
    100% { opacity: 0.3; transform: scale(1); }
  }
`;

// Button Hierarchy Standards for Dashboard Consistency:
// 1. PRIMARY (variant="contained"): Setup actions, Create incident, Critical actions
// 2. SECONDARY (variant="outlined"): Management, View details, Optional actions
// 3. TERTIARY (variant="text"): Navigation, Filters, Show more links

export default function IncidentDashboard() {
  const [incidents, setIncidents] = useState([]);
  const [incidentFilter, setIncidentFilter] = useState('all'); // 'all', 'active', 'resolved'
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

  // Filter incidents based on selected filter
  const getFilteredIncidents = () => {
    switch (incidentFilter) {
      case 'active':
        return activeIncidents;
      case 'resolved':
        return incidents.filter(i => i.status === 'resolved');
      default:
        return incidents;
    }
  };

  const filteredIncidents = getFilteredIncidents();

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
        {/* Add animation styles */}
        <style>{animations}</style>

        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            mb: 4,
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 2, sm: 0 },
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{
                fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' },
                lineHeight: { xs: 1.2, sm: 1.167 },
              }}
            >
              Incident Management Dashboard
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
            >
              Monitor incidents, services, and team status across your
              organization
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              gap: { xs: 1, sm: 2 },
              alignItems: 'center',
              flexDirection: { xs: 'column', sm: 'row' },
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            <Tooltip title="Refresh dashboard data - Updates all metrics, incidents, and monitoring status">
              <IconButton onClick={fetchDashboardData} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>

            {/* Single primary CTA based on app state */}
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
          </Box>
        </Box>

        {/* Setup Completion Banner */}
        {monitoringStats.total > 0 && currentlyOnCall.length > 0 && (
          <Box
            sx={{
              mb: 3,
              p: 2,
              background:
                'linear-gradient(90deg, #e8f5e8 0%, #f1f8e9 50%, #e8f5e8 100%)',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'success.light',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: 'success.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              ✓
            </Box>
            <Typography
              variant="body1"
              color="success.dark"
              sx={{ fontWeight: 600 }}
            >
              🎉 Congratulations! Your incident management system is fully
              configured and ready.
            </Typography>
          </Box>
        )}

        {/* Status Overview Cards */}
        <Box sx={{ mb: 4 }}>
          {/* Section Headers */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              mb: 2,
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 1, sm: 0 },
            }}
          >
          </Box>

          <Grid container spacing={{ xs: 2, sm: 3 }}>
            {/* System Health Cards */}
            {/* Overall System Status */}
            <Grid
              item
              xs={12}
              sm={6}
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
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    <Typography variant="h6" color="text.secondary">
                      System Status
                    </Typography>
                    <Tooltip
                      title="Overall health status of your monitored services. Green = all operational, orange = some issues, red = outages detected."
                      arrow
                      placement="top"
                    >
                      <InfoIcon
                        fontSize="small"
                        color="action"
                        sx={{ cursor: 'help', opacity: 0.7 }}
                      />
                    </Tooltip>
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 1,
                    }}
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
              sm={6}
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
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    <Typography variant="h6" color="text.secondary">
                      Active Incidents
                    </Typography>
                    <Tooltip
                      title="Number of currently open incidents requiring attention. Click 'View All' to see incident details and manage responses."
                      arrow
                      placement="top"
                    >
                      <InfoIcon
                        fontSize="small"
                        color="action"
                        sx={{ cursor: 'help', opacity: 0.7 }}
                      />
                    </Tooltip>
                  </Box>
                  <Box
                    display="flex"
                    alignItems="center"
                    gap={1}
                    sx={{ mb: 1 }}
                  >
                    <Badge badgeContent={activeIncidents.length} color="error">
                      <NotificationsIcon color="action" />
                    </Badge>
                    <Typography variant="h4">
                      {activeIncidents.length}
                    </Typography>
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
              sm={6}
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
                    border: '1px solid',
                    borderColor: 'primary.light',
                    backgroundColor: 'primary.25',
                    position: 'relative',
                  }}
                >
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <Typography variant="h6" color="text.secondary">
                        Monitoring Setup
                      </Typography>
                      <Tooltip
                        title="Set up automated checks to monitor your websites, APIs, and services"
                        arrow
                        placement="top"
                      >
                        <InfoIcon
                          fontSize="small"
                          color="action"
                          sx={{ cursor: 'help', opacity: 0.7 }}
                        />
                      </Tooltip>
                    </Box>

                    <Box
                      display="flex"
                      alignItems="center"
                      gap={1}
                      sx={{ mb: 1 }}
                    >
                      <MonitorIcon color="primary" sx={{ fontSize: 20 }} />
                      <Typography variant="h4" color="primary.main">
                        !
                      </Typography>
                    </Box>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      Setup Required
                    </Typography>

                    <Button
                      component={Link}
                      href="/monitoring/new"
                      variant="contained"
                      color="primary"
                      size="small"
                      fullWidth
                      sx={{ fontSize: '0.75rem' }}
                    >
                      Configure
                    </Button>

                    {/* Small priority indicator */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        backgroundColor: 'primary.main',
                        color: 'white',
                        borderRadius: '50%',
                        width: 16,
                        height: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: 'bold',
                      }}
                    >
                      1
                    </Box>
                  </CardContent>
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
                    <Typography
                      variant="h6"
                      color="text.secondary"
                      gutterBottom
                    >
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
              sm={6}
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
                    border: '1px solid',
                    borderColor: 'warning.light',
                    backgroundColor: 'warning.25',
                    position: 'relative',
                  }}
                >
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <Typography variant="h6" color="text.secondary">
                        On-Call Setup
                      </Typography>
                      <Tooltip
                        title="Configure 24/7 incident response coverage with on-call schedules"
                        arrow
                        placement="top"
                      >
                        <InfoIcon
                          fontSize="small"
                          color="action"
                          sx={{ cursor: 'help', opacity: 0.7 }}
                        />
                      </Tooltip>
                    </Box>

                    <Box
                      display="flex"
                      alignItems="center"
                      gap={1}
                      sx={{ mb: 1 }}
                    >
                      <PeopleIcon color="warning" sx={{ fontSize: 20 }} />
                      <Typography variant="h4" color="warning.main">
                        !
                      </Typography>
                    </Box>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      Setup Required
                    </Typography>

                    <Button
                      component={Link}
                      href="/on-call/new"
                      variant="contained"
                      color="warning"
                      size="small"
                      fullWidth
                      sx={{ fontSize: '0.75rem' }}
                    >
                      Configure
                    </Button>

                    {/* Small priority indicator */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        backgroundColor: 'warning.main',
                        color: 'white',
                        borderRadius: '50%',
                        width: 16,
                        height: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: 'bold',
                      }}
                    >
                      2
                    </Box>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent>
                    <Typography
                      variant="h6"
                      color="text.secondary"
                      gutterBottom
                    >
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
        <Grid container spacing={{ xs: 2, sm: 3 }}>
          {/* Recent Incidents */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    mb: 2,
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: { xs: 1, sm: 0 },
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: { xs: 1, sm: 2 },
                      flexWrap: 'wrap',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="h6"
                        sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
                      >
                        Recent Incidents
                      </Typography>
                      <Tooltip
                        title="Latest incidents in your organization. Track status, assign team members, and manage resolution progress."
                        arrow
                        placement="top"
                      >
                        <InfoIcon
                          fontSize="small"
                          color="action"
                          sx={{ cursor: 'help', opacity: 0.7 }}
                        />
                      </Tooltip>
                    </Box>
                    {incidents.length > 0 && (
                      <Chip
                        label={`${activeIncidents.length} active`}
                        color={activeIncidents.length > 0 ? 'error' : 'success'}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 1,
                      width: { xs: '100%', sm: 'auto' },
                    }}
                  >
                    <Button
                      component={Link}
                      href="/incidents"
                      variant="outlined"
                      size="small"
                      sx={{ flex: { xs: 1, sm: 'none' } }}
                    >
                      View All
                    </Button>
                  </Box>
                </Box>

                {/* Filter tabs */}
                {incidents.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                      <Box
                        sx={{
                          display: 'flex',
                          gap: { xs: 1, sm: 2 },
                          overflowX: 'auto',
                          pb: 1,
                          '&::-webkit-scrollbar': { display: 'none' },
                          msOverflowStyle: 'none',
                          scrollbarWidth: 'none',
                        }}
                      >
                        <Tooltip
                          title="All incidents regardless of status"
                          placement="top"
                        >
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => setIncidentFilter('all')}
                            sx={{
                              minWidth: 'auto',
                              borderBottom: 2,
                              borderColor: incidentFilter === 'all' ? 'primary.main' : 'transparent',
                              borderRadius: 0,
                              color: incidentFilter === 'all' ? 'primary.main' : 'text.secondary',
                              fontWeight: incidentFilter === 'all' ? 600 : 400,
                              fontSize: { xs: '0.75rem', sm: '0.875rem' },
                              whiteSpace: 'nowrap',
                            }}
                          >
                            All ({incidents.length})
                          </Button>
                        </Tooltip>
                        <Tooltip
                          title="Incidents currently open and requiring attention"
                          placement="top"
                        >
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => setIncidentFilter('active')}
                            sx={{
                              minWidth: 'auto',
                              borderBottom: 2,
                              borderColor: incidentFilter === 'active' ? 'primary.main' : 'transparent',
                              borderRadius: 0,
                              color: incidentFilter === 'active' ? 'primary.main' : 'text.secondary',
                              fontWeight: incidentFilter === 'active' ? 600 : 400,
                              fontSize: { xs: '0.75rem', sm: '0.875rem' },
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Active ({activeIncidents.length})
                          </Button>
                        </Tooltip>
                        <Tooltip
                          title="Incidents that have been resolved and closed"
                          placement="top"
                        >
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => setIncidentFilter('resolved')}
                            sx={{
                              minWidth: 'auto',
                              borderBottom: 2,
                              borderColor: incidentFilter === 'resolved' ? 'primary.main' : 'transparent',
                              borderRadius: 0,
                              color: incidentFilter === 'resolved' ? 'primary.main' : 'text.secondary',
                              fontWeight: incidentFilter === 'resolved' ? 600 : 400,
                              fontSize: { xs: '0.75rem', sm: '0.875rem' },
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Resolved (
                            {incidents.length - activeIncidents.length})
                          </Button>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Box>
                )}

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
                    <Typography
                      variant="h6"
                      color="text.secondary"
                      gutterBottom
                    >
                      No incidents yet
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      Great! Your systems are running smoothly. When issues
                      arise, they&apos;ll appear here.
                    </Typography>
                    <Box
                      sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}
                    >
                      <Button
                        component={Link}
                        href="/monitoring/new"
                        variant="contained"
                        size="small"
                        startIcon={<MonitorIcon />}
                      >
                        Add Monitoring
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box>
                    {filteredIncidents
                      .sort((a, b) => {
                        // Sort open incidents first, then by creation date (newest first)
                        const aIsOpen = a.status !== 'resolved';
                        const bIsOpen = b.status !== 'resolved';
                        
                        if (aIsOpen && !bIsOpen) return -1; // a comes first (open)
                        if (!aIsOpen && bIsOpen) return 1;  // b comes first (open)
                        
                        // If both have same status, sort by creation date (newest first)
                        return new Date(b.created_at) - new Date(a.created_at);
                      })
                      .slice(0, 5)
                      .map((incident, index) => (
                      <Box
                        key={incident.id}
                        sx={{
                          mb: 2,
                          p: 2,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor:
                            incident.status === 'open'
                              ? 'error.200'
                              : 'grey.200',
                          backgroundColor:
                            incident.status === 'open' ? 'error.50' : 'grey.50',
                          '&:hover': {
                            boxShadow: 2,
                            transform: 'translateY(-1px)',
                          },
                          transition: 'all 0.2s ease-in-out',
                        }}
                      >
                        {/* Header with title and status */}
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="flex-start"
                          mb={1}
                        >
                          <Box sx={{ flex: 1, mr: 2 }}>
                            <Typography
                              variant="subtitle1"
                              fontWeight="600"
                              sx={{
                                color:
                                  incident.status === 'open'
                                    ? 'error.main'
                                    : 'text.primary',
                                '&:hover': { textDecoration: 'underline' },
                              }}
                            >
                              <Link
                                href={`/incidents/${incident.id}`}
                                style={{
                                  textDecoration: 'none',
                                  color: 'inherit',
                                }}
                              >
                                {incident.title}
                              </Link>
                            </Typography>
                          </Box>
                          <Box display="flex" gap={0.5} alignItems="center">
                            {/* Priority indicator */}
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor:
                                  incident.severity === 'critical'
                                    ? '#f44336'
                                    : incident.severity === 'high'
                                      ? '#ff9800'
                                      : incident.severity === 'medium'
                                        ? '#ffeb3b'
                                        : '#4caf50',
                              }}
                            />
                            <Chip
                              label={incident.severity}
                              color={getIncidentSeverityColor(
                                incident.severity
                              )}
                              size="small"
                              variant="filled"
                              sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                            <Chip
                              label={incident.status}
                              color={getIncidentStatusColor(incident.status)}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                          </Box>
                        </Box>

                        {/* Incident details */}
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 1,
                          }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            {incident.organization_name} •{' '}
                            {incident.assigned_to_name || 'Unassigned'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            <NoSSR fallback="Loading...">
                              {new Date(
                                incident.created_at
                              ).toLocaleDateString()}
                            </NoSSR>
                          </Typography>
                        </Box>

                        {/* Action buttons */}
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                          <Button
                            component={Link}
                            href={`/incidents/${incident.id}`}
                            size="small"
                            variant="outlined"
                            sx={{ flex: 1, fontSize: '0.75rem' }}
                          >
                            View Details
                          </Button>
                          {incident.status === 'open' && (
                            <Button
                              component={Link}
                              href={`/incidents/${incident.id}/edit`}
                              size="small"
                              variant="contained"
                              color={
                                incident.severity === 'critical'
                                  ? 'error'
                                  : 'primary'
                              }
                              sx={{ fontSize: '0.75rem' }}
                            >
                              {incident.severity === 'critical'
                                ? 'Urgent'
                                : 'Update'}
                            </Button>
                          )}
                          <Tooltip title="Quick actions">
                            <IconButton size="small" color="primary">
                              ⚡
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    ))}

                    {/* Show more link if there are more incidents */}
                    {filteredIncidents.length > 5 && (
                      <Box sx={{ textAlign: 'center', mt: 2 }}>
                        <Button
                          component={Link}
                          href="/incidents"
                          variant="text"
                          size="small"
                          sx={{ color: 'text.secondary' }}
                        >
                          +{filteredIncidents.length - 5} more incidents
                        </Button>
                      </Box>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* On-Call Schedule & Quick Actions */}
          <Grid item xs={12} md={4}>
            {/* Current On-Call */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
                >
                  <Typography variant="h6">Currently On-Call</Typography>
                  <Tooltip
                    title="Team members currently responsible for responding to incidents. On-call schedules ensure 24/7 coverage for your services."
                    arrow
                    placement="top"
                  >
                    <InfoIcon
                      fontSize="small"
                      color="action"
                      sx={{ cursor: 'help', opacity: 0.7 }}
                    />
                  </Tooltip>
                </Box>
                <Divider sx={{ mb: 2 }} />

                {currentlyOnCall.length === 0 ? (
                  <Box
                    sx={{
                      textAlign: 'center',
                      py: 2,
                      backgroundColor: 'grey.25',
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'grey.200',
                    }}
                  >
                    <PeopleIcon
                      sx={{
                        fontSize: 32,
                        color: 'text.disabled',
                        mb: 1,
                        opacity: 0.6,
                      }}
                    />
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      No on-call team configured
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ opacity: 0.8 }}
                    >
                      Complete setup above to configure 24/7 coverage
                    </Typography>
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

                        {/* Assigned Active Incidents */}
                        {(() => {
                          const assignedIncidents = incidents.filter(
                            incident => 
                              incident.status !== 'resolved' && 
                              incident.assigned_to_id === schedule.user_id
                          );
                          
                          return assignedIncidents.length > 0 ? (
                            <Box sx={{ mb: 1 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontWeight: 500, display: 'block', mb: 0.5 }}
                              >
                                Active Incidents ({assignedIncidents.length})
                              </Typography>
                              <Box sx={{ maxHeight: 120, overflowY: 'auto' }}>
                                {assignedIncidents.slice(0, 3).map((incident) => (
                                  <Box
                                    key={incident.id}
                                    sx={{
                                      p: 1,
                                      mb: 0.5,
                                      backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                      borderRadius: 1,
                                      border: '1px solid',
                                      borderColor: incident.severity === 'critical' ? 'error.300' : 'warning.300',
                                    }}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                      <Box
                                        sx={{
                                          width: 6,
                                          height: 6,
                                          borderRadius: '50%',
                                          backgroundColor:
                                            incident.severity === 'critical'
                                              ? '#f44336'
                                              : incident.severity === 'high'
                                                ? '#ff9800'
                                                : incident.severity === 'medium'
                                                  ? '#ffeb3b'
                                                  : '#4caf50',
                                        }}
                                      />
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          fontWeight: 600,
                                          fontSize: '0.7rem',
                                          color: incident.severity === 'critical' ? 'error.main' : 'text.primary',
                                        }}
                                      >
                                        {incident.title.length > 25 
                                          ? `${incident.title.substring(0, 25)}...` 
                                          : incident.title}
                                      </Typography>
                                    </Box>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ fontSize: '0.65rem' }}
                                    >
                                      {incident.severity.toUpperCase()} • {incident.status.toUpperCase()}
                                    </Typography>
                                  </Box>
                                ))}
                                {assignedIncidents.length > 3 && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ fontSize: '0.65rem', fontStyle: 'italic' }}
                                  >
                                    +{assignedIncidents.length - 3} more incidents
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          ) : (
                            <Box sx={{ mb: 1 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontSize: '0.7rem', fontStyle: 'italic' }}
                              >
                                ✅ No active incidents assigned
                              </Typography>
                            </Box>
                          );
                        })()}

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

                <Box sx={{ mt: 2 }}>
                  <Button
                    component={Link}
                    href="/on-call"
                    variant="outlined"
                    fullWidth
                    startIcon={<PeopleIcon />}
                    size="small"
                    sx={{
                      color: 'text.secondary',
                      borderColor: 'grey.300',
                      '&:hover': {
                        borderColor: 'grey.400',
                        backgroundColor: 'grey.50',
                      },
                    }}
                  >
                    {currentlyOnCall.length > 0
                      ? 'View All Schedules'
                      : 'Manage Schedules'}
                  </Button>
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
                    flexWrap: 'wrap',
                    gap: 1,
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
                  >
                    Quick Actions
                  </Typography>
                  {/* Setup progress indicator */}
                  <Tooltip title="Platform setup completion: Add monitoring and on-call schedules to reach 100%. Complete setup ensures effective incident management.">
                    <Chip
                      label={`${((monitoringStats.total > 0 ? 1 : 0) + (currentlyOnCall.length > 0 ? 1 : 0)) * 50}%`}
                      color={
                        (monitoringStats.total > 0 && currentlyOnCall.length > 0)
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
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      gutterBottom
                    >
                      Platform Setup Progress
                    </Typography>
                    <Tooltip
                      title={
                        <Box>
                          <Typography
                            variant="subtitle2"
                            gutterBottom
                            sx={{ fontWeight: 600 }}
                          >
                            Setup Checklist
                          </Typography>
                          {/* Essential Steps */}
                          <Typography
                            variant="body2"
                            sx={{ mb: 1, fontWeight: 500 }}
                          >
                            Essential Foundation:
                          </Typography>
                          <Box sx={{ ml: 1, mb: 1 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                              }}
                            >
                              {monitoringStats.total > 0 ? '✅' : '⏳'}
                              <span
                                style={{
                                  color:
                                    monitoringStats.total > 0
                                      ? '#4caf50'
                                      : '#ff9800',
                                }}
                              >
                                1. Add Monitoring
                              </span>
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                              }}
                            >
                              {currentlyOnCall.length > 0 ? '✅' : '⏳'}
                              <span
                                style={{
                                  color:
                                    currentlyOnCall.length > 0
                                      ? '#4caf50'
                                      : '#ff9800',
                                }}
                              >
                                2. Set Up On-Call
                              </span>
                            </Typography>
                          </Box>
                          {/* Advanced Step */}
                          {monitoringStats.total > 0 &&
                            currentlyOnCall.length > 0 && (
                              <>
                                <Typography
                                  variant="body2"
                                  sx={{ mb: 1, mt: 1, fontWeight: 500 }}
                                >
                                  Advanced Configuration:
                                </Typography>
                                <Box sx={{ ml: 1 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 1,
                                    }}
                                  >
                                    ⏳{' '}
                                    <span style={{ color: '#2196f3' }}>
                                      3. Create Escalation Policy
                                    </span>
                                  </Typography>
                                </Box>
                              </>
                            )}
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ mt: 1, display: 'block' }}
                          >
                            Complete essential steps for effective incident
                            management
                          </Typography>
                        </Box>
                      }
                      arrow
                      placement="top"
                    >
                      <InfoIcon
                        fontSize="small"
                        color="action"
                        sx={{ cursor: 'help', opacity: 0.7 }}
                      />
                    </Tooltip>
                  </Box>

                  {/* Progress calculation with 3rd milestone */}
                  {(() => {
                    const essentialComplete =
                      (monitoringStats.total > 0 ? 1 : 0) +
                      (currentlyOnCall.length > 0 ? 1 : 0);
                    const totalSteps = essentialComplete === 2 ? 3 : 2; // Add 3rd step when essential complete
                    const progressPercent =
                      (essentialComplete / totalSteps) * 100;

                    return (
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
                              width: `${progressPercent}%`,
                              backgroundColor:
                                essentialComplete === 2 ? '#4caf50' : '#2196f3',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {essentialComplete}/{totalSteps}
                        </Typography>
                        {essentialComplete === 2 && (
                          <Chip
                            label="Ready for Advanced"
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                        )}
                      </Box>
                    );
                  })()}
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
                            Ensure someone is always available to handle
                            incidents 24/7
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
                      p: 3,
                      background:
                        'linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%)',
                      borderRadius: 3,
                      border: '2px solid',
                      borderColor: 'success.main',
                      textAlign: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: -50,
                        left: -50,
                        width: 100,
                        height: 100,
                        background:
                          'radial-gradient(circle, rgba(76, 175, 80, 0.1) 0%, transparent 70%)',
                        animation: 'celebration-pulse 2s ease-in-out infinite',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 1,
                        mb: 2,
                      }}
                    >
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          backgroundColor: 'success.main',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '18px',
                          fontWeight: 'bold',
                        }}
                      >
                        ✓
                      </Box>
                      <Typography
                        variant="h6"
                        color="success.main"
                        sx={{ fontWeight: 700 }}
                      >
                        🎉 Setup Complete!
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      color="success.dark"
                      sx={{ fontWeight: 500, mb: 1 }}
                    >
                      You&apos;ve completed the initial setup! Now you&apos;re
                      ready to respond to incidents 24/7.
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Your monitoring and on-call teams are configured. You can
                      create incidents, manage escalations, and track service
                      health.
                    </Typography>

                    {/* Success metrics */}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 3,
                        mt: 2,
                      }}
                    >
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography
                          variant="h6"
                          color="success.main"
                          sx={{ fontWeight: 600 }}
                        >
                          {monitoringStats.total}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Services Monitored
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography
                          variant="h6"
                          color="success.main"
                          sx={{ fontWeight: 600 }}
                        >
                          {currentlyOnCall.length}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          On-Call Members
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography
                          variant="h6"
                          color="success.main"
                          sx={{ fontWeight: 600 }}
                        >
                          24/7
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Coverage Ready
                        </Typography>
                      </Box>
                    </Box>
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
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
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
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
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
