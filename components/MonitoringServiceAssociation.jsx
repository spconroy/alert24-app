import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  Monitor as MonitoringIcon,
  Web as WebIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';

const MonitoringServiceAssociation = ({ organizationId }) => {
  const [associations, setAssociations] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Association dialog state
  const [associationDialogOpen, setAssociationDialogOpen] = useState(false);
  const [selectedMonitoringCheck, setSelectedMonitoringCheck] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [failureStatus, setFailureStatus] = useState('degraded');
  const [associationLoading, setAssociationLoading] = useState(false);

  // Fetch associations and available services
  const fetchData = async () => {
    if (!organizationId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/monitoring/associate?organization_id=${organizationId}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch associations');
      }

      const data = await response.json();
      setAssociations(data.associations || []);
      setAvailableServices(data.available_services || []);
    } catch (err) {
      console.error('Error fetching associations:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [organizationId]);

  // Create or update association
  const handleCreateAssociation = async () => {
    if (!selectedMonitoringCheck) {
      setError('Please select a monitoring check');
      return;
    }

    setAssociationLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/monitoring/associate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          monitoringCheckId: selectedMonitoringCheck,
          serviceId: selectedService || null,
          failureStatus: failureStatus,
          organizationId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create association');
      }

      const data = await response.json();
      setSuccess(data.message);
      setAssociationDialogOpen(false);
      setSelectedMonitoringCheck('');
      setSelectedService('');
      setFailureStatus('degraded');
      fetchData(); // Refresh data
    } catch (err) {
      console.error('Error creating association:', err);
      setError(err.message);
    } finally {
      setAssociationLoading(false);
    }
  };

  // Remove association
  const handleRemoveAssociation = async monitoringCheckId => {
    console.log('Starting association removal for monitoring check:', monitoringCheckId);
    console.log('Organization ID:', organizationId);
    
    try {
      const url = `/api/monitoring/associate?monitoring_check_id=${monitoringCheckId}&organization_id=${organizationId}`;
      console.log('DELETE request URL:', url);
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('DELETE response status:', response.status);
      console.log('DELETE response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('DELETE error response:', errorData);
        throw new Error(errorData.error || 'Failed to remove association');
      }

      const data = await response.json();
      console.log('DELETE success response:', data);
      setSuccess(data.message || 'Association removed successfully');
      
      // Add a small delay before refreshing to ensure the delete has propagated
      setTimeout(() => {
        fetchData(); // Refresh data
      }, 500);
    } catch (err) {
      console.error('Error removing association:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
      });
      setError(err.message);
    }
  };

  // Get status color for service status
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

  // Get available monitoring checks that are not yet associated
  const getAvailableMonitoringChecks = () => {
    return associations.filter(assoc => !assoc.linked_service_id);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
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
        <Typography variant="h6" component="h2">
          <LinkIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Monitoring & Service Associations
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAssociationDialogOpen(true)}
          disabled={getAvailableMonitoringChecks().length === 0}
        >
          Create Association
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Active Associations
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            When monitoring checks fail, they will automatically update the
            status of linked services on your status pages.
          </Typography>

          {associations.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
                <Typography variant="body2" gutterBottom>
                  <strong>
                    No monitoring checks found for this organization.
                  </strong>
                </Typography>
                <Typography variant="body2" gutterBottom>
                  Monitoring checks test your services automatically and can
                  update status page services when issues are detected.
                </Typography>
                <Typography variant="body2">
                  Create monitoring checks first, then return here to link them
                  to your status page services.
                </Typography>
              </Alert>

              <Box
                sx={{
                  mt: 3,
                  p: 3,
                  backgroundColor: 'grey.50',
                  borderRadius: 2,
                }}
              >
                <Typography variant="h6" gutterBottom color="primary">
                  Get Started with Monitoring
                </Typography>
                <Typography variant="body2" gutterBottom sx={{ mb: 2 }}>
                  Follow these steps to set up automated service monitoring:
                </Typography>

                <Box sx={{ textAlign: 'left', mb: 3 }}>
                  <Typography
                    variant="body2"
                    component="div"
                    sx={{ '& strong': { color: 'primary.main' } }}
                  >
                    <strong>Step 1:</strong> Create monitoring checks for your
                    critical services (websites, APIs, databases)
                    <br />
                    <strong>Step 2:</strong> Return to this page to associate
                    checks with status page services
                    <br />
                    <strong>Step 3:</strong> When monitoring detects issues,
                    service status updates automatically
                    <br />
                    <strong>Step 4:</strong> Your users see real-time status
                    updates on your status page
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: 'flex',
                    gap: 2,
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    href="/monitoring/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    size="large"
                  >
                    Create Your First Check
                  </Button>
                  <Button
                    variant="outlined"
                    href="/monitoring"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View All Monitoring
                  </Button>
                </Box>
              </Box>
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Monitoring Check</TableCell>
                    <TableCell>Check Type</TableCell>
                    <TableCell>Target URL</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Linked Service</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {associations.map(association => (
                    <TableRow key={association.monitoring_check_id}>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <MonitoringIcon
                            sx={{ mr: 1, color: 'primary.main' }}
                          />
                          {association.monitoring_check_name}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={
                            association.check_type?.toUpperCase() || 'HTTP'
                          }
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {association.target_url}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={
                            association.status === 'active'
                              ? 'Active'
                              : 'Inactive'
                          }
                          color={
                            association.status === 'active'
                              ? 'success'
                              : 'default'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {association.linked_service_id ? (
                          <Box display="flex" alignItems="center">
                            <WebIcon sx={{ mr: 1, color: 'secondary.main' }} />
                            <Typography variant="body2">
                              {association.linked_service_name}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            fontStyle="italic"
                          >
                            Not linked
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {association.linked_service_id ? (
                          <Tooltip title="Remove association">
                            <IconButton
                              size="small"
                              onClick={() =>
                                handleRemoveAssociation(
                                  association.monitoring_check_id
                                )
                              }
                              color="error"
                            >
                              <LinkOffIcon />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Create association">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedMonitoringCheck(
                                  association.monitoring_check_id
                                );
                                setAssociationDialogOpen(true);
                              }}
                              color="primary"
                            >
                              <LinkIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Association Dialog */}
      <Dialog
        open={associationDialogOpen}
        onClose={() => {
          setAssociationDialogOpen(false);
          setSelectedMonitoringCheck('');
          setSelectedService('');
          setFailureStatus('degraded');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Monitoring Association</DialogTitle>
        <DialogContent>
          <Box pt={1}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Monitoring Check</InputLabel>
              <Select
                value={selectedMonitoringCheck}
                onChange={e => setSelectedMonitoringCheck(e.target.value)}
                label="Monitoring Check"
              >
                {getAvailableMonitoringChecks().map(assoc => (
                  <MenuItem
                    key={assoc.monitoring_check_id}
                    value={assoc.monitoring_check_id}
                  >
                    <Box>
                      <Typography variant="body2">
                        {assoc.monitoring_check_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {assoc.check_type?.toUpperCase()} - {assoc.target_url}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <InputLabel>Status Page Service (Optional)</InputLabel>
              <Select
                value={selectedService}
                onChange={e => setSelectedService(e.target.value)}
                label="Status Page Service (Optional)"
              >
                <MenuItem value="">
                  <em>No service (remove association)</em>
                </MenuItem>
                {availableServices.map(service => (
                  <MenuItem key={service.id} value={service.id}>
                    <Box display="flex" alignItems="center" width="100%">
                      <Box flexGrow={1}>
                        <Typography variant="body2">{service.name}</Typography>
                        {service.description && (
                          <Typography variant="caption" color="text.secondary">
                            {service.description}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        label={service.status || 'operational'}
                        color={getStatusColor(service.status)}
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <InputLabel>Failure Impact</InputLabel>
              <Select
                value={failureStatus}
                onChange={e => setFailureStatus(e.target.value)}
                label="Failure Impact"
              >
                <MenuItem value="degraded">
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      Degraded Performance
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Service will be marked as degraded when this check fails
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="down">
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      Service Down
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Service will be marked as down when this check fails
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="maintenance">
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      Maintenance Mode
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Service will be marked as under maintenance when this
                      check fails
                    </Typography>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            <Alert severity="info" sx={{ mt: 2 }}>
              When the monitoring check fails, the linked service status will
              automatically update based on the failure impact you've selected.
              When the check recovers, the service status will return to
              operational.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setAssociationDialogOpen(false)}
            disabled={associationLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateAssociation}
            variant="contained"
            disabled={associationLoading || !selectedMonitoringCheck}
            startIcon={
              associationLoading ? <CircularProgress size={20} /> : <LinkIcon />
            }
          >
            {associationLoading ? 'Creating...' : 'Create Association'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MonitoringServiceAssociation;
