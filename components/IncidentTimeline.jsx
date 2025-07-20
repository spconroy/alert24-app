'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Avatar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Paper,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
// Timeline components can be problematic, using simple layout instead
// import {
//   Timeline,
//   TimelineItem,
//   TimelineSeparator,
//   TimelineDot,
//   TimelineConnector,
//   TimelineContent,
//   TimelineOppositeContent,
// } from '@mui/lab';
import NoSSR from './NoSSR';
import {
  Add as AddIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Build as BuildIcon,
} from '@mui/icons-material';

export default function IncidentTimeline({
  incidentId,
  incident,
  onIncidentUpdate,
}) {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addUpdateDialogOpen, setAddUpdateDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publicUpdatesMap, setPublicUpdatesMap] = useState(new Map());
  const [affectedServices, setAffectedServices] = useState([]);

  // Form state for new update
  const [newUpdate, setNewUpdate] = useState({
    message: '',
    status: incident?.status || 'investigating',
    update_type: 'update',
    visible_to_subscribers: true,
    post_as_public_update: false,
    update_service_status: false,
    service_status_updates: {},
  });

  useEffect(() => {
    if (incidentId) {
      fetchUpdates();
      fetchAffectedServices();
      // Load public updates map from localStorage
      const savedPublicUpdates = localStorage.getItem(`publicUpdates_${incidentId}`);
      if (savedPublicUpdates) {
        try {
          const parsed = JSON.parse(savedPublicUpdates);
          setPublicUpdatesMap(new Map(Object.entries(parsed)));
        } catch (e) {
          console.error('Error parsing saved public updates:', e);
        }
      }
    }
  }, [incidentId, incident]);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/incidents/${incidentId}/updates`);
      if (response.ok) {
        const data = await response.json();
        setUpdates(data.updates || []);
      } else {
        throw new Error('Failed to fetch incident updates');
      }
    } catch (err) {
      console.error('Error fetching updates:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAffectedServices = async () => {
    if (!incident?.affected_services || incident.affected_services.length === 0) {
      setAffectedServices([]);
      return;
    }

    try {
      // Fetch all services for the organization to resolve service names to full service objects
      const response = await fetch('/api/services');
      if (response.ok) {
        const data = await response.json();
        const allServices = data.services || [];
        
        // Map affected service names/IDs to full service objects
        const matchedServices = incident.affected_services.map(serviceName => {
          // First try to find by name, then by ID
          const service = allServices.find(s => s.name === serviceName || s.id === serviceName);
          return service || { 
            id: serviceName, 
            name: serviceName, 
            status: 'operational',
            isUnknown: true 
          };
        });
        
        setAffectedServices(matchedServices);
        
        // Initialize service status updates with current status
        const initialStatusUpdates = {};
        matchedServices.forEach(service => {
          initialStatusUpdates[service.id] = service.status;
        });
        setNewUpdate(prev => ({
          ...prev,
          service_status_updates: initialStatusUpdates
        }));
      }
    } catch (err) {
      console.error('Error fetching affected services:', err);
    }
  };

  const handleAddUpdate = async () => {
    if (!newUpdate.message.trim()) {
      setError('Update message is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // First, add the incident update
      const updatePayload = { ...newUpdate };
      delete updatePayload.update_service_status;
      delete updatePayload.service_status_updates;

      const response = await fetch(`/api/incidents/${incidentId}/updates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Save public status to localStorage if it was marked as public
        if (newUpdate.post_as_public_update) {
          const newMap = new Map(publicUpdatesMap);
          newMap.set(data.update.id, true);
          setPublicUpdatesMap(newMap);
          
          // Persist to localStorage
          const mapObj = Object.fromEntries(newMap);
          localStorage.setItem(`publicUpdates_${incidentId}`, JSON.stringify(mapObj));
        }

        // Update service statuses if requested
        if (newUpdate.update_service_status && Object.keys(newUpdate.service_status_updates).length > 0) {
          await updateServiceStatuses();
        }
        
        setUpdates(prev => [data.update, ...prev]);
        resetUpdateForm();
        setAddUpdateDialogOpen(false);

        // Notify parent component if status changed
        if (newUpdate.status !== incident?.status && onIncidentUpdate) {
          onIncidentUpdate();
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add update');
      }
    } catch (err) {
      console.error('Error adding update:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateServiceStatuses = async () => {
    const statusUpdatePromises = Object.entries(newUpdate.service_status_updates).map(async ([serviceId, newStatus]) => {
      const service = affectedServices.find(s => s.id === serviceId);
      if (service && service.status !== newStatus && !service.isUnknown) {
        try {
          const response = await fetch(`/api/services/${serviceId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus }),
          });
          
          if (!response.ok) {
            console.error(`Failed to update status for service ${typeof service.name === 'string' ? service.name : service.id}`);
          }
        } catch (err) {
          console.error(`Error updating service ${typeof service.name === 'string' ? service.name : service.id}:`, err);
        }
      }
    });

    await Promise.all(statusUpdatePromises);
  };

  const resetUpdateForm = () => {
    const initialStatusUpdates = {};
    affectedServices.forEach(service => {
      initialStatusUpdates[service.id] = service.status;
    });
    
    setNewUpdate({
      message: '',
      status: incident?.status || 'investigating',
      update_type: 'update',
      visible_to_subscribers: true,
      post_as_public_update: false,
      update_service_status: false,
      service_status_updates: initialStatusUpdates,
    });
  };

  const getStatusIcon = status => {
    switch (status) {
      case 'investigating':
        return <InfoIcon color="info" />;
      case 'identified':
        return <WarningIcon color="warning" />;
      case 'monitoring':
        return <CheckCircleIcon color="primary" />;
      case 'resolved':
        return <CheckCircleIcon color="success" />;
      case 'postmortem':
        return <BuildIcon color="secondary" />;
      default:
        return <InfoIcon color="default" />;
    }
  };

  const getStatusColor = status => {
    switch (status) {
      case 'investigating':
        return 'info';
      case 'identified':
        return 'warning';
      case 'monitoring':
        return 'primary';
      case 'resolved':
        return 'success';
      case 'postmortem':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getUpdateTypeColor = updateType => {
    switch (updateType) {
      case 'status_change':
        return 'primary';
      case 'resolution':
        return 'success';
      case 'escalation':
        return 'warning';
      case 'postmortem':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const formatDate = dateString => {
    return new Date(dateString).toLocaleString();
  };

  const formatRelativeTime = dateString => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.abs(now - date) / 36e5;

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  const getServiceStatusColor = status => {
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
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h6" component="h3">
          Incident Timeline
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {updates.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No updates yet. Add the first update to start tracking incident
            progress.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {updates.map((update, index) => (
            <Card key={update.id} sx={{ mb: 1 }}>
              <CardContent sx={{ pb: '16px !important' }}>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  mb={1}
                >
                  <Box display="flex" alignItems="center" gap={1}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: getStatusColor(update.status) + '.main' }}>
                      {getStatusIcon(update.status)}
                    </Avatar>
                    <Box>
                      <Chip
                        label={
                          update.status.charAt(0).toUpperCase() +
                          update.status.slice(1)
                        }
                        color={getStatusColor(update.status)}
                        size="small"
                        sx={{ mr: 1 }}
                      />
                      <Chip
                        label={
                          update.update_type?.charAt(0).toUpperCase() +
                            update.update_type?.slice(1) || 'Update'
                        }
                        color={getUpdateTypeColor(update.update_type)}
                        variant="outlined"
                        size="small"
                      />
                    </Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    <NoSSR fallback="Loading...">
                      {formatDate(update.created_at)}
                    </NoSSR>
                  </Typography>
                </Box>

                    <Typography variant="body1" sx={{ mb: 2 }}>
                      {update.message}
                    </Typography>

                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar sx={{ width: 24, height: 24 }}>
                        <PersonIcon fontSize="small" />
                      </Avatar>
                      <Typography variant="caption" color="text.secondary">
                        {update.posted_by_user?.name || 'Unknown User'}
                      </Typography>
                      {(update.visible_to_public || publicUpdatesMap.get(update.id)) && (
                        <Chip
                          label="Public"
                          size="small"
                          variant="outlined"
                          color="primary"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>
                  </CardContent>
                </Card>
          ))}
        </Box>
      )}

      {/* Add Update Dialog */}
      <Dialog
        open={addUpdateDialogOpen}
        onClose={() => setAddUpdateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add Incident Update</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              label="Update Message"
              multiline
              rows={4}
              fullWidth
              value={newUpdate.message}
              onChange={e =>
                setNewUpdate(prev => ({ ...prev, message: e.target.value }))
              }
              sx={{ mb: 3 }}
              required
            />

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={newUpdate.status}
                label="Status"
                onChange={e =>
                  setNewUpdate(prev => ({ ...prev, status: e.target.value }))
                }
              >
                <MenuItem value="investigating">Investigating</MenuItem>
                <MenuItem value="identified">Identified</MenuItem>
                <MenuItem value="monitoring">Monitoring</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
                <MenuItem value="postmortem">Post-mortem</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Update Type</InputLabel>
              <Select
                value={newUpdate.update_type}
                label="Update Type"
                onChange={e =>
                  setNewUpdate(prev => ({
                    ...prev,
                    update_type: e.target.value,
                  }))
                }
              >
                <MenuItem value="update">General Update</MenuItem>
                <MenuItem value="status_change">Status Change</MenuItem>
                <MenuItem value="resolution">Resolution</MenuItem>
                <MenuItem value="escalation">Escalation</MenuItem>
                <MenuItem value="postmortem">Post-mortem</MenuItem>
              </Select>
            </FormControl>

            {/* Visibility control removed - not supported by current database schema */}
            
            {/* Public Update Checkbox */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={newUpdate.post_as_public_update}
                  onChange={e =>
                    setNewUpdate(prev => ({
                      ...prev,
                      post_as_public_update: e.target.checked,
                    }))
                  }
                  color="primary"
                />
              }
              label="Post as public update to affected services"
              sx={{ mt: 2 }}
            />

            {/* Service Status Update Section */}
            {affectedServices.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={newUpdate.update_service_status}
                      onChange={e =>
                        setNewUpdate(prev => ({
                          ...prev,
                          update_service_status: e.target.checked,
                        }))
                      }
                      color="primary"
                    />
                  }
                  label="Update status of affected services"
                  sx={{ mb: 2 }}
                />

                {newUpdate.update_service_status && (
                  <Box sx={{ ml: 4, mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Service Status Updates
                    </Typography>
                    {affectedServices.map(service => (
                      <Box key={service.id} sx={{ mb: 2 }}>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Chip
                            label={typeof service.name === 'string' ? service.name : service.id || 'Unknown Service'}
                            color={getServiceStatusColor(service.status)}
                            size="small"
                            sx={{ minWidth: 120 }}
                          />
                          {service.isUnknown && (
                            <Typography variant="caption" color="text.secondary">
                              (Unknown service - cannot update)
                            </Typography>
                          )}
                          {!service.isUnknown && (
                            <FormControl size="small" sx={{ minWidth: 140 }}>
                              <InputLabel>New Status</InputLabel>
                              <Select
                                value={newUpdate.service_status_updates[service.id] || service.status}
                                label="New Status"
                                onChange={e =>
                                  setNewUpdate(prev => ({
                                    ...prev,
                                    service_status_updates: {
                                      ...prev.service_status_updates,
                                      [service.id]: e.target.value,
                                    },
                                  }))
                                }
                              >
                                <MenuItem value="operational">Operational</MenuItem>
                                <MenuItem value="degraded">Degraded</MenuItem>
                                <MenuItem value="down">Down</MenuItem>
                                <MenuItem value="maintenance">Maintenance</MenuItem>
                              </Select>
                            </FormControl>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddUpdateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddUpdate}
            variant="contained"
            disabled={submitting || !newUpdate.message.trim()}
            startIcon={
              submitting ? <CircularProgress size={16} /> : <AddIcon />
            }
          >
            {submitting ? 'Adding...' : 'Add Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
