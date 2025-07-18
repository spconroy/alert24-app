'use client';

import { useState, useContext } from 'react';
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
  FormHelperText
} from '@mui/material';
import { CheckCircle, Error, Warning } from '@mui/icons-material';
import { OrganizationContext } from '@/contexts/OrganizationContext';
import StatusPageProviderSelector from './StatusPageProviderSelector';

const StatusPageCheckForm = ({ onSuccess, onCancel }) => {
  const { currentOrganization } = useContext(OrganizationContext);
  const [formData, setFormData] = useState({
    name: '',
    provider: '',
    service: '',
    regions: [],
    check_interval_seconds: 300,
    linked_service_id: ''
  });
  const [availableServices, setAvailableServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState(null);

  // Load available services for linking
  const loadAvailableServices = async () => {
    try {
      const response = await fetch(`/api/services?organization_id=${currentOrganization.id}`);
      const data = await response.json();
      if (data.success) {
        setAvailableServices(data.services || []);
      }
    } catch (err) {
      console.error('Error loading services:', err);
    }
  };

  useState(() => {
    if (currentOrganization?.id) {
      loadAvailableServices();
    }
  }, [currentOrganization]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Auto-generate name if not manually set
    if (field === 'provider' || field === 'service') {
      const provider = field === 'provider' ? value : formData.provider;
      const service = field === 'service' ? value : formData.service;
      
      if (provider && service && !formData.name) {
        const providerName = provider.toUpperCase();
        const serviceName = service.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        setFormData(prev => ({
          ...prev,
          name: `${providerName} - ${serviceName}`
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
          action: 'scrape'
        })
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.provider || !formData.service) {
      setError('Please fill in all required fields');
      return;
    }

    if (!currentOrganization?.id) {
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
        organization_id: currentOrganization.id,
        check_interval_seconds: formData.check_interval_seconds,
        timeout_seconds: 30,
        linked_service_id: formData.linked_service_id || null,
        status_page_config: {
          provider: formData.provider,
          service: formData.service,
          regions: formData.regions
        }
      };

      const response = await fetch('/api/monitoring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checkConfig)
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

  const getStatusIcon = (status) => {
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
            onProviderChange={(provider) => handleInputChange('provider', provider)}
            onServiceChange={(service) => handleInputChange('service', service)}
            onRegionsChange={(regions) => handleInputChange('regions', regions)}
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
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                helperText="A descriptive name for this status page check"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Check Interval</InputLabel>
                <Select
                  value={formData.check_interval_seconds}
                  onChange={(e) => handleInputChange('check_interval_seconds', e.target.value)}
                  label="Check Interval"
                >
                  <MenuItem value={60}>1 minute</MenuItem>
                  <MenuItem value={300}>5 minutes</MenuItem>
                  <MenuItem value={600}>10 minutes</MenuItem>
                  <MenuItem value={1800}>30 minutes</MenuItem>
                  <MenuItem value={3600}>1 hour</MenuItem>
                </Select>
                <FormHelperText>How often to check the status page</FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Link to Service (Optional)</InputLabel>
                <Select
                  value={formData.linked_service_id}
                  onChange={(e) => handleInputChange('linked_service_id', e.target.value)}
                  label="Link to Service (Optional)"
                >
                  <MenuItem value="">None</MenuItem>
                  {availableServices.map((service) => (
                    <MenuItem key={service.id} value={service.id}>
                      {service.name}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  Optionally link this check to a service on your status page
                </FormHelperText>
              </FormControl>
            </Grid>
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
                  <Box display="flex" alignItems="center" gap={1} sx={{ mb: 2 }}>
                    {getStatusIcon(previewData.status)}
                    <Typography variant="body1">
                      {previewData.status.charAt(0).toUpperCase() + previewData.status.slice(1)}
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Provider: {previewData.provider}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Service: {previewData.service}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Regions: {previewData.regions.join(', ')}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary">
                    Last Updated: {new Date(previewData.last_updated).toLocaleString()}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={loading || !formData.name || !formData.provider || !formData.service}
        >
          {loading ? 'Creating...' : 'Create Check'}
        </Button>
      </Box>
    </Box>
  );
};

export default StatusPageCheckForm;