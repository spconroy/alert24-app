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
  IconButton,
  Tooltip,
  Avatar,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Menu,
  MenuItem,
} from '@mui/material';
import Link from 'next/link';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonIcon from '@mui/icons-material/Person';
import DeleteIcon from '@mui/icons-material/Delete';
import { useOrganization } from '@/contexts/OrganizationContext';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function OnCallPage() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const { session, selectedOrganization } = useOrganization();

  useEffect(() => {
    if (session && selectedOrganization?.id) {
      fetchSchedules();
    }
  }, [session, selectedOrganization]);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);

      // Safety check: Don't proceed without organization
      if (!selectedOrganization?.id) {
        console.log('⚠️ No organization selected, skipping schedule fetch');
        setSchedules([]);
        return;
      }

      const params = new URLSearchParams();
      params.append('organization_id', selectedOrganization.id);

      console.log(`📅 Fetching schedules for org: ${selectedOrganization.id}`);
      const response = await fetch(
        `/api/on-call-schedules?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch on-call schedules');
      }

      const data = await response.json();
      setSchedules(data.on_call_schedules || []);
    } catch (err) {
      console.error('Error fetching schedules:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSchedule = async (scheduleId, currentStatus) => {
    try {
      const response = await fetch(`/api/on-call-schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: !currentStatus,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update schedule status');
      }

      // Refresh schedules
      fetchSchedules();
    } catch (err) {
      console.error('Error toggling schedule:', err);
      setError(err.message);
    }
  };

  const handleActionClick = (event, schedule) => {
    setActionMenuAnchor(event.currentTarget);
    setSelectedSchedule(schedule);
  };

  const handleActionClose = () => {
    setActionMenuAnchor(null);
    setSelectedSchedule(null);
  };

  const handleDeleteSchedule = async scheduleId => {
    if (
      !confirm(
        'Are you sure you want to delete this on-call schedule? This action cannot be undone.'
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/on-call-schedules/${scheduleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete schedule');
      }

      // Refresh schedules after successful deletion
      fetchSchedules();
      handleActionClose();
    } catch (err) {
      console.error('Error deleting schedule:', err);
      setError(err.message);
    }
  };

  const formatDateTime = dateString => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getScheduleStatus = schedule => {
    if (!schedule.is_active) return { label: 'Inactive', color: 'default' };
    if (schedule.current_on_call_member)
      return { label: 'Active', color: 'success' };
    return { label: 'Configured', color: 'info' };
  };

  const getCurrentOnCallName = schedule => {
    if (!schedule.current_on_call_member) return 'None';
    return (
      schedule.current_on_call_member.name ||
      schedule.current_on_call_member.email
    );
  };

  // Calculate stats
  const stats = {
    total: schedules.length,
    active: schedules.filter(s => s.is_active).length,
    withOnCall: schedules.filter(s => s.is_active && s.current_on_call_member)
      .length,
    inactive: schedules.filter(s => !s.is_active).length,
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
              On-Call Schedules
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage team on-call rotations and schedules
            </Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchSchedules} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              component={Link}
              href="/on-call/new"
              variant="contained"
              startIcon={<AddIcon />}
              color="primary"
            >
              Add Schedule
            </Button>
          </Box>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight="200px"
          >
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Stats Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography
                      variant="h6"
                      color="text.secondary"
                      gutterBottom
                    >
                      Total Schedules
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
                    <Typography
                      variant="h6"
                      color="text.secondary"
                      gutterBottom
                    >
                      Active
                    </Typography>
                    <Typography variant="h3" color="success.main">
                      {stats.active}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography
                      variant="h6"
                      color="text.secondary"
                      gutterBottom
                    >
                      With On-Call
                    </Typography>
                    <Typography variant="h3" color="info.main">
                      {stats.withOnCall}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography
                      variant="h6"
                      color="text.secondary"
                      gutterBottom
                    >
                      Inactive
                    </Typography>
                    <Typography variant="h3" color="warning.main">
                      {stats.inactive}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Schedules Table */}
            <Card>
              <CardContent sx={{ p: 0 }}>
                {schedules.length === 0 ? (
                  <Box textAlign="center" py={6}>
                    <Typography
                      variant="h6"
                      color="text.secondary"
                      gutterBottom
                    >
                      No on-call schedules found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mb={3}>
                      Create your first on-call schedule to start managing
                      rotations.
                    </Typography>
                    <Button
                      component={Link}
                      href="/on-call/new"
                      variant="contained"
                      startIcon={<AddIcon />}
                      color="primary"
                    >
                      Add Schedule
                    </Button>
                  </Box>
                ) : (
                  <TableContainer component={Paper} elevation={0}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Schedule Name</TableCell>
                          <TableCell>Currently On-Call</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Created</TableCell>
                          <TableCell align="center">Active</TableCell>
                          <TableCell align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {schedules.map(schedule => {
                          const status = getScheduleStatus(schedule);
                          return (
                            <TableRow key={schedule.id} hover>
                              <TableCell>
                                <Box>
                                  <Typography
                                    variant="body1"
                                    fontWeight="medium"
                                  >
                                    {schedule.name || 'Unnamed Schedule'}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {schedule.description || 'No description'}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Avatar sx={{ width: 32, height: 32 }}>
                                    {getCurrentOnCallName(schedule).charAt(0)}
                                  </Avatar>
                                  <Box>
                                    <Typography variant="body2">
                                      {getCurrentOnCallName(schedule)}
                                    </Typography>
                                    {schedule.current_on_call_member && (
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                      >
                                        {schedule.current_on_call_member.email}
                                      </Typography>
                                    )}
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={status.label}
                                  color={status.color}
                                  size="small"
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {formatDateTime(schedule.created_at)}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Switch
                                  checked={schedule.is_active}
                                  onChange={() =>
                                    handleToggleSchedule(
                                      schedule.id,
                                      schedule.is_active
                                    )
                                  }
                                  color="primary"
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Tooltip title="Edit Schedule">
                                  <IconButton
                                    component={Link}
                                    href={`/on-call/${schedule.id}/edit`}
                                    size="small"
                                    color="primary"
                                  >
                                    <EditIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="More actions">
                                  <IconButton
                                    size="small"
                                    onClick={e =>
                                      handleActionClick(e, schedule)
                                    }
                                  >
                                    <MoreVertIcon />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>

            {/* Action Menu */}
            <Menu
              anchorEl={actionMenuAnchor}
              open={Boolean(actionMenuAnchor)}
              onClose={handleActionClose}
            >
              <MenuItem
                component={Link}
                href={`/on-call/${selectedSchedule?.id}/edit`}
                onClick={handleActionClose}
              >
                <EditIcon sx={{ mr: 1 }} />
                Edit Schedule
              </MenuItem>
              <MenuItem
                onClick={() => {
                  if (selectedSchedule) {
                    handleToggleSchedule(
                      selectedSchedule.id,
                      selectedSchedule.is_active
                    );
                  }
                  handleActionClose();
                }}
              >
                {selectedSchedule?.is_active ? 'Disable' : 'Enable'} Schedule
              </MenuItem>
              <MenuItem
                onClick={() => {
                  if (selectedSchedule) {
                    handleDeleteSchedule(selectedSchedule.id);
                  }
                }}
                sx={{ color: 'error.main' }}
              >
                <DeleteIcon sx={{ mr: 1 }} />
                Delete Schedule
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>
    </ProtectedRoute>
  );
}
