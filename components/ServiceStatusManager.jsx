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
  Divider,
} from '@mui/material';
import {
  Edit as EditIcon,
  Add as AddIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Build as BuildIcon,
  OpenInNew as OpenInNewIcon,
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
      const response = await fetch(
        `/api/services?status_page_id=${statusPageId}`
      );
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
        body: JSON.stringify({ status: newStatus }),
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
          updateStatus =
            selectedService.status === 'down' ||
            selectedService.status === 'degraded'
              ? 'resolved'
              : 'operational';
          updateType =
            selectedService.status === 'down' ||
            selectedService.status === 'degraded'
              ? 'incident'
              : 'general';
        }

        const statusUpdatePayload = {
          title: `${selectedService.name} status updated to ${getStatusText(newStatus)}`,
          message: statusMessage.trim(),
          update_type: updateType,
          status: updateStatus,
          status_page_id: statusPageId,
          service_id: selectedService.id,
        };

        console.log('Posting status update with payload:', statusUpdatePayload);

        const statusUpdateResponse = await fetch('/api/status-updates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(statusUpdatePayload),
        });

        if (!statusUpdateResponse.ok) {
          console.warn(
            'Failed to post status update message, but service status was updated'
          );
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

  const openStatusModal = service => {
    setSelectedService(service);
    setNewStatus(service.status);
    setStatusMessage('');
    setStatusModalOpen(true);
  };

  const getStatusIcon = status => {
    switch (status) {
      case 'operational':
        return <CheckCircleIcon sx={{ color: 'success.main' }} />;
      case 'degraded':
        return <WarningIcon sx={{ color: 'warning.main' }} />;
      case 'down':
        return <ErrorIcon sx={{ color: 'error.main' }} />;
      case 'maintenance':
        return <BuildIcon sx={{ color: 'info.main' }} />;
      default:
        return <CheckCircleIcon sx={{ color: 'success.main' }} />;
    }
  };

  const getStatusColor = status => {
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

  const getStatusText = status => {
    switch (status) {
      case 'operational':
        return 'Operational';
      case 'degraded':
        return 'Degraded';
      case 'down':
        return 'Down';
      case 'maintenance':
        return 'Maintenance';
      default:
        return 'Unknown';
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
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h5" component="h3">
          Service Status Management
        </Typography>
        <Box
          display="flex"
          flexDirection="column"
          alignItems="flex-end"
          gap={1}
        >
          {statusPage && statusPage.is_public && (
            <Button
              size="small"
              variant="text"
              startIcon={<OpenInNewIcon />}
              onClick={() =>
                window.open(`/status/${statusPage.slug}`, '_blank')
              }
              sx={{
                fontSize: '0.75rem',
                color: 'text.secondary',
                '&:hover': {
                  color: 'primary.main',
                },
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
          {services.map(service => (
            <Grid size={{ xs: 12, md: 6 }} key={service.id}>
              <Card elevation={1}>
                <CardContent>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    mb={2}
                  >
                    <Box flex={1}>
                      <Typography variant="h6" gutterBottom>
                        {service.name}
                      </Typography>
                      {service.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 2 }}
                        >
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
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Service Status Update Modal */}
      <Dialog
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
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
                  onChange={e => setNewStatus(e.target.value)}
                  label="Service Status"
                >
                  <MenuItem value="operational">
                    <Box display="flex" alignItems="center" gap={1}>
                      <CheckCircleIcon
                        sx={{ color: 'success.main', fontSize: 20 }}
                      />
                      Operational
                    </Box>
                  </MenuItem>
                  <MenuItem value="degraded">
                    <Box display="flex" alignItems="center" gap={1}>
                      <WarningIcon
                        sx={{ color: 'warning.main', fontSize: 20 }}
                      />
                      Degraded Performance
                    </Box>
                  </MenuItem>
                  <MenuItem value="down">
                    <Box display="flex" alignItems="center" gap={1}>
                      <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
                      Outage
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
                onChange={e => setStatusMessage(e.target.value)}
                placeholder="Provide details about this status change..."
                helperText="This message will be posted as a status update if provided"
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setStatusModalOpen(false)}
            disabled={statusUpdateLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleStatusUpdate}
            variant="contained"
            disabled={statusUpdateLoading || !newStatus}
            startIcon={
              statusUpdateLoading ? (
                <CircularProgress size={16} />
              ) : (
                <EditIcon />
              )
            }
          >
            {statusUpdateLoading ? 'Updating...' : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
