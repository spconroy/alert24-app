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
  Menu,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Tabs,
  Tab,
} from '@mui/material';
import Link from 'next/link';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import PauseIcon from '@mui/icons-material/Pause';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import { useOrganization } from '@/contexts/OrganizationContext';
import MonitoringServiceAssociation from '@/components/MonitoringServiceAssociation';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function MonitoringPage() {
  // Debug: Check if STATUS_PAGE_PROVIDERS is imported correctly
  console.log(
    'STATUS_PAGE_PROVIDERS imported:',
    !!STATUS_PAGE_PROVIDERS,
    Object.keys(STATUS_PAGE_PROVIDERS || {})
  );

  const [monitoringChecks, setMonitoringChecks] = useState([]);
  const [activeIncidents, setActiveIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [executingCheckId, setExecutingCheckId] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedCheck, setSelectedCheck] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCheckId, setDeletingCheckId] = useState(null);
  const [updatingCheckId, setUpdatingCheckId] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const [currentTab, setCurrentTab] = useState(0); // 0 = monitoring checks, 1 = service associations
  const { session, selectedOrganization } = useOrganization();
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (session && selectedOrganization?.id) {
      fetchMonitoringData();
    }
  }, [session, selectedOrganization]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!session || !selectedOrganization?.id) return;

    const interval = setInterval(() => {
      fetchMonitoringData();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [session, selectedOrganization]);

  // Auto-execute pending checks every 2 minutes when page is active
  useEffect(() => {
    if (!session || !selectedOrganization?.id) return;

    const executePendingChecks = async () => {
      try {
        // Call the cron endpoint to execute any due checks
        const response = await fetch('/api/monitoring/cron');
        if (response.ok) {
          const data = await response.json();
          console.log('Auto-execution result:', data);

          // Refresh monitoring data after execution
          if (data.summary && data.summary.executed > 0) {
            setTimeout(() => {
              fetchMonitoringData();
            }, 2000); // Wait 2 seconds then refresh
          }
        }
      } catch (error) {
        console.error('Auto-execution error:', error);
      }
    };

    // Execute immediately if there are pending checks
    const pendingChecks = monitoringChecks.filter(
      check =>
        check.current_status === 'pending' || check.current_status === 'unknown'
    );

    if (pendingChecks.length > 0) {
      console.log(
        `Found ${pendingChecks.length} pending checks, triggering auto-execution...`
      );
      executePendingChecks();
    }

    // Set up interval for auto-execution
    const autoExecInterval = setInterval(executePendingChecks, 120000); // 2 minutes

    return () => clearInterval(autoExecInterval);
  }, [session, selectedOrganization, monitoringChecks]);

  // Debug: Track state changes
  useEffect(() => {
    console.log('🔍 deleteDialogOpen changed:', deleteDialogOpen);
  }, [deleteDialogOpen]);

  useEffect(() => {
    console.log('🔍 deletingCheckId changed:', deletingCheckId);
  }, [deletingCheckId]);

  useEffect(() => {
    console.log(
      '🔍 selectedCheck changed:',
      selectedCheck?.id,
      selectedCheck?.name
    );
  }, [selectedCheck]);

  const fetchMonitoringData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Safety check: Don't proceed without organization
      if (!selectedOrganization?.id) {
        console.log('⚠️ No organization selected, skipping monitoring fetch');
        setMonitoringChecks([]);
        setActiveIncidents([]);
        return;
      }

      const params = new URLSearchParams();
      params.append('organization_id', selectedOrganization.id);

      console.log(
        `🔍 Fetching monitoring data for org: ${selectedOrganization.id}`
      );
      console.log('Selected organization:', selectedOrganization);

      // Fetch monitoring checks
      const response = await fetch(`/api/monitoring?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch monitoring checks');
      }

      const data = await response.json();
      console.log('Monitoring API response:', data);

      // Debug: Check if status_page_config is present in browser
      const checks = data.monitoring_checks || [];
      const statusPageChecks = checks.filter(
        check => check.check_type === 'status_page'
      );
      if (statusPageChecks.length > 0) {
        console.log(
          '🔍 Status page checks received in browser:',
          statusPageChecks.map(check => ({
            name: check.name,
            check_type: check.check_type,
            has_status_page_config: !!check.status_page_config,
            status_page_config: check.status_page_config,
          }))
        );

        console.log('🔍 Full raw API response:', data);
        console.log(
          '🔍 First status page check full object:',
          statusPageChecks[0]
        );
        console.log(
          '🔍 Does first check have status_page_config?',
          !!statusPageChecks[0].status_page_config
        );
        console.log(
          '🔍 status_page_config value:',
          statusPageChecks[0].status_page_config
        );
        console.log(
          '🔍 All keys in first check:',
          Object.keys(statusPageChecks[0])
        );
      }

      setMonitoringChecks(checks);
      console.log('Set monitoring checks:', checks);

      // Fetch active incidents
      const incidentParams = new URLSearchParams();
      if (selectedOrganization?.id) {
        incidentParams.append('organization_id', selectedOrganization.id);
      }
      incidentParams.append('status', 'open');
      incidentParams.append('status', 'investigating');
      incidentParams.append('status', 'identified');
      incidentParams.append('status', 'monitoring');

      const incidentsResponse = await fetch(
        `/api/incidents?${incidentParams.toString()}`
      );
      if (incidentsResponse.ok) {
        const incidentsData = await incidentsResponse.json();
        setActiveIncidents(incidentsData.incidents || []);
      } else {
        setActiveIncidents([]);
      }
    } catch (err) {
      console.error('Error fetching monitoring data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const executeCheck = async checkId => {
    try {
      setExecutingCheckId(checkId);
      setError(null);

      const response = await fetch('/api/monitoring/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checkId: checkId,
          organizationId: selectedOrganization?.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to execute check');
      }

      const data = await response.json();
      console.log('Check execution result:', data);

      // Refresh monitoring data to show updated status
      await fetchMonitoringData();

      // Show success message
      setError(null);
    } catch (err) {
      console.error('Error executing check:', err);
      setError(`Failed to execute check: ${err.message}`);
    } finally {
      setExecutingCheckId(null);
    }
  };

  const executeAllChecks = async () => {
    if (!selectedOrganization?.id) {
      setError('Please select an organization');
      return;
    }

    try {
      setExecuting(true);
      setError(null);

      const response = await fetch('/api/monitoring/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          executeAll: true,
          organizationId: selectedOrganization.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to execute checks');
      }

      const data = await response.json();
      console.log('Bulk execution result:', data);

      // Refresh monitoring data to show updated statuses
      await fetchMonitoringData();

      // Show success message
      setError(null);
    } catch (err) {
      console.error('Error executing checks:', err);
      setError(`Failed to execute checks: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  };

  const handleMenuOpen = (event, check) => {
    console.log('🔗 Menu opened for check:', check?.id, check?.name);
    setAnchorEl(event.currentTarget);
    setSelectedCheck(check);
    console.log('🔗 Set selectedCheck to:', check);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedCheck(null);
  };

  const handleToggleCheck = async () => {
    if (!selectedCheck) return;

    try {
      setUpdatingCheckId(selectedCheck.id);
      setError(null);

      const response = await fetch(`/api/monitoring/${selectedCheck.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: !selectedCheck.is_active,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update monitoring check');
      }

      // Refresh monitoring data
      await fetchMonitoringData();
      handleMenuClose();
    } catch (err) {
      console.error('Error updating monitoring check:', err);
      setError(`Failed to update check: ${err.message}`);
    } finally {
      setUpdatingCheckId(null);
    }
  };

  const handleDeleteCheck = async () => {
    console.log('🎯 handleDeleteCheck called');
    console.log('🎯 selectedCheck:', selectedCheck);
    console.log('🎯 deleteDialogOpen:', deleteDialogOpen);

    if (!selectedCheck) {
      console.error('❌ No check selected for deletion');
      return;
    }

    console.log(
      '🗑️ Starting delete process for check:',
      selectedCheck.id,
      selectedCheck.name
    );

    try {
      setDeletingCheckId(selectedCheck.id);
      setError(null);

      console.log(
        '📡 Making DELETE request to:',
        `/api/monitoring/${selectedCheck.id}`
      );

      const response = await fetch(`/api/monitoring/${selectedCheck.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorData = {
            error: `HTTP ${response.status}: ${response.statusText}`,
          };
        }
        console.error('❌ Delete failed:', errorData);
        throw new Error(errorData.error || 'Failed to delete monitoring check');
      }

      const result = await response.json();
      console.log('✅ Delete successful:', result);

      // Refresh monitoring data
      console.log('🔄 Refreshing monitoring data...');
      await fetchMonitoringData();

      console.log('🔒 Closing dialog and clearing selected check...');
      setDeleteDialogOpen(false);
      setSelectedCheck(null); // Clear the selected check
      setAnchorEl(null); // Close any open menus

      console.log('✅ Delete process completed successfully');
    } catch (err) {
      console.error('❌ Error deleting monitoring check:', err);
      setError(`Failed to delete check: ${err.message}`);
      // Don't close dialog on error so user can retry
    } finally {
      console.log('🏁 Clearing deleting state');
      setDeletingCheckId(null);
    }
  };

  const handleRunCheckNow = async () => {
    if (!selectedCheck) return;

    handleMenuClose();
    await executeCheck(selectedCheck.id);
  };

  const handleEditCheck = () => {
    if (!selectedCheck) return;
    handleMenuClose();
    // Navigate to the edit page for the selected check
    router.push(`/monitoring/edit/${selectedCheck.id}`);
  };

  const openDeleteDialog = () => {
    console.log('🔓 Opening delete dialog');
    console.log('🔓 Selected check:', selectedCheck);
    console.log('🔓 Current deleteDialogOpen state:', deleteDialogOpen);

    if (!selectedCheck) {
      console.error('❌ Cannot open delete dialog: no check selected');
      return;
    }

    setDeleteDialogOpen(true);
    console.log('🔓 Set deleteDialogOpen to true');
    // Don't call handleMenuClose here - let the dialog handle closing the menu
    setAnchorEl(null); // Just close the menu without clearing selectedCheck
  };

  const getStatusIcon = status => {
    switch (status) {
      case 'up':
        return <CheckCircleIcon color="success" />;
      case 'down':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'inactive':
        return <PauseIcon color="disabled" />;
      case 'pending':
        return <CircularProgress size={20} color="info" />;
      case 'unknown':
      default:
        return <WarningIcon color="disabled" />;
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
      case 'inactive':
        return 'default';
      case 'pending':
        return 'info';
      case 'unknown':
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
      case 'status_page':
        return 'success';
      default:
        return 'default';
    }
  };

  const getTargetDisplay = check => {
    console.log('🎯 getTargetDisplay called for:', check.name, {
      check_type: check.check_type,
      target_url: check.target_url,
      status_page_url: check.status_page_url,
      all_keys: Object.keys(check),
    });

    // For status page checks, use the pre-populated status_page_url from API
    if (check.check_type === 'status_page' && check.status_page_url) {
      console.log('✅ Status page check with URL:', {
        checkName: check.name,
        statusPageUrl: check.status_page_url,
      });
      return check.status_page_url;
    }

    console.log(
      '📄 Regular check, returning target_url:',
      check.target_url || 'N/A'
    );
    // For regular checks, show the target URL
    return check.target_url || 'N/A';
  };

  const formatResponseTime = timeMs => {
    if (!timeMs) return 'N/A';
    if (timeMs < 1000) return `${timeMs}ms`;
    return `${(timeMs / 1000).toFixed(2)}s`;
  };

  const formatNextCheckTime = (nextCheckTime, isActive) => {
    if (!isActive) return 'Paused';
    if (!nextCheckTime) return 'Unknown';

    // Prevent hydration issues by avoiding dynamic time calculations during SSR
    if (!isClient) {
      return 'Loading...';
    }

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

  // Calculate stats with safe defaults
  const stats = {
    total: monitoringChecks.length || 0,
    up: monitoringChecks.filter(c => c?.current_status === 'up').length || 0,
    down:
      monitoringChecks.filter(c => c?.current_status === 'down').length || 0,
    warning:
      monitoringChecks.filter(c => c?.current_status === 'warning').length || 0,
    inactive:
      monitoringChecks.filter(c => c?.current_status === 'inactive').length ||
      0,
  };

  return (
    <ProtectedRoute>
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
              Monitor your services and infrastructure health
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
            <Tooltip title="Execute All Checks">
              <IconButton
                onClick={executeAllChecks}
                color="success"
                disabled={executing || !selectedOrganization}
              >
                <PlayArrowIcon />
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

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={currentTab}
            onChange={(event, newValue) => setCurrentTab(newValue)}
          >
            <Tab label="Monitoring Checks" />
            <Tab label="Service Associations" />
          </Tabs>
        </Box>

        {/* Tab Content */}
        {currentTab === 0 ? (
          // Monitoring Checks Tab
          <>
            {/* Stats Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={2.4}>
                <Card>
                  <CardContent>
                    <Typography
                      variant="h6"
                      color="text.secondary"
                      gutterBottom
                    >
                      Total Monitors
                    </Typography>
                    <Typography variant="h3" color="primary">
                      {stats.total}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={2.4}>
                <Card>
                  <CardContent>
                    <Typography
                      variant="h6"
                      color="text.secondary"
                      gutterBottom
                    >
                      Up
                    </Typography>
                    <Typography variant="h3" color="success.main">
                      {stats.up}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={2.4}>
                <Card>
                  <CardContent>
                    <Typography
                      variant="h6"
                      color="text.secondary"
                      gutterBottom
                    >
                      Down
                    </Typography>
                    <Typography variant="h3" color="error.main">
                      {stats.down}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={2.4}>
                <Card>
                  <CardContent>
                    <Typography
                      variant="h6"
                      color="text.secondary"
                      gutterBottom
                    >
                      Warning
                    </Typography>
                    <Typography variant="h3" color="warning.main">
                      {stats.warning}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={2.4}>
                <Card
                  component={Link}
                  href="/incidents"
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
                      Active Incidents
                    </Typography>
                    <Typography
                      variant="h3"
                      color={
                        activeIncidents.length > 0
                          ? 'error.main'
                          : 'success.main'
                      }
                    >
                      {activeIncidents.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Click to view details
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
                    <Typography
                      variant="h6"
                      color="text.secondary"
                      gutterBottom
                    >
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
                          <TableCell>SSL Certificate</TableCell>
                          <TableCell>Location</TableCell>
                          <TableCell>Response Time</TableCell>
                          <TableCell>Last Check</TableCell>
                          <TableCell>Next Check</TableCell>
                          <TableCell>Organization</TableCell>
                          <TableCell>Actions</TableCell>
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
                              <Typography
                                variant="subtitle2"
                                fontWeight="medium"
                              >
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
                                {getTargetDisplay(check)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {check.ssl_check_enabled ? (
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Chip
                                    label={
                                      check.ssl_status === 'valid'
                                        ? 'Valid'
                                        : check.ssl_status === 'expired'
                                          ? 'Expired'
                                          : check.ssl_status === 'expiring'
                                            ? 'Expiring Soon'
                                            : 'Pending'
                                    }
                                    color={
                                      check.ssl_status === 'valid'
                                        ? 'success'
                                        : check.ssl_status === 'expired'
                                          ? 'error'
                                          : check.ssl_status === 'expiring'
                                            ? 'warning'
                                            : 'default'
                                    }
                                    size="small"
                                    variant="outlined"
                                  />
                                  {check.ssl_days_until_expiry !== null && (
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      {check.ssl_days_until_expiry > 0
                                        ? `${check.ssl_days_until_expiry}d`
                                        : 'Expired'}
                                    </Typography>
                                  )}
                                </Box>
                              ) : (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  Disabled
                                </Typography>
                              )}
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
                                  ? new Date(
                                      check.last_check_time
                                    ).toLocaleString()
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
                            <TableCell>
                              <IconButton
                                onClick={event => {
                                  console.log(
                                    '🔗 Actions button clicked for check:',
                                    check.id,
                                    check.name
                                  );
                                  handleMenuOpen(event, check);
                                }}
                                size="small"
                                disabled={
                                  executingCheckId === check.id ||
                                  updatingCheckId === check.id ||
                                  deletingCheckId === check.id
                                }
                              >
                                {executingCheckId === check.id ||
                                updatingCheckId === check.id ||
                                deletingCheckId === check.id ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <MoreVertIcon />
                                )}
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>

            {/* Actions Menu */}
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <MenuItem onClick={handleRunCheckNow}>
                <PlayArrowIcon sx={{ mr: 1 }} />
                Run Check Now
              </MenuItem>
              <MenuItem onClick={handleToggleCheck}>
                {selectedCheck?.is_active ? (
                  <>
                    <PauseIcon sx={{ mr: 1 }} />
                    Disable
                  </>
                ) : (
                  <>
                    <PlayCircleOutlineIcon sx={{ mr: 1 }} />
                    Enable
                  </>
                )}
              </MenuItem>
              <MenuItem onClick={handleEditCheck}>
                <EditIcon sx={{ mr: 1 }} />
                Edit
              </MenuItem>
              <MenuItem
                onClick={e => {
                  console.log('🖱️ Delete menu item clicked');
                  console.log('🖱️ Event:', e);
                  console.log('🖱️ selectedCheck:', selectedCheck);
                  openDeleteDialog();
                }}
                sx={{ color: 'error.main' }}
              >
                <DeleteIcon sx={{ mr: 1 }} />
                Delete
              </MenuItem>
            </Menu>

            {/* Delete Confirmation Dialog */}
            <Dialog
              open={deleteDialogOpen}
              onClose={() => {
                console.log('🔒 Dialog onClose triggered');
                console.log(
                  '🔒 Current deleteDialogOpen state:',
                  deleteDialogOpen
                );
                setDeleteDialogOpen(false);
                setSelectedCheck(null); // Clear the selected check
                console.log('🔒 Dialog closed and selectedCheck cleared');
              }}
              aria-labelledby="delete-dialog-title"
              aria-describedby="delete-dialog-description"
              maxWidth="sm"
              fullWidth
            >
              <DialogTitle
                id="delete-dialog-title"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  pb: 1,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    backgroundColor: 'error.light',
                    color: 'error.contrastText',
                  }}
                >
                  <DeleteIcon />
                </Box>
                <Box>
                  <Typography variant="h6" component="div">
                    Delete Monitoring Check
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    This action cannot be undone
                  </Typography>
                </Box>
              </DialogTitle>
              <DialogContent sx={{ pt: 2 }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body1" gutterBottom>
                    Are you sure you want to delete this monitoring check?
                  </Typography>

                  {selectedCheck && (
                    <Box
                      sx={{
                        mt: 2,
                        p: 2,
                        backgroundColor: 'grey.50',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'grey.200',
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        fontWeight="medium"
                        gutterBottom
                      >
                        {selectedCheck.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        gutterBottom
                      >
                        {selectedCheck.target_url}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Chip
                          label={selectedCheck.check_type?.toUpperCase()}
                          size="small"
                          variant="outlined"
                          color="primary"
                        />
                        <Chip
                          label={selectedCheck.current_status || 'Unknown'}
                          size="small"
                          color={getStatusColor(selectedCheck.current_status)}
                        />
                      </Box>
                    </Box>
                  )}
                </Box>

                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    This will permanently remove the monitoring check and all
                    associated historical data, including check results and
                    incident records.
                  </Typography>
                </Alert>
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 3, pt: 1, gap: 1 }}>
                <Button
                  onClick={() => {
                    console.log('❌ Cancel button clicked');
                    setDeleteDialogOpen(false);
                    setSelectedCheck(null); // Clear the selected check
                    console.log(
                      '❌ Dialog cancelled and selectedCheck cleared'
                    );
                  }}
                  disabled={deletingCheckId === selectedCheck?.id}
                  variant="outlined"
                  size="large"
                  sx={{ minWidth: 100 }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={e => {
                    console.log('🖱️ Delete button clicked');
                    console.log('🔍 Event:', e);
                    console.log('🔍 Current selectedCheck:', selectedCheck);
                    console.log('🔍 Current deletingCheckId:', deletingCheckId);
                    console.log('🔍 Delete dialog open:', deleteDialogOpen);

                    try {
                      handleDeleteCheck();
                    } catch (error) {
                      console.error('🔥 Error in delete handler:', error);
                    }
                  }}
                  color="error"
                  variant="contained"
                  disabled={deletingCheckId === selectedCheck?.id}
                  startIcon={
                    deletingCheckId === selectedCheck?.id ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <DeleteIcon />
                    )
                  }
                  size="large"
                  sx={{ minWidth: 120 }}
                >
                  {deletingCheckId === selectedCheck?.id
                    ? 'Deleting...'
                    : 'Delete Check'}
                </Button>
              </DialogActions>
            </Dialog>
          </>
        ) : // Service Associations Tab
        selectedOrganization ? (
          <MonitoringServiceAssociation
            organizationId={selectedOrganization.id}
          />
        ) : (
          <Alert severity="info">
            Please select an organization from the navbar to view service
            associations.
          </Alert>
        )}
      </Box>
    </ProtectedRoute>
  );
}
