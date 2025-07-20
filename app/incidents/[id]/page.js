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
  Divider,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import NotificationsIcon from '@mui/icons-material/Notifications';
import IncidentTimeline from '@/components/IncidentTimeline';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useOrganization } from '@/contexts/OrganizationContext';

export const runtime = 'edge';

dayjs.extend(relativeTime);

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useOrganization();
  const incidentId = params.id;

  const [incident, setIncident] = useState(null);
  const [incidentUpdates, setIncidentUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [statusUpdateDialogOpen, setStatusUpdateDialogOpen] = useState(false);
  const [affectedServicesWithStatus, setAffectedServicesWithStatus] = useState([]);

  // Form state for incident update
  const [updateForm, setUpdateForm] = useState({
    message: '',
    update_type: 'update',
  });

  // Form state for status change
  const [statusForm, setStatusForm] = useState({
    status: '',
    resolution_notes: '',
    update_service_status: false,
    service_status_updates: {},
  });

  const [submitting, setSubmitting] = useState(false);

  // Utility function to safely extract service names from potentially mixed data
  const safeGetServiceName = (service) => {
    if (typeof service === 'string') return service;
    if (typeof service === 'object' && service !== null) {
      return typeof service.name === 'string' ? service.name : 
             typeof service.id === 'string' ? service.id : 
             'Unknown Service';
    }
    return 'Unknown Service';
  };

  // Utility function to safely extract service status
  const safeGetServiceStatus = (service) => {
    if (typeof service === 'string') return 'operational';
    if (typeof service === 'object' && service !== null) {
      return typeof service.status === 'string' ? service.status : 'operational';
    }
    return 'operational';
  };

  // Utility function to safely extract service ID
  const safeGetServiceId = (service) => {
    if (typeof service === 'string') return service;
    if (typeof service === 'object' && service !== null) {
      return typeof service.id === 'string' ? service.id : 
             typeof service.name === 'string' ? service.name : 
             JSON.stringify(service).substring(0, 20);
    }
    return 'unknown';
  };

  useEffect(() => {
    if (incidentId && session) {
      fetchIncident();
      fetchIncidentUpdates();
    }
  }, [incidentId, session]);

  useEffect(() => {
    if (incident?.affected_services) {
      fetchAffectedServicesWithStatus();
    }
  }, [incident]);

  useEffect(() => {
    if (affectedServicesWithStatus.length > 0) {
      // Initialize service status updates with current status using safe utilities
      const initialStatusUpdates = {};
      affectedServicesWithStatus.forEach(service => {
        const safeId = safeGetServiceId(service);
        const safeStatus = safeGetServiceStatus(service);
        if (safeId) {
          initialStatusUpdates[safeId] = safeStatus;
        }
      });
      setStatusForm(prev => ({
        ...prev,
        service_status_updates: initialStatusUpdates
      }));
    }
  }, [affectedServicesWithStatus]);

  const fetchIncident = async () => {
    try {
      const response = await fetch(`/api/incidents/${incidentId}`);
      if (response.ok) {
        const data = await response.json();
        setIncident(data.incident);
        setStatusForm(prev => ({
          ...prev,
          status: data.incident.status,
        }));
      } else if (response.status === 404) {
        setError('Incident not found');
      } else {
        setError('Failed to load incident');
      }
    } catch (err) {
      console.error('Error fetching incident:', err);
      setError('Failed to load incident');
    }
  };

  const fetchIncidentUpdates = async () => {
    try {
      const response = await fetch(`/api/incidents/${incidentId}/updates`);
      if (response.ok) {
        const data = await response.json();
        setIncidentUpdates(data.updates || []);
      }
    } catch (err) {
      console.error('Error fetching incident updates:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAffectedServicesWithStatus = async () => {
    if (!incident?.affected_services || incident.affected_services.length === 0) {
      setAffectedServicesWithStatus([]);
      return;
    }

    try {
      // Fetch all services for the organization to resolve service names to full service objects
      const response = await fetch('/api/services');
      const allServices = response.ok ? (await response.json()).services || [] : [];
      
      // Map affected services (which could be strings, IDs, or full objects) to normalized service objects
      const servicesWithStatus = incident.affected_services.map(serviceItem => {
        // If it's already a service object, use our utility functions to normalize it
        if (typeof serviceItem === 'object' && serviceItem !== null) {
          return {
            id: safeGetServiceId(serviceItem),
            name: safeGetServiceName(serviceItem),
            status: safeGetServiceStatus(serviceItem),
            isUnknown: false
          };
        }
        
        // If it's a string (service name or ID), try to find the full service
        const serviceName = typeof serviceItem === 'string' ? serviceItem : 'Unknown Service';
        const foundService = allServices.find(s => s.name === serviceName || s.id === serviceName);
        
        if (foundService) {
          return {
            id: safeGetServiceId(foundService),
            name: safeGetServiceName(foundService),
            status: safeGetServiceStatus(foundService),
            isUnknown: false
          };
        }
        
        // Fallback for unknown services
        return { 
          id: serviceName, 
          name: serviceName, 
          status: 'operational',
          isUnknown: true 
        };
      });
      
      setAffectedServicesWithStatus(servicesWithStatus);
    } catch (err) {
      console.error('Error fetching affected services:', err);
      // Safe fallback using utility functions
      const fallbackServices = incident.affected_services.map(serviceItem => ({
        id: safeGetServiceId(serviceItem),
        name: safeGetServiceName(serviceItem),
        status: safeGetServiceStatus(serviceItem),
        isUnknown: true
      }));
      setAffectedServicesWithStatus(fallbackServices);
    }
  };

  const handleAddUpdate = async () => {
    if (!updateForm.message.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/incidents/${incidentId}/updates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateForm),
      });

      if (response.ok) {
        setUpdateForm({ message: '', update_type: 'update' });
        setUpdateDialogOpen(false);
        await fetchIncidentUpdates();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add update');
      }
    } catch (err) {
      console.error('Error adding update:', err);
      setError('Failed to add update');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (statusForm.status === incident?.status) {
      setStatusUpdateDialogOpen(false);
      return;
    }

    setSubmitting(true);
    try {
      const updateData = {
        status: statusForm.status,
        ...(statusForm.status === 'resolved' &&
          statusForm.resolution_notes && {
            resolution_notes: statusForm.resolution_notes,
          }),
      };

      const response = await fetch(`/api/incidents/${incidentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        // Update service statuses if requested
        if (statusForm.update_service_status && Object.keys(statusForm.service_status_updates).length > 0) {
          await updateServiceStatuses();
        }

        setStatusUpdateDialogOpen(false);
        await fetchIncident();
        await fetchIncidentUpdates();
        await fetchAffectedServicesWithStatus();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update status');
      }
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  const updateServiceStatuses = async () => {
    const statusUpdatePromises = Object.entries(statusForm.service_status_updates).map(async ([serviceId, newStatus]) => {
      const service = affectedServicesWithStatus.find(s => s.id === serviceId);
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

  const getSeverityColor = severity => {
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

  const getStatusColor = status => {
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

  const getUpdateIcon = updateType => {
    switch (updateType) {
      case 'status_change':
        return <CheckCircleIcon />;
      case 'escalation':
        return <NotificationsIcon />;
      case 'assignment':
        return <PersonIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const formatDuration = (startDate, endDate = null) => {
    const start = dayjs(startDate);
    const end = endDate ? dayjs(endDate) : dayjs();
    const diffMinutes = end.diff(start, 'minute');

    if (diffMinutes < 60) {
      return `${diffMinutes}m`;
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    } else {
      const days = Math.floor(diffMinutes / 1440);
      const hours = Math.floor((diffMinutes % 1440) / 60);
      return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    }
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
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button
          component={Link}
          href="/incidents"
          startIcon={<ArrowBackIcon />}
          variant="outlined"
        >
          Back to Incidents
        </Button>
      </Box>
    );
  }

  if (!incident) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Incident not found
        </Alert>
        <Button
          component={Link}
          href="/incidents"
          startIcon={<ArrowBackIcon />}
          variant="outlined"
        >
          Back to Incidents
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={4}>
        <Button
          component={Link}
          href="/incidents"
          startIcon={<ArrowBackIcon />}
          variant="outlined"
        >
          Back to Incidents
        </Button>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
          Incident #{incident.incident_number}
        </Typography>
        <Button
          startIcon={<EditIcon />}
          variant="outlined"
          component={Link}
          href={`/incidents/${incidentId}/edit`}
        >
          Edit
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Main Incident Details */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="flex-start"
                mb={2}
              >
                <Typography variant="h5" gutterBottom>
                  {typeof incident.title === 'string' ? incident.title : 'Untitled Incident'}
                </Typography>
                <Box display="flex" gap={1}>
                  <Chip
                    label={typeof incident.severity === 'string' ? incident.severity.toUpperCase() : 'UNKNOWN'}
                    color={getSeverityColor(typeof incident.severity === 'string' ? incident.severity : 'medium')}
                    size="small"
                  />
                  <Chip
                    label={typeof incident.status === 'string' ? incident.status.toUpperCase() : 'UNKNOWN'}
                    color={getStatusColor(typeof incident.status === 'string' ? incident.status : 'investigating')}
                    size="small"
                  />
                </Box>
              </Box>

              <Typography variant="body1" paragraph>
                {typeof incident.description === 'string' ? incident.description : 'No description available'}
              </Typography>

              {incident.impact_description && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Impact Description
                  </Typography>
                  <Typography variant="body2">
                    {typeof incident.impact_description === 'string' ? incident.impact_description : 'No impact description'}
                  </Typography>
                </Box>
              )}

              {incident.resolution_notes && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Resolution Notes
                  </Typography>
                  <Typography variant="body2">
                    {typeof incident.resolution_notes === 'string' ? incident.resolution_notes : 'No resolution notes'}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardContent>
              <IncidentTimeline
                incidentId={incidentId}
                incident={incident}
                onIncidentUpdate={() => {
                  fetchIncident();
                  fetchAffectedServicesWithStatus();
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* Quick Actions */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box display="flex" flexDirection="column" gap={1}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => setStatusUpdateDialogOpen(true)}
                >
                  Update Status
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => setUpdateDialogOpen(true)}
                >
                  Add Update
                </Button>
                {incident.status === 'new' && (
                  <Button
                    variant="contained"
                    color="warning"
                    fullWidth
                    onClick={() => {
                      setStatusForm({
                        status: 'acknowledged',
                        resolution_notes: '',
                      });
                      setStatusUpdateDialogOpen(true);
                    }}
                  >
                    Acknowledge Incident
                  </Button>
                )}
                {incident.status !== 'resolved' && (
                  <Button
                    variant="contained"
                    color="success"
                    fullWidth
                    onClick={() => {
                      setStatusForm({
                        status: 'resolved',
                        resolution_notes: '',
                      });
                      setStatusUpdateDialogOpen(true);
                    }}
                  >
                    Resolve Incident
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Incident Details */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Details
              </Typography>
              <List dense>
                <ListItem disablePadding>
                  <ListItemIcon>
                    <AccessTimeIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Duration"
                    secondary={formatDuration(
                      incident.created_at,
                      incident.resolved_at
                    )}
                  />
                </ListItem>
                <ListItem disablePadding>
                  <ListItemIcon>
                    <PersonIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Created By"
                    secondary={typeof incident.created_by_name === 'string' ? incident.created_by_name : 'System'}
                  />
                </ListItem>
                {incident.assigned_to_name && (
                  <ListItem disablePadding>
                    <ListItemIcon>
                      <PersonIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="Assigned To"
                      secondary={typeof incident.assigned_to_name === 'string' ? incident.assigned_to_name : 'Unknown User'}
                    />
                  </ListItem>
                )}
                <ListItem disablePadding>
                  <ListItemText
                    primary="Created"
                    secondary={dayjs(incident.created_at).format(
                      'MMM D, YYYY h:mm A'
                    )}
                  />
                </ListItem>
                {incident.resolved_at && (
                  <ListItem disablePadding>
                    <ListItemText
                      primary="Resolved"
                      secondary={dayjs(incident.resolved_at).format(
                        'MMM D, YYYY h:mm A'
                      )}
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>

          {/* Affected Services */}
          {affectedServicesWithStatus.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Affected Services
                </Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  {affectedServicesWithStatus.map((service, index) => (
                    <Box
                      key={service.id || index}
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ p: 1, borderRadius: 1, bgcolor: 'grey.50' }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {typeof service.name === 'string' ? service.name : service.id || 'Unknown Service'}
                      </Typography>
                      <Chip
                        label={(service.status || 'Unknown').charAt(0).toUpperCase() + (service.status || 'Unknown').slice(1)}
                        color={getServiceStatusColor(service.status || 'operational')}
                        size="small"
                        variant={service.isUnknown ? "outlined" : "filled"}
                      />
                    </Box>
                  ))}
                </Box>
                {affectedServicesWithStatus.some(s => s.isUnknown) && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Services with outlined status badges could not be found in your organization
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Status Update Dialog */}
      <Dialog
        open={statusUpdateDialogOpen}
        onClose={() => setStatusUpdateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Update Incident Status</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusForm.status}
                label="Status"
                onChange={e =>
                  setStatusForm(prev => ({ ...prev, status: e.target.value }))
                }
              >
                <MenuItem value="investigating">Investigating</MenuItem>
                <MenuItem value="identified">Identified</MenuItem>
                <MenuItem value="monitoring">Monitoring</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
                <MenuItem value="acknowledged">Acknowledged</MenuItem>
              </Select>
            </FormControl>

            {statusForm.status === 'resolved' && (
              <>
                <TextField
                  label="Resolution Notes"
                  multiline
                  rows={3}
                  fullWidth
                  value={statusForm.resolution_notes}
                  onChange={e =>
                    setStatusForm(prev => ({
                      ...prev,
                      resolution_notes: e.target.value,
                    }))
                  }
                  placeholder="Describe how the incident was resolved..."
                  sx={{ mb: 3 }}
                />

                {/* Service Status Update Section */}
                {affectedServicesWithStatus.length > 0 && (
                  <Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={statusForm.update_service_status}
                          onChange={e =>
                            setStatusForm(prev => ({
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

                    {statusForm.update_service_status && (
                      <Box sx={{ ml: 4, mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Service Status Updates
                        </Typography>
                        {affectedServicesWithStatus.filter(service => service.id).map(service => (
                          <Box key={service.id} sx={{ mb: 2 }}>
                            <Box display="flex" alignItems="center" gap={2}>
                              <Chip
                                label={typeof service.name === 'string' ? service.name : service.id || 'Unknown Service'}
                                color={getServiceStatusColor(typeof service.status === 'string' ? service.status : 'operational')}
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
                                    value={statusForm.service_status_updates?.[service.id] || (typeof service.status === 'string' ? service.status : 'operational')}
                                    label="New Status"
                                    onChange={e =>
                                      setStatusForm(prev => ({
                                        ...prev,
                                        service_status_updates: {
                                          ...(prev.service_status_updates || {}),
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
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusUpdateDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleStatusUpdate}
            variant="contained"
            disabled={submitting}
            startIcon={
              submitting ? <CircularProgress size={16} /> : <SaveIcon />
            }
          >
            {submitting ? 'Updating...' : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
