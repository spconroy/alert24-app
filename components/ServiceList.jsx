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
  Delete as DeleteIcon,
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

  // Delete service modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const handleDeleteService = service => {
    setServiceToDelete(service);
    setDeleteModalOpen(true);
  };

  const confirmDeleteService = async () => {
    if (!serviceToDelete) return;

    try {
      setDeleteLoading(true);

      const response = await fetch(`/api/services/${serviceToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete service');
      }

      // Remove the deleted service from the local state
      setServices(prevServices =>
        prevServices.filter(service => service.id !== serviceToDelete.id)
      );

      // Close the modal and clear state
      setDeleteModalOpen(false);
      setServiceToDelete(null);

      console.log('Service deleted successfully:', serviceToDelete.name);
    } catch (err) {
      console.error('Error deleting service:', err);
      setError(err.message);
    } finally {
      setDeleteLoading(false);
    }
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
      check =>
        check.current_status !== 'inactive' && check.current_status === 'down'
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
                      {typeof service.name === 'string' ? service.name : service.id || 'Unknown Service'}
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

                    <Tooltip title="Delete Service">
                      <IconButton
                        onClick={() => handleDeleteService(service)}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
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
                    {typeof service.description === 'string' ? service.description : ''}
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

                {/* Monitoring Checks Section - Always visible when checks exist */}
                {monitoringCount > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Divider sx={{ mb: 2 }} />
                    <Typography
                      variant="subtitle2"
                      gutterBottom
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      Monitoring Checks ({monitoringCount})
                    </Typography>
                    <Grid container spacing={2}>
                      {service.monitoring_checks?.map(check => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={check.id}>
                          <Box
                            sx={{
                              p: 2,
                              border: '1px solid',
                              borderColor: 'grey.200',
                              borderRadius: 1,
                              backgroundColor: 'background.paper',
                              '&:hover': {
                                backgroundColor: 'grey.50',
                              },
                            }}
                          >
                            <Box
                              display="flex"
                              alignItems="center"
                              justifyContent="space-between"
                              mb={1}
                            >
                              <Typography variant="body2" fontWeight="medium">
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
                                      : check.current_status === 'warning'
                                        ? 'warning'
                                        : check.current_status === 'pending'
                                          ? 'info'
                                          : check.current_status === 'inactive'
                                            ? 'default'
                                            : 'default'
                                }
                                variant="outlined"
                              />
                            </Box>

                            <Typography
                              variant="caption"
                              display="block"
                              color="text.secondary"
                              mb={1}
                            >
                              {check.check_type?.toUpperCase()} •{' '}
                              {check.target_url}
                            </Typography>

                            {check.last_check_time && (
                              <Typography
                                variant="caption"
                                display="block"
                                color="text.secondary"
                              >
                                Last check:{' '}
                                {new Date(
                                  check.last_check_time
                                ).toLocaleString()}
                              </Typography>
                            )}

                            {check.last_response_time && (
                              <Typography
                                variant="caption"
                                display="block"
                                color="text.secondary"
                              >
                                Response:{' '}
                                {check.last_response_time < 1000
                                  ? `${check.last_response_time}ms`
                                  : `${(check.last_response_time / 1000).toFixed(2)}s`}
                              </Typography>
                            )}

                            {check.failure_message &&
                              check.current_status !== 'inactive' && (
                                <Typography
                                  variant="caption"
                                  display="block"
                                  color="error.main"
                                  sx={{ mt: 1, fontStyle: 'italic' }}
                                >
                                  {check.failure_message}
                                </Typography>
                              )}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}

                {/* Expanded Monitoring Details (Legacy - kept for backward compatibility) */}
                {monitoringCount > 0 && (
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box pt={2}>
                      <Typography
                        variant="subtitle2"
                        gutterBottom
                        color="text.secondary"
                      >
                        Detailed Monitoring Information
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
                                          : check.current_status === 'warning'
                                            ? 'warning'
                                            : check.current_status === 'pending'
                                              ? 'info'
                                              : 'default'
                                    }
                                    variant="outlined"
                                  />
                                </Box>
                              }
                              secondary={
                                <Box>
                                  <Typography variant="caption" display="block">
                                    Interval:{' '}
                                    {check.check_interval_seconds
                                      ? `${check.check_interval_seconds}s`
                                      : 'Unknown'}
                                  </Typography>
                                  <Typography variant="caption" display="block">
                                    Timeout: {check.timeout_seconds || 30}s
                                  </Typography>
                                  {check.failure_message &&
                                    check.current_status !== 'inactive' && (
                                      <Typography
                                        variant="caption"
                                        display="block"
                                        color="error.main"
                                      >
                                        Error: {check.failure_message}
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setServiceToDelete(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
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
              Delete Service
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This action cannot be undone
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body1" gutterBottom>
              Are you sure you want to delete this service?
            </Typography>

            {serviceToDelete && (
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
                  {serviceToDelete.name}
                </Typography>
                {serviceToDelete.description && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    {serviceToDelete.description}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Chip
                    label={statusLabels[serviceToDelete.status]}
                    color={statusColors[serviceToDelete.status]}
                    size="small"
                  />
                  {getMonitoringCheckCount(serviceToDelete) > 0 && (
                    <Chip
                      icon={<MonitorHeart />}
                      label={`${getMonitoringCheckCount(serviceToDelete)} monitoring checks`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
              </Box>
            )}
          </Box>

          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              This will permanently remove the service and all associated
              monitoring configurations, uptime history, and status updates. Any
              linked monitoring checks will be disconnected.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 1, gap: 1 }}>
          <Button
            onClick={() => {
              setDeleteModalOpen(false);
              setServiceToDelete(null);
            }}
            disabled={deleteLoading}
            variant="outlined"
            size="large"
            sx={{ minWidth: 100 }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDeleteService}
            color="error"
            variant="contained"
            disabled={deleteLoading}
            startIcon={
              deleteLoading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <DeleteIcon />
              )
            }
            size="large"
            sx={{ minWidth: 120 }}
          >
            {deleteLoading ? 'Deleting...' : 'Delete Service'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

export default ServiceList;
