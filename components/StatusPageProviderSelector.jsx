'use client';

import { useState, useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Chip,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Checkbox,
  FormControlLabel,
  Alert,
  CircularProgress
} from '@mui/material';
import { Cloud, Storage, Functions, Dns } from '@mui/icons-material';

const providerIcons = {
  azure: <Cloud color="primary" />,
  aws: <Storage color="warning" />,
  gcp: <Functions color="success" />
};

const StatusPageProviderSelector = ({ 
  selectedProvider, 
  selectedService, 
  selectedRegions, 
  onProviderChange, 
  onServiceChange, 
  onRegionsChange 
}) => {
  const [providers, setProviders] = useState([]);
  const [services, setServices] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load providers on component mount
  useEffect(() => {
    loadProviders();
  }, []);

  // Load services when provider changes
  useEffect(() => {
    if (selectedProvider) {
      loadServices(selectedProvider);
    }
  }, [selectedProvider]);

  // Load regions when service changes
  useEffect(() => {
    if (selectedProvider && selectedService) {
      loadRegions(selectedProvider, selectedService);
    }
  }, [selectedProvider, selectedService]);

  const loadProviders = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/status-page-providers');
      const data = await response.json();
      
      if (data.success) {
        setProviders(data.providers);
      } else {
        setError('Failed to load providers');
      }
    } catch (err) {
      setError('Error loading providers: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadServices = async (provider) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/status-page-providers?provider=${provider}`);
      const data = await response.json();
      
      if (data.success) {
        setServices(data.services);
      } else {
        setError('Failed to load services');
      }
    } catch (err) {
      setError('Error loading services: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadRegions = async (provider, service) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/status-page-providers?provider=${provider}&service=${service}`);
      const data = await response.json();
      
      if (data.success) {
        setRegions(data.regions);
      } else {
        setError('Failed to load regions');
      }
    } catch (err) {
      setError('Error loading regions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (providerId) => {
    onProviderChange(providerId);
    onServiceChange(''); // Reset service selection
    onRegionsChange([]); // Reset regions selection
  };

  const handleServiceChange = (serviceId) => {
    onServiceChange(serviceId);
    onRegionsChange([]); // Reset regions selection
  };

  const handleRegionToggle = (regionId) => {
    const newRegions = selectedRegions.includes(regionId)
      ? selectedRegions.filter(r => r !== regionId)
      : [...selectedRegions, regionId];
    onRegionsChange(newRegions);
  };

  const handleSelectAllRegions = () => {
    if (selectedRegions.length === regions.length) {
      onRegionsChange([]);
    } else {
      onRegionsChange(regions);
    }
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Provider Selection */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        Select Cloud Provider
      </Typography>
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {providers.map((provider) => (
          <Grid item xs={12} md={4} key={provider.id}>
            <Card 
              sx={{ 
                border: selectedProvider === provider.id ? 2 : 1,
                borderColor: selectedProvider === provider.id ? 'primary.main' : 'divider'
              }}
            >
              <CardActionArea onClick={() => handleProviderChange(provider.id)}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2}>
                    {providerIcons[provider.id]}
                    <Box>
                      <Typography variant="h6">{provider.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {provider.description}
                      </Typography>
                      <Chip 
                        label={`${provider.service_count} services`} 
                        size="small" 
                        sx={{ mt: 1 }}
                      />
                    </Box>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Service Selection */}
      {selectedProvider && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Select Service
          </Typography>
          
          <FormControl fullWidth>
            <InputLabel>Service</InputLabel>
            <Select
              value={selectedService}
              onChange={(e) => handleServiceChange(e.target.value)}
              label="Service"
              disabled={loading}
            >
              {services.map((service) => (
                <MenuItem key={service.id} value={service.id}>
                  <Box>
                    <Typography variant="body1">{service.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {service.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Region Selection */}
      {selectedProvider && selectedService && regions.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Select Regions
          </Typography>
          
          <FormControlLabel
            control={
              <Checkbox
                checked={selectedRegions.length === regions.length && regions.length > 0}
                indeterminate={selectedRegions.length > 0 && selectedRegions.length < regions.length}
                onChange={handleSelectAllRegions}
                disabled={loading}
              />
            }
            label="Select All Regions"
            sx={{ mb: 2 }}
          />
          
          <Grid container spacing={1}>
            {regions.map((region) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={region}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedRegions.includes(region)}
                      onChange={() => handleRegionToggle(region)}
                      disabled={loading}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      {region === 'global' ? 'Global' : region.replace(/-/g, ' ').toUpperCase()}
                    </Typography>
                  }
                />
              </Grid>
            ))}
          </Grid>
          
          {selectedRegions.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Selected: {selectedRegions.length} regions
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" sx={{ my: 2 }}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
};

export default StatusPageProviderSelector;