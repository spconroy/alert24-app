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
import { useSession } from 'next-auth/react';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function MonitoringPage() {
  const [monitoringChecks, setMonitoringChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [executingCheckId, setExecutingCheckId] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedCheck, setSelectedCheck] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCheckId, setDeletingCheckId] = useState(null);
  const [updatingCheckId, setUpdatingCheckId] = useState(null);
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
    setAnchorEl(event.currentTarget);
    setSelectedCheck(check);
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
    if (!selectedCheck) return;

    try {
      setDeletingCheckId(selectedCheck.id);
      setError(null);

      const response = await fetch(`/api/monitoring/${selectedCheck.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete monitoring check');
      }

      // Refresh monitoring data
      await fetchMonitoringData();
      setDeleteDialogOpen(false);
      handleMenuClose();
    } catch (err) {
      console.error('Error deleting monitoring check:', err);
      setError(`Failed to delete check: ${err.message}`);
    } finally {
      setDeletingCheckId(null);
    }
  };

  const handleRunCheckNow = async () => {
    if (!selectedCheck) return;

    handleMenuClose();
    await executeCheck(selectedCheck.id);
  };

  const openDeleteDialog = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
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

  // Calculate stats with safe defaults
  const stats = {
    total: monitoringChecks.length || 0,
    up: monitoringChecks.filter(c => c?.current_status === 'up').length || 0,
    down:
      monitoringChecks.filter(c => c?.current_status === 'down').length || 0,
    warning:
      monitoringChecks.filter(c => c?.current_status === 'warning').length || 0,
    inactive: monitoringChecks.filter(c => !c?.is_active).length || 0,
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
                          <Typography variant="body2" color="text.secondary">
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
                      <TableCell>
                        <IconButton
                          onClick={event => handleMenuOpen(event, check)}
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
        <MenuItem onClick={openDeleteDialog} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete the monitoring check &quot;
            {selectedCheck?.name}&quot;? This action cannot be undone and will
            remove all associated monitoring data.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deletingCheckId === selectedCheck?.id}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteCheck}
            color="error"
            variant="contained"
            disabled={deletingCheckId === selectedCheck?.id}
            startIcon={
              deletingCheckId === selectedCheck?.id ? (
                <CircularProgress size={16} />
              ) : (
                <DeleteIcon />
              )
            }
          >
            {deletingCheckId === selectedCheck?.id ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
