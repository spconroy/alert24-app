'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Grid,
  Alert,
  CircularProgress,
  IconButton,
  Divider
} from '@mui/material';
import {
  Edit as EditIcon,
  Add as AddIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Build as BuildIcon,
  Announcement as AnnouncementIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';

export default function ServiceStatusManager({ statusPageId, onRefresh }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Service status update modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  
  // Status update post modal
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    title: '',
    message: '',
    update_type: 'general',
    status: '',
    service_id: ''
  });
  const [postUpdateLoading, setPostUpdateLoading] = useState(false);
  
  // Status page info for public link
  const [statusPage, setStatusPage] = useState(null);

  useEffect(() => {
    if (statusPageId) {
      fetchServices();
      fetchStatusPage();
    }
  }, [statusPageId]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/services?status_page_id=${statusPageId}`);
      if (!response.ok) throw new Error('Failed to fetch services');
      const data = await response.json();
      setServices(data.services || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatusPage = async () => {
    try {
      const response = await fetch(`/api/status-pages/${statusPageId}`);
      if (!response.ok) throw new Error('Failed to fetch status page');
      const data = await response.json();
      setStatusPage(data.statusPage);
    } catch (err) {
      console.error('Failed to fetch status page:', err);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedService || !newStatus) return;

    try {
      setStatusUpdateLoading(true);
      
      // Update the service status
      const response = await fetch(`/api/services/${selectedService.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update service status');

      // If there's a message, post a status update as well
      if (statusMessage.trim()) {
        // Map service status to appropriate update status
        let updateStatus = 'operational';
        let updateType = 'general';
        
        if (newStatus === 'down') {
          updateStatus = 'investigating';
          updateType = 'incident';
        } else if (newStatus === 'degraded') {
          updateStatus = 'identified';
          updateType = 'incident';
        } else if (newStatus === 'maintenance') {
          updateStatus = 'maintenance';
          updateType = 'maintenance';
        } else if (newStatus === 'operational') {
          // If changing to operational, it might be resolving an incident
          updateStatus = selectedService.status === 'down' || selectedService.status === 'degraded' ? 'resolved' : 'operational';
          updateType = selectedService.status === 'down' || selectedService.status === 'degraded' ? 'incident' : 'general';
        }

        const statusUpdatePayload = {
          title: `${selectedService.name} status updated to ${getStatusText(newStatus)}`,
          message: statusMessage.trim(),
          update_type: updateType,
          status: updateStatus,
          status_page_id: statusPageId,
          service_id: selectedService.id
        };
        
        console.log('Posting status update with payload:', statusUpdatePayload);
        
        const statusUpdateResponse = await fetch('/api/status-updates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(statusUpdatePayload)
        });

        if (!statusUpdateResponse.ok) {
          console.warn('Failed to post status update message, but service status was updated');
        }
      }

      await fetchServices();
      if (onRefresh) onRefresh();
      setStatusModalOpen(false);
      setSelectedService(null);
      setNewStatus('');
      setStatusMessage('');
    } catch (err) {
      setError(err.message);
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  const handlePostUpdate = async () => {
    if (!updateForm.title || !updateForm.message) return;

    try {
      setPostUpdateLoading(true);
      
      const payload = {
        ...updateForm,
        status_page_id: statusPageId,
        service_id: updateForm.service_id || null
      };
      
      console.log('Posting general status update with payload:', payload);
      
      const response = await fetch('/api/status-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to post status update');

      setUpdateModalOpen(false);
      setUpdateForm({
        title: '',
        message: '',
        update_type: 'general',
        status: '',
        service_id: ''
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setPostUpdateLoading(false);
    }
  };

  const openStatusModal = (service) => {
    setSelectedService(service);
    setNewStatus(service.status);
    setStatusMessage('');
    setStatusModalOpen(true);
  };

  const openUpdateModal = (service = null) => {
    // If a specific service is selected, set appropriate status and update type based on current service status
    let defaultStatus = '';
    let defaultUpdateType = 'general';
    
    if (service) {
      // Map service status to appropriate update status and type
      if (service.status === 'down') {
        defaultStatus = 'investigating';
        defaultUpdateType = 'incident';
      } else if (service.status === 'degraded') {
        defaultStatus = 'identified';
        defaultUpdateType = 'incident';
      } else if (service.status === 'maintenance') {
        defaultStatus = 'maintenance';
        defaultUpdateType = 'maintenance';
      } else if (service.status === 'operational') {
        defaultStatus = 'operational';
        defaultUpdateType = 'general';
      }
    }
    
    setUpdateForm({
      title: '',
      message: '',
      update_type: defaultUpdateType,
      status: defaultStatus,
      service_id: service?.id || ''
    });
    setUpdateModalOpen(true);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'operational': return <CheckCircleIcon sx={{ color: 'success.main' }} />;
      case 'degraded': return <WarningIcon sx={{ color: 'warning.main' }} />;
      case 'down': return <ErrorIcon sx={{ color: 'error.main' }} />;
      case 'maintenance': return <BuildIcon sx={{ color: 'info.main' }} />;
      default: return <CheckCircleIcon sx={{ color: 'success.main' }} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'operational': return 'success';
      case 'degraded': return 'warning';
      case 'down': return 'error';
      case 'maintenance': return 'info';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'operational': return 'Operational';
      case 'degraded': return 'Degraded';
      case 'down': return 'Down';
      case 'maintenance': return 'Maintenance';
      default: return 'Unknown';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h3">
          Service Status Management
        </Typography>
        <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1}>
          <Button
            variant="contained"
            startIcon={<AnnouncementIcon />}
            onClick={() => openUpdateModal()}
            sx={{ borderRadius: 2 }}
          >
            Post Update
          </Button>
          {statusPage && statusPage.is_public && (
            <Button
              size="small"
              variant="text"
              startIcon={<OpenInNewIcon />}
              onClick={() => window.open(`/status/${statusPage.slug}`, '_blank')}
              sx={{ 
                fontSize: '0.75rem',
                color: 'text.secondary',
                '&:hover': {
                  color: 'primary.main'
                }
              }}
            >
              View Public Status Page
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {services.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">
              No services found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create some services first to manage their status.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {services.map((service) => (
            <Grid item xs={12} md={6} key={service.id}>
              <Card elevation={1}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box flex={1}>
                      <Typography variant="h6" gutterBottom>
                        {service.name}
                      </Typography>
                      {service.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {service.description}
                        </Typography>
                      )}
                    </Box>
                    <Chip
                      icon={getStatusIcon(service.status)}
                      label={getStatusText(service.status)}
                      color={getStatusColor(service.status)}
                      size="small"
                    />
                  </Box>
                  
                  <Box display="flex" gap={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<EditIcon />}
                      onClick={() => openStatusModal(service)}
                    >
                      Update Status
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AnnouncementIcon />}
                      onClick={() => openUpdateModal(service)}
                    >
                      Post Update
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Service Status Update Modal */}
      <Dialog open={statusModalOpen} onClose={() => setStatusModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Update Service Status</Typography>
            <IconButton onClick={() => setStatusModalOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedService && (
            <>
              <Typography variant="body1" sx={{ mb: 3 }}>
                Update the status for <strong>{selectedService.name}</strong>
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Service Status</InputLabel>
                <Select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  label="Service Status"
                >
                  <MenuItem value="operational">
                    <Box display="flex" alignItems="center" gap={1}>
                      <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
                      Operational
                    </Box>
                  </MenuItem>
                  <MenuItem value="degraded">
                    <Box display="flex" alignItems="center" gap={1}>
                      <WarningIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                      Degraded Performance
                    </Box>
                  </MenuItem>
                  <MenuItem value="down">
                    <Box display="flex" alignItems="center" gap={1}>
                      <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
                      Major Outage
                    </Box>
                  </MenuItem>
                  <MenuItem value="maintenance">
                    <Box display="flex" alignItems="center" gap={1}>
                      <BuildIcon sx={{ color: 'info.main', fontSize: 20 }} />
                      Under Maintenance
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Status Update Message (Optional)"
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
                placeholder="Provide details about this status change..."
                helperText="This message will be posted as a status update if provided"
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setStatusModalOpen(false)} disabled={statusUpdateLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleStatusUpdate}
            variant="contained"
            disabled={statusUpdateLoading || !newStatus}
            startIcon={statusUpdateLoading ? <CircularProgress size={16} /> : <EditIcon />}
          >
            {statusUpdateLoading ? 'Updating...' : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Post Status Update Modal */}
      <Dialog open={updateModalOpen} onClose={() => setUpdateModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Post Status Update</Typography>
            <IconButton onClick={() => setUpdateModalOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Update Title"
                  value={updateForm.title}
                  onChange={(e) => setUpdateForm({ ...updateForm, title: e.target.value })}
                  placeholder="Brief description of the update"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Update Type</InputLabel>
                  <Select
                    value={updateForm.update_type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      let newStatus = updateForm.status;
                      
                      // Reset status to appropriate default when type changes
                      if (newType === 'incident' && !['investigating', 'identified', 'monitoring', 'resolved'].includes(newStatus)) {
                        newStatus = 'investigating';
                      } else if (newType === 'maintenance' && !['maintenance', 'operational'].includes(newStatus)) {
                        newStatus = 'maintenance';
                      } else if (newType === 'general' && !['operational', 'degraded', 'down', 'maintenance'].includes(newStatus)) {
                        newStatus = 'operational';
                      }
                      
                      setUpdateForm({ ...updateForm, update_type: newType, status: newStatus });
                    }}
                    label="Update Type"
                  >
                    <MenuItem value="general">General Update</MenuItem>
                    <MenuItem value="incident">Incident</MenuItem>
                    <MenuItem value="maintenance">Maintenance</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Related Service (Optional)</InputLabel>
                  <Select
                    value={updateForm.service_id}
                    onChange={(e) => setUpdateForm({ ...updateForm, service_id: e.target.value })}
                    label="Related Service (Optional)"
                  >
                    <MenuItem value="">All Services</MenuItem>
                    {services.map((service) => (
                      <MenuItem key={service.id} value={service.id}>
                        {service.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={updateForm.status}
                    onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                    label="Status"
                  >
                    {updateForm.update_type === 'incident' && (
                      <>
                        <MenuItem value="investigating">Investigating</MenuItem>
                        <MenuItem value="identified">Identified</MenuItem>
                        <MenuItem value="monitoring">Monitoring</MenuItem>
                        <MenuItem value="resolved">Resolved</MenuItem>
                      </>
                    )}
                    {updateForm.update_type === 'maintenance' && (
                      <>
                        <MenuItem value="maintenance">Maintenance</MenuItem>
                        <MenuItem value="operational">Operational</MenuItem>
                      </>
                    )}
                    {updateForm.update_type === 'general' && (
                      <>
                        <MenuItem value="operational">Operational</MenuItem>
                        <MenuItem value="degraded">Degraded</MenuItem>
                        <MenuItem value="down">Down</MenuItem>
                        <MenuItem value="maintenance">Maintenance</MenuItem>
                      </>
                    )}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Update Message"
                  value={updateForm.message}
                  onChange={(e) => setUpdateForm({ ...updateForm, message: e.target.value })}
                  placeholder="Detailed information about this update..."
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setUpdateModalOpen(false)} disabled={postUpdateLoading}>
            Cancel
          </Button>
          <Button
            onClick={handlePostUpdate}
            variant="contained"
            disabled={postUpdateLoading || !updateForm.title || !updateForm.message}
            startIcon={postUpdateLoading ? <CircularProgress size={16} /> : <AnnouncementIcon />}
          >
            {postUpdateLoading ? 'Posting...' : 'Post Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 