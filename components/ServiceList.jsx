import React, {
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Typography,
  Box,
  Chip,
  IconButton,
  Button,
  Collapse,
  Divider,
  Tooltip,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Edit,
  Link as LinkIcon,
  MonitorHeart,
  Warning,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Build as BuildIcon,
} from '@mui/icons-material';
import ServiceMonitoringConfig from './ServiceMonitoringConfig';
import EditServiceForm from './EditServiceForm';
import ServiceUptimeTimeline from './ServiceUptimeTimeline';
import ServiceUptimeStats from './ServiceUptimeStats';

const statusColors = {
  operational: 'success',
  degraded: 'warning',
  down: 'error',
  maintenance: 'info',
};

const statusLabels = {
  operational: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
  maintenance: 'Maintenance',
};

const ServiceList = forwardRef(function ServiceList({ statusPageId }, ref) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedServices, setExpandedServices] = useState(new Set());
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);

  // Status update modal state
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusUpdateService, setStatusUpdateService] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);

  const fetchServices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/services?status_page_id=${statusPageId}`);
      console.log('Services API response:', res.status, res.statusText);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Services API error:', errorData);
        throw new Error(
          errorData.error || `HTTP ${res.status}: ${res.statusText}`
        );
      }
      const data = await res.json();
      console.log('Services data:', data);
      setServices(data.services || []);
    } catch (err) {
      console.error('Fetch services error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    fetchServices,
    getServices: () => services,
  }));

  useEffect(() => {
    if (statusPageId) fetchServices();
  }, [statusPageId]);

  // Auto-refresh services every 30 seconds to stay in sync with database
  useEffect(() => {
    if (!statusPageId) return;

    const interval = setInterval(() => {
      fetchServices();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [statusPageId]);

  const handleExpandService = serviceId => {
    const newExpanded = new Set(expandedServices);
    if (newExpanded.has(serviceId)) {
      newExpanded.delete(serviceId);
    } else {
      newExpanded.add(serviceId);
    }
    setExpandedServices(newExpanded);
  };

  const handleConfigureMonitoring = service => {
    setSelectedService(service);
    setConfigModalOpen(true);
  };

  const handleEditService = service => {
    setSelectedService(service);
    setEditModalOpen(true);
  };

  const handleServiceUpdated = updatedService => {
    setServices(prevServices =>
      prevServices.map(service =>
        service.id === updatedService.id
          ? { ...service, ...updatedService }
          : service
      )
    );
  };

  const getMonitoringCheckCount = service => {
    return service.monitoring_checks?.length || 0;
  };

  const getFailingChecksCount = service => {
    if (!service.monitoring_checks) return 0;
    return service.monitoring_checks.filter(
      check => check.current_status === 'down'
    ).length;
  };

  // Status update functions
  const handleStatusUpdate = async () => {
    if (!statusUpdateService || !newStatus) return;

    try {
      setStatusUpdateLoading(true);

      // Update the service status
      const response = await fetch(`/api/services/${statusUpdateService.id}`, {
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
            statusUpdateService.status === 'down' ||
            statusUpdateService.status === 'degraded'
              ? 'resolved'
              : 'operational';
          updateType =
            statusUpdateService.status === 'down' ||
            statusUpdateService.status === 'degraded'
              ? 'incident'
              : 'general';
        }

        const statusUpdatePayload = {
          title: `${statusUpdateService.name} status updated to ${getStatusText(newStatus)}`,
          message: statusMessage.trim(),
          update_type: updateType,
          status: updateStatus,
          status_page_id: statusPageId,
          service_id: statusUpdateService.id,
        };

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
      setStatusModalOpen(false);
      setStatusUpdateService(null);
      setNewStatus('');
      setStatusMessage('');
    } catch (err) {
      setError(err.message);
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  const openStatusModal = service => {
    setStatusUpdateService(service);
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

  return (
    <Box>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && services.length === 0 && (
        <Typography color="text.secondary">
          No services yet. Click the "Add Service" button above to get started.
        </Typography>
      )}
      {!loading && !error && services.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {services.map(service => {
            const isExpanded = expandedServices.has(service.id);
            const monitoringCount = getMonitoringCheckCount(service);
            const failingCount = getFailingChecksCount(service);

            return (
              <Paper
                key={service.id}
                elevation={1}
                sx={{
                  p: 3,
                  '&:hover': {
                    elevation: 2,
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  },
                }}
              >
                {/* Service Header */}
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  mb={2}
                >
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="h6" fontWeight="medium">
                      {service.name}
                    </Typography>
                    <Chip
                      label={statusLabels[service.status]}
                      color={statusColors[service.status]}
                      size="small"
                    />
                    {monitoringCount > 0 && (
                      <Chip
                        icon={<MonitorHeart />}
                        label={`${monitoringCount} checks`}
                        size="small"
                        variant="outlined"
                        color={failingCount > 0 ? 'error' : 'success'}
                      />
                    )}
                    {failingCount > 0 && (
                      <Chip
                        icon={<Warning />}
                        label={`${failingCount} failing`}
                        size="small"
                        color="error"
                      />
                    )}
                  </Box>

                  {/* Action Buttons */}
                  <Box display="flex" alignItems="center" gap={1}>
                    <Tooltip title="Configure Monitoring">
                      <IconButton
                        onClick={() => handleConfigureMonitoring(service)}
                        color="primary"
                        size="small"
                      >
                        <LinkIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Edit Service">
                      <IconButton
                        onClick={() => handleEditService(service)}
                        color="primary"
                        size="small"
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>

                    {monitoringCount > 0 && (
                      <IconButton
                        onClick={() => handleExpandService(service.id)}
                        size="small"
                      >
                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    )}
                  </Box>
                </Box>

                {/* Service Description */}
                {service.description && (
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    {service.description}
                  </Typography>
                )}

                {/* SLA Section */}
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={3}
                >
                  {/* Timeline Visualization */}
                  <Box flex={1}>
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      mb={1}
                    >
                      Last 30 days
                    </Typography>
                    <ServiceUptimeTimeline serviceId={service.id} days={30} />
                  </Box>

                  {/* Uptime Stats */}
                  <Box>
                    <ServiceUptimeStats serviceId={service.id} compact={true} />
                  </Box>
                </Box>

                {/* Update Status Button */}
                <Box mt={3} display="flex" justifyContent="flex-start">
                  <Button
                    onClick={() => openStatusModal(service)}
                    variant="outlined"
                    size="small"
                    startIcon={<Edit />}
                    sx={{ minWidth: 140 }}
                  >
                    Update Status
                  </Button>
                </Box>

                {/* Expanded Monitoring Details */}
                {monitoringCount > 0 && (
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box pt={3}>
                      <Divider sx={{ mb: 2 }} />
                      <Typography
                        variant="subtitle2"
                        gutterBottom
                        color="text.secondary"
                      >
                        Associated Monitoring Checks
                      </Typography>
                      <List dense>
                        {service.monitoring_checks?.map(check => (
                          <ListItem key={check.id} sx={{ py: 0.5, pl: 0 }}>
                            <ListItemText
                              primary={
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Typography variant="body2">
                                    {check.name}
                                  </Typography>
                                  <Chip
                                    label={check.current_status || 'unknown'}
                                    size="small"
                                    color={
                                      check.current_status === 'up'
                                        ? 'success'
                                        : check.current_status === 'down'
                                          ? 'error'
                                          : 'default'
                                    }
                                    variant="outlined"
                                  />
                                </Box>
                              }
                              secondary={
                                <Box>
                                  <Typography variant="caption" display="block">
                                    Threshold: {check.failure_threshold || 5}{' '}
                                    minutes
                                  </Typography>
                                  {check.failure_message && (
                                    <Typography
                                      variant="caption"
                                      display="block"
                                      color="text.secondary"
                                    >
                                      Message: {check.failure_message}
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  </Collapse>
                )}
              </Paper>
            );
          })}
        </Box>
      )}

      {/* Service Monitoring Configuration Modal */}
      <ServiceMonitoringConfig
        open={configModalOpen}
        onClose={() => {
          setConfigModalOpen(false);
          setSelectedService(null);
        }}
        service={selectedService}
        onConfigUpdated={fetchServices}
      />

      {/* Edit Service Modal */}
      <EditServiceForm
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedService(null);
        }}
        service={selectedService}
        onServiceUpdated={handleServiceUpdated}
      />

      {/* Status Update Modal */}
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
          {statusUpdateService && (
            <>
              <Typography variant="body1" sx={{ mb: 3 }}>
                Update the status for{' '}
                <strong>{statusUpdateService.name}</strong>
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
              statusUpdateLoading ? <CircularProgress size={16} /> : <Edit />
            }
          >
            {statusUpdateLoading ? 'Updating...' : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

export default ServiceList;
