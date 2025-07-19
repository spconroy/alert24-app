'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Divider,
  FormHelperText,
} from '@mui/material';
import { CheckCircle, Error, Warning } from '@mui/icons-material';
import { useOrganization } from '@/contexts/OrganizationContext';
import StatusPageProviderSelector from './StatusPageProviderSelector';

const StatusPageCheckForm = ({ onSuccess, onCancel }) => {
  const { selectedOrganization } = useOrganization();
  const [formData, setFormData] = useState({
    name: '',
    provider: '',
    service: '',
    regions: [],
    check_interval_seconds: 300,
    linked_service_id: '',
    failure_behavior: 'match_status', // 'match_status', 'always_degraded', 'always_down'
    failure_message: '',
  });
  const [availableServices, setAvailableServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState(null);

  // Load available services for linking
  const loadAvailableServices = async () => {
    if (!selectedOrganization?.id) {
      console.log('No organization selected, skipping services load');
      setAvailableServices([]);
      return;
    }

    try {
      console.log(
        'Loading services for organization:',
        selectedOrganization.id
      );
      const response = await fetch(
        `/api/services?organization_id=${selectedOrganization.id}`
      );

      if (!response.ok) {
        console.error(
          'Services API request failed:',
          response.status,
          response.statusText
        );
        const errorData = await response.json();
        console.error('Error details:', errorData);
        setAvailableServices([]);
        return;
      }

      const data = await response.json();
      console.log('Services API response:', data);

      if (data.success) {
        console.log('Setting available services:', data.services || []);
        setAvailableServices(data.services || []);
      } else {
        console.warn('Services API returned no success flag:', data);
        setAvailableServices([]);
      }
    } catch (err) {
      console.error('Error loading services:', err);
      setAvailableServices([]);
    }
  };

  useEffect(() => {
    if (selectedOrganization?.id) {
      loadAvailableServices();
    }
  }, [selectedOrganization]);

  // Debug logging can be removed in production
  useEffect(() => {
    console.log('Available services state updated:', availableServices);
  }, [availableServices]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Auto-generate name if not manually set
    if (field === 'provider' || field === 'service') {
      const provider = field === 'provider' ? value : formData.provider;
      const service = field === 'service' ? value : formData.service;

      if (provider && service && !formData.name) {
        const providerName = provider.toUpperCase();
        const serviceName = service
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
        setFormData(prev => ({
          ...prev,
          name: `${providerName} - ${serviceName}`,
        }));
      }
    }
  };

  const handlePreview = async () => {
    if (!formData.provider || !formData.service) {
      setError('Please select both provider and service');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/status-page-scraper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: formData.provider,
          service: formData.service,
          regions: formData.regions,
          action: 'scrape',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPreviewData(data.result);
      } else {
        setError('Failed to preview status: ' + data.error);
      }
    } catch (err) {
      setError('Error previewing status: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!formData.name || !formData.provider || !formData.service) {
      setError('Please fill in all required fields');
      return;
    }

    if (!selectedOrganization?.id) {
      setError('No organization selected');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Format the check configuration
      const checkConfig = {
        name: formData.name,
        check_type: 'status_page',
        target_url: '', // Will be set by the backend based on provider
        organization_id: selectedOrganization.id,
        check_interval_seconds: formData.check_interval_seconds,
        timeout_seconds: 30,
        linked_service_id: formData.linked_service_id || null,
        status_page_config: {
          provider: formData.provider,
          service: formData.service,
          regions: formData.regions,
          failure_behavior: formData.failure_behavior,
          failure_message: formData.failure_message,
        },
      };

      const response = await fetch('/api/monitoring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checkConfig),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess(data.monitoring_check);
      } else {
        setError('Failed to create check: ' + data.error);
      }
    } catch (err) {
      setError('Error creating check: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = status => {
    switch (status) {
      case 'up':
        return <CheckCircle color="success" />;
      case 'down':
        return <Error color="error" />;
      case 'degraded':
        return <Warning color="warning" />;
      default:
        return <Warning color="disabled" />;
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Create Status Page Check
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          {/* Provider Selection */}
          <StatusPageProviderSelector
            selectedProvider={formData.provider}
            selectedService={formData.service}
            selectedRegions={formData.regions}
            onProviderChange={provider =>
              handleInputChange('provider', provider)
            }
            onServiceChange={service => handleInputChange('service', service)}
            onRegionsChange={regions => handleInputChange('regions', regions)}
          />

          <Divider sx={{ my: 3 }} />

          {/* Check Configuration */}
          <Typography variant="h6" sx={{ mb: 2 }}>
            Check Configuration
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Check Name"
                value={formData.name}
                onChange={e => handleInputChange('name', e.target.value)}
                required
                helperText="A descriptive name for this status page check"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Check Interval</InputLabel>
                <Select
                  value={formData.check_interval_seconds}
                  onChange={e =>
                    handleInputChange('check_interval_seconds', e.target.value)
                  }
                  label="Check Interval"
                >
                  <MenuItem value={60}>1 minute</MenuItem>
                  <MenuItem value={300}>5 minutes</MenuItem>
                  <MenuItem value={600}>10 minutes</MenuItem>
                  <MenuItem value={1800}>30 minutes</MenuItem>
                  <MenuItem value={3600}>1 hour</MenuItem>
                </Select>
                <FormHelperText>
                  How often to check the status page
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Link to Service (Optional)</InputLabel>
                <Select
                  value={formData.linked_service_id}
                  onChange={e =>
                    handleInputChange('linked_service_id', e.target.value)
                  }
                  label="Link to Service (Optional)"
                >
                  <MenuItem value="">None</MenuItem>
                  {availableServices.length === 0 ? (
                    <MenuItem disabled>No services available</MenuItem>
                  ) : (
                    availableServices.map(service => (
                      <MenuItem key={service.id} value={service.id}>
                        {service.name}
                      </MenuItem>
                    ))
                  )}
                </Select>
                <FormHelperText>
                  {availableServices.length === 0
                    ? 'No services available. Create a status page and add services first.'
                    : 'Optionally link this check to a service on your status page'}
                </FormHelperText>
              </FormControl>
            </Grid>

            {/* Failure Behavior Configuration */}
            {formData.linked_service_id && (
              <>
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                    Failure Behavior
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    Configure how failures in the status page check should
                    affect your linked service
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>When Status Page Shows Issues</InputLabel>
                    <Select
                      value={formData.failure_behavior}
                      onChange={e =>
                        handleInputChange('failure_behavior', e.target.value)
                      }
                      label="When Status Page Shows Issues"
                    >
                      <MenuItem value="match_status">
                        Match Provider Status
                      </MenuItem>
                      <MenuItem value="always_degraded">
                        Always Mark as Degraded
                      </MenuItem>
                      <MenuItem value="always_down">
                        Always Mark as Down
                      </MenuItem>
                    </Select>
                    <FormHelperText>
                      {formData.failure_behavior === 'match_status' &&
                        'Service will be marked as degraded if provider shows degraded, down if provider shows down'}
                      {formData.failure_behavior === 'always_degraded' &&
                        'Service will always be marked as degraded when provider has any issues'}
                      {formData.failure_behavior === 'always_down' &&
                        'Service will always be marked as down when provider has any issues'}
                    </FormHelperText>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Custom Failure Message (Optional)"
                    value={formData.failure_message}
                    onChange={e =>
                      handleInputChange('failure_message', e.target.value)
                    }
                    placeholder="e.g., Dependent service experiencing issues"
                    helperText="Leave blank to use default message based on provider status"
                    multiline
                    rows={2}
                  />
                </Grid>
              </>
            )}
          </Grid>
        </Grid>

        <Grid item xs={12} md={4}>
          {/* Preview Panel */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Status Preview
              </Typography>

              {formData.provider && formData.service && (
                <Box sx={{ mb: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={handlePreview}
                    disabled={loading}
                    fullWidth
                  >
                    {loading ? 'Checking...' : 'Preview Current Status'}
                  </Button>
                </Box>
              )}

              {previewData && (
                <Box>
                  <Box
                    display="flex"
                    alignItems="center"
                    gap={1}
                    sx={{ mb: 2 }}
                  >
                    {getStatusIcon(previewData.status)}
                    <Typography variant="body1">
                      {previewData.status.charAt(0).toUpperCase() +
                        previewData.status.slice(1)}
                    </Typography>
                  </Box>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    Provider: {previewData.provider}
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    Service: {previewData.service}
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    Regions: {previewData.regions.join(', ')}
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    Last Updated:{' '}
                    {new Date(previewData.last_updated).toLocaleString()}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button variant="outlined" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={
            loading || !formData.name || !formData.provider || !formData.service
          }
        >
          {loading ? 'Creating...' : 'Create Check'}
        </Button>
      </Box>
    </Box>
  );
};

export default StatusPageCheckForm;
