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
import CampaignIcon from '@mui/icons-material/Campaign';
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
  const [pageDialogOpen, setPageDialogOpen] = useState(false);
  const [affectedServicesWithStatus, setAffectedServicesWithStatus] = useState([]);

  // Form state for incident update
  const [updateForm, setUpdateForm] = useState({
    message: '',
    update_type: 'update',
    status: '',
    is_public_note: false,
    update_service_status: false,
    service_status_updates: {},
  });


  // Form state for paging
  const [pageForm, setPageForm] = useState({
    message: '',
    method: 'email', // email, sms, call
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
      setUpdateForm(prev => ({
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
      // If status is being changed, update incident status first
      if (updateForm.status && updateForm.status !== incident?.status) {
        const updateData = {
          status: updateForm.status,
          ...(updateForm.status === 'resolved' && {
            resolved_at: new Date().toISOString(),
          }),
          ...(updateForm.status === 'acknowledged' && {
            acknowledged_at: new Date().toISOString(),
          }),
        };

        const statusResponse = await fetch(`/api/incidents/${incidentId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });

        if (!statusResponse.ok) {
          const errorData = await statusResponse.json();
          throw new Error(errorData.error || 'Failed to update status');
        }
      }

      // Create the incident update
      const updateData = {
        message: updateForm.message,
        update_type: updateForm.update_type,
        visible_to_public: updateForm.is_public_note,
      };

      const response = await fetch(`/api/incidents/${incidentId}/updates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        // Update service statuses if requested
        if (updateForm.update_service_status && Object.keys(updateForm.service_status_updates).length > 0) {
          await updateServiceStatuses(updateForm.service_status_updates);
        }

        setUpdateForm({ 
          message: '', 
          update_type: 'update', 
          status: '', 
          is_public_note: false,
          update_service_status: false,
          service_status_updates: {}
        });
        setUpdateDialogOpen(false);
        await fetchIncident();
        await fetchIncidentUpdates();
        await fetchAffectedServicesWithStatus();
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


  const updateServiceStatuses = async (serviceStatusUpdates) => {
    const statusUpdatePromises = Object.entries(serviceStatusUpdates).map(async ([serviceId, newStatus]) => {
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

  const handlePageUser = async () => {
    if (!incident.assigned_to || !pageForm.message.trim()) return;

    setSubmitting(true);
    try {
      // First, fetch user details to get email/phone for notifications
      const userResponse = await fetch(`/api/users/${incident.assigned_to}`);
      if (!userResponse.ok) {
        throw new Error('Failed to fetch user details');
      }
      const userData = await userResponse.json();
      
      // Format recipient data
      const recipient = {};
      if (userData.user?.email) {
        recipient.email = userData.user.email;
      }
      if (userData.user?.phone) {
        recipient.phone = userData.user.phone;
      }

      // If no contact info available, show error
      if (!recipient.email && !recipient.phone) {
        throw new Error('No contact information available for this user');
      }

      // Get current user's name for the message
      const currentUserName = session?.user?.name || session?.user?.email || 'Someone';
      const incidentIdentifier = incident.incident_number 
        ? `#${incident.incident_number}` 
        : `(${incident.id?.slice(-8) || 'Unknown'})`;

      // Send the page notification using the correct API format
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: recipient,
          subject: `Urgent Page from ${currentUserName} - Incident ${incidentIdentifier}`,
          message: pageForm.message,
          channels: [pageForm.method],
          type: 'manual',
          incidentData: {
            id: incident.id,
            title: incident.title,
            incident_number: incident.incident_number,
            severity: incident.severity,
            status: incident.status,
          },
        }),
      });

      if (response.ok) {
        setPageForm({ message: '', method: 'email' });
        setPageDialogOpen(false);
        
        // Add an incident update about the page
        await fetch(`/api/incidents/${incidentId}/updates`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `🔔 ${currentUserName} paged ${incident.assigned_to_name} via ${pageForm.method}.\n\nMessage sent: "${pageForm.message}"`,
            update_type: 'escalation',
            visible_to_public: false,
          }),
        });
        await fetchIncidentUpdates();
        // Force timeline refresh after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to send page');
      }
    } catch (err) {
      console.error('Error sending page:', err);
      setError(err.message || 'Failed to send page');
    } finally {
      setSubmitting(false);
    }
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
    <Box sx={{ maxWidth: '1400px', mx: 'auto', p: { xs: 2, md: 3 } }}>
      {/* Enhanced Header */}
      <Box 
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
          pb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          <Button
            component={Link}
            href="/incidents"
            startIcon={<ArrowBackIcon />}
            variant="outlined"
            size="small"
          >
            Back
          </Button>
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 0.5 }}>
              {typeof incident.title === 'string' ? incident.title : 'Untitled Incident'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Incident #{incident.incident_number || incident.id?.slice(-4)} • Created {dayjs(incident.created_at).format('MMM D, YYYY h:mm A')}
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip
            label={typeof incident.severity === 'string' ? incident.severity.toUpperCase() : 'UNKNOWN'}
            color={getSeverityColor(typeof incident.severity === 'string' ? incident.severity : 'medium')}
            size="medium"
            sx={{ fontWeight: 600 }}
          />
          <Chip
            label={typeof incident.status === 'string' ? incident.status.toUpperCase() : 'UNKNOWN'}
            color={getStatusColor(typeof incident.status === 'string' ? incident.status : 'investigating')}
            size="medium"
            sx={{ fontWeight: 600 }}
          />
          <Button
            startIcon={<EditIcon />}
            variant="outlined"
            component={Link}
            href={`/incidents/${incidentId}/edit`}
          >
            Edit
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Sidebar - Move to left for better desktop UX */}
        <Grid size={{ xs: 12, lg: 4 }} order={{ xs: 2, lg: 1 }}>
          {/* Quick Actions */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Actions
              </Typography>
              <Box display="flex" flexDirection="column" gap={1.5}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => {
                    // Initialize with current service statuses
                    const initialServiceStatusUpdates = {};
                    affectedServicesWithStatus.forEach(service => {
                      const safeId = safeGetServiceId(service);
                      const safeStatus = safeGetServiceStatus(service);
                      if (safeId) {
                        initialServiceStatusUpdates[safeId] = safeStatus;
                      }
                    });
                    
                    setUpdateForm({
                      message: '',
                      update_type: 'update',
                      status: '',
                      is_public_note: false,
                      update_service_status: false,
                      service_status_updates: initialServiceStatusUpdates,
                    });
                    setUpdateDialogOpen(true);
                  }}
                  size="large"
                  sx={{ fontWeight: 600 }}
                >
                  Update Incident
                </Button>
                {incident.status === 'new' && (
                  <Button
                    variant="contained"
                    color="warning"
                    fullWidth
                    size="large"
                    onClick={() => {
                      setUpdateForm({
                        message: 'Incident has been acknowledged and investigation is beginning.',
                        update_type: 'status_change',
                        status: 'acknowledged'
                      });
                      setUpdateDialogOpen(true);
                    }}
                  >
                    Acknowledge
                  </Button>
                )}
                {incident.status !== 'resolved' && (
                  <Button
                    variant="contained"
                    color="success"
                    fullWidth
                    size="large"
                    onClick={() => {
                      setUpdateForm({
                        message: 'Incident has been resolved.',
                        update_type: 'status_change',
                        status: 'resolved'
                      });
                      setUpdateDialogOpen(true);
                    }}
                  >
                    Resolve
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Incident Details - More compact */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Details
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">Duration</Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {formatDuration(incident.created_at, incident.resolved_at)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">Created By</Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {typeof incident.created_by_name === 'string' ? incident.created_by_name : 'System'}
                  </Typography>
                </Box>
                {incident.assigned_to_name && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Assigned To</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight="medium">
                        {typeof incident.assigned_to_name === 'string' ? incident.assigned_to_name : 'Unknown User'}
                      </Typography>
                      <Tooltip title="Page assigned user">
                        <IconButton
                          size="small"
                          onClick={() => {
                            const incidentIdentifier = `#${incident.incident_number || incident.id?.slice(-4)}`;
                            const currentUserName = session?.user?.name || session?.user?.email || 'Someone';
                            setPageForm({
                              message: `URGENT: ${currentUserName} is paging you about incident ${incidentIdentifier} - ${incident.title}. Please check the incident details and respond as soon as possible.`,
                              method: 'email'
                            });
                            setPageDialogOpen(true);
                          }}
                          sx={{
                            backgroundColor: 'warning.main',
                            color: 'white',
                            width: 24,
                            height: 24,
                            '&:hover': {
                              backgroundColor: 'warning.dark',
                            },
                          }}
                        >
                          <CampaignIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">Created</Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {dayjs(incident.created_at).format('MMM D, h:mm A')}
                  </Typography>
                </Box>
                {incident.resolved_at && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Resolved</Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {dayjs(incident.resolved_at).format('MMM D, h:mm A')}
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Affected Services - More compact */}
          {affectedServicesWithStatus.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Affected Services ({affectedServicesWithStatus.length})
                </Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  {affectedServicesWithStatus.map((service, index) => (
                    <Box
                      key={service.id || index}
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ 
                        p: 1.5, 
                        borderRadius: 1.5, 
                        bgcolor: 'grey.50',
                        border: '1px solid',
                        borderColor: 'grey.200'
                      }}
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
                    Outlined badges indicate services not found in your organization
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Main Content */}
        <Grid size={{ xs: 12, lg: 8 }} order={{ xs: 1, lg: 2 }}>
          {/* Description & Impact */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Description
              </Typography>
              <Typography variant="body1" paragraph sx={{ lineHeight: 1.7 }}>
                {typeof incident.description === 'string' ? incident.description : 'No description available'}
              </Typography>

              {incident.impact_description && (
                <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    Impact
                  </Typography>
                  <Typography variant="body1" sx={{ lineHeight: 1.7 }}>
                    {typeof incident.impact_description === 'string' ? incident.impact_description : 'No impact description'}
                  </Typography>
                </Box>
              )}

              {incident.resolution_notes && (
                <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    Resolution
                  </Typography>
                  <Typography variant="body1" sx={{ lineHeight: 1.7 }}>
                    {typeof incident.resolution_notes === 'string' ? incident.resolution_notes : 'No resolution notes'}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                Timeline & Updates
              </Typography>
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

      </Grid>

      {/* Update Incident Dialog */}
      <Dialog
        open={updateDialogOpen}
        onClose={() => setUpdateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Update Incident</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              {/* Update Message */}
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Update Message"
                  multiline
                  rows={4}
                  fullWidth
                  value={updateForm.message}
                  onChange={e =>
                    setUpdateForm(prev => ({ ...prev, message: e.target.value }))
                  }
                  placeholder="Provide an update on the incident status..."
                />
              </Grid>

              {/* Update Type and Status Change */}
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Update Type</InputLabel>
                  <Select
                    value={updateForm.update_type}
                    label="Update Type"
                    onChange={e =>
                      setUpdateForm(prev => ({ ...prev, update_type: e.target.value }))
                    }
                  >
                    <MenuItem value="update">General Update</MenuItem>
                    <MenuItem value="status_change">Status Change</MenuItem>
                    <MenuItem value="escalation">Escalation</MenuItem>
                    <MenuItem value="assignment">Assignment</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Status Change */}
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Change Status (Optional)</InputLabel>
                  <Select
                    value={updateForm.status}
                    label="Change Status (Optional)"
                    onChange={e =>
                      setUpdateForm(prev => ({ ...prev, status: e.target.value }))
                    }
                  >
                    <MenuItem value="">No Status Change</MenuItem>
                    <MenuItem value="new">New</MenuItem>
                    <MenuItem value="acknowledged">Acknowledged</MenuItem>
                    <MenuItem value="investigating">Investigating</MenuItem>
                    <MenuItem value="identified">Identified</MenuItem>
                    <MenuItem value="monitoring">Monitoring</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Public Note Option */}
              <Grid size={{ xs: 12 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={updateForm.is_public_note}
                      onChange={e =>
                        setUpdateForm(prev => ({
                          ...prev,
                          is_public_note: e.target.checked,
                        }))
                      }
                      color="primary"
                    />
                  }
                  label="Make this update visible on public status page"
                />
              </Grid>

              {/* Service Status Updates */}
              {affectedServicesWithStatus.length > 0 && (
                <Grid size={{ xs: 12 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={updateForm.update_service_status}
                        onChange={e =>
                          setUpdateForm(prev => ({
                            ...prev,
                            update_service_status: e.target.checked,
                          }))
                        }
                        color="primary"
                      />
                    }
                    label="Update status of affected services"
                  />

                  {updateForm.update_service_status && (
                    <Box sx={{ mt: 2, ml: 3 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Service Status Updates
                      </Typography>
                      <Grid container spacing={2}>
                        {affectedServicesWithStatus.filter(service => service.id && !service.isUnknown).map(service => (
                          <Grid size={{ xs: 12, md: 6 }} key={service.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Chip
                                label={typeof service.name === 'string' ? service.name : service.id || 'Unknown Service'}
                                color={getServiceStatusColor(typeof service.status === 'string' ? service.status : 'operational')}
                                size="small"
                                sx={{ minWidth: 120, maxWidth: 150 }}
                              />
                              <FormControl size="small" sx={{ minWidth: 140 }}>
                                <InputLabel>New Status</InputLabel>
                                <Select
                                  value={updateForm.service_status_updates?.[service.id] || (typeof service.status === 'string' ? service.status : 'operational')}
                                  label="New Status"
                                  onChange={e =>
                                    setUpdateForm(prev => ({
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
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                      {affectedServicesWithStatus.some(s => s.isUnknown) && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          Services not found in your organization cannot be updated
                        </Typography>
                      )}
                    </Box>
                  )}
                </Grid>
              )}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpdateDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddUpdate}
            variant="contained"
            disabled={submitting || !updateForm.message.trim()}
            startIcon={
              submitting ? <CircularProgress size={16} /> : <SaveIcon />
            }
          >
            {submitting ? 'Updating...' : 'Update Incident'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Page User Dialog */}
      <Dialog
        open={pageDialogOpen}
        onClose={() => setPageDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CampaignIcon color="warning" />
            Page {incident?.assigned_to_name}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              label="Message"
              multiline
              rows={4}
              fullWidth
              value={pageForm.message}
              onChange={e =>
                setPageForm(prev => ({ ...prev, message: e.target.value }))
              }
              placeholder="Urgent message about the incident..."
              sx={{ mb: 3 }}
            />

            <FormControl fullWidth>
              <InputLabel>Notification Method</InputLabel>
              <Select
                value={pageForm.method}
                label="Notification Method"
                onChange={e =>
                  setPageForm(prev => ({ ...prev, method: e.target.value }))
                }
              >
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="sms">SMS</MenuItem>
                <MenuItem value="call">Phone Call</MenuItem>
                <MenuItem value="push">Push Notification</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPageDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handlePageUser}
            variant="contained"
            color="warning"
            disabled={submitting || !pageForm.message.trim()}
            startIcon={
              submitting ? <CircularProgress size={16} /> : <CampaignIcon />
            }
          >
            {submitting ? 'Sending...' : 'Send Page'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
