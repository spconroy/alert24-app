'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Grid,
  FormHelperText,
  Divider,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useOrganization } from '@/contexts/OrganizationContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import MonitoringLocationSelector from '@/components/MonitoringLocationSelector';

export default function CreateMonitoringCheckPage() {
  const router = useRouter();
  const { session, selectedOrganization } = useOrganization();

  const [formData, setFormData] = useState({
    name: '',
    check_type: 'http',
    target_url: '',
    check_interval_seconds: 300,
    timeout_seconds: 30,
    http_method: 'GET',
    http_headers: {},
    expected_status_codes: [200],
    keyword_match: '',
    keyword_match_type: 'contains',
    ssl_check_enabled: false,
    follow_redirects: true,
    notification_settings: {},
    is_active: true,
    monitoring_locations: ['00000000-0000-0000-0000-000000000001'], // Default to US East
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Headers management
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');

  // Status codes management
  const [newStatusCode, setNewStatusCode] = useState('');

  const validateForm = () => {
    const errors = {};

    if (!selectedOrganization)
      errors.organization = 'Please select an organization from the navbar';
    if (!formData.name.trim()) errors.name = 'Monitor name is required';
    if (!formData.target_url.trim()) {
      if (formData.check_type === 'ping') {
        errors.target_url = 'Hostname or IP address is required';
      } else if (formData.check_type === 'tcp') {
        errors.target_url = 'Hostname:port or IP:port is required';
      } else if (formData.check_type === 'ssl') {
        errors.target_url = 'Hostname or URL is required';
      } else {
        errors.target_url = 'Target URL is required';
      }
    }

    // URL validation - only for HTTP/HTTPS checks
    if (formData.target_url.trim()) {
      if (formData.check_type === 'http') {
        try {
          new URL(formData.target_url);
        } catch {
          errors.target_url =
            'Please enter a valid URL (e.g., https://example.com)';
        }
      } else if (formData.check_type === 'ping') {
        // Validate hostname/IP for ping checks
        const value = formData.target_url.trim();
        const ipRegex =
          /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const hostnameRegex =
          /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;

        if (!ipRegex.test(value) && !hostnameRegex.test(value)) {
          errors.target_url =
            'Please enter a valid hostname (e.g., example.com) or IP address (e.g., 192.168.1.1)';
        }
      } else if (formData.check_type === 'tcp') {
        // For TCP checks, allow hostname:port or IP:port format
        const value = formData.target_url.trim();
        const tcpRegex = /^[a-zA-Z0-9\-\.]+:\d+$/;
        if (!tcpRegex.test(value)) {
          errors.target_url =
            'Please enter hostname:port or IP:port (e.g., example.com:80 or 192.168.1.1:443)';
        }
        // Validate port range
        const portMatch = value.match(/:(\d+)$/);
        if (portMatch) {
          const port = parseInt(portMatch[1]);
          if (port < 1 || port > 65535) {
            errors.target_url = 'Port number must be between 1 and 65535';
          }
        }
      } else if (formData.check_type === 'ssl') {
        // SSL checks need hostname or URL
        const value = formData.target_url.trim();
        try {
          new URL(value.startsWith('http') ? value : `https://${value}`);
        } catch {
          errors.target_url =
            'Please enter a valid hostname or URL for SSL certificate checking';
        }
      }
    }

    // Interval validation
    if (formData.check_interval_seconds < 60) {
      errors.check_interval_seconds =
        'Check interval must be at least 60 seconds';
    }

    // Timeout validation
    if (
      formData.timeout_seconds < 1 ||
      formData.timeout_seconds >= formData.check_interval_seconds
    ) {
      errors.timeout_seconds =
        'Timeout must be between 1 second and less than check interval';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!validateForm()) {
      setError('Please fix the form errors before submitting');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Transform data to match API expectations
      const submitData = {
        ...formData,
        organization_id: selectedOrganization.id,
        monitoring_locations: formData.monitoring_locations,
        target_port: formData.check_type === 'tcp' ? 80 : null,
      };

      const response = await fetch('/api/monitoring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create monitoring check');
      }

      const data = await response.json();
      setSuccess(true);

      // Redirect to monitoring page after a short delay
      setTimeout(() => {
        router.push('/monitoring');
      }, 2000);
    } catch (err) {
      console.error('Error creating monitoring check:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear field error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const handleAddHeader = () => {
    if (headerKey.trim() && headerValue.trim()) {
      setFormData(prev => ({
        ...prev,
        http_headers: {
          ...prev.http_headers,
          [headerKey.trim()]: headerValue.trim(),
        },
      }));
      setHeaderKey('');
      setHeaderValue('');
    }
  };

  const handleRemoveHeader = key => {
    setFormData(prev => ({
      ...prev,
      http_headers: Object.keys(prev.http_headers).reduce((acc, k) => {
        if (k !== key) acc[k] = prev.http_headers[k];
        return acc;
      }, {}),
    }));
  };

  const handleAddStatusCode = () => {
    const code = parseInt(newStatusCode);
    if (
      code >= 100 &&
      code <= 599 &&
      !formData.expected_status_codes.includes(code)
    ) {
      setFormData(prev => ({
        ...prev,
        expected_status_codes: [...prev.expected_status_codes, code],
      }));
      setNewStatusCode('');
    }
  };

  const handleRemoveStatusCode = code => {
    setFormData(prev => ({
      ...prev,
      expected_status_codes: prev.expected_status_codes.filter(c => c !== code),
    }));
  };

  const getCheckTypeDescription = type => {
    switch (type) {
      case 'http':
        return 'Monitor HTTP/HTTPS endpoints for availability and response time';
      case 'ping':
        return 'Check network connectivity using ICMP ping';
      case 'tcp':
        return 'Test TCP port connectivity';
      case 'ssl':
        return 'Monitor SSL certificate validity and expiration';
      default:
        return '';
    }
  };

  return (
    <ProtectedRoute>
      {success ? (
        <Box sx={{ p: 3 }}>
          <Alert severity="success" sx={{ mb: 2 }}>
            Monitoring check created successfully! Redirecting to monitoring
            dashboard...
          </Alert>
        </Box>
      ) : (
        <Box sx={{ p: 3 }}>
          {/* Header */}
          <Box display="flex" alignItems="center" gap={2} mb={4}>
            <Button
              component={Link}
              href="/monitoring"
              startIcon={<ArrowBackIcon />}
              variant="outlined"
            >
              Back to Monitoring
            </Button>
            <Typography variant="h4" component="h1">
              Create Monitoring Check
            </Typography>
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Form */}
          <Card>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <Grid container spacing={3}>
                  {/* Organization Info */}
                  <Grid item xs={12}>
                    {selectedOrganization ? (
                      <Alert severity="success" sx={{ mb: 2 }}>
                        <strong>Creating monitoring check for:</strong> 🏢{' '}
                        {selectedOrganization.name}
                      </Alert>
                    ) : (
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        <strong>Please select an organization</strong> from the
                        dropdown in the top navigation bar to create a
                        monitoring check.
                      </Alert>
                    )}
                    {formErrors.organization && (
                      <Alert severity="error" sx={{ mb: 2 }}>
                        {formErrors.organization}
                      </Alert>
                    )}
                  </Grid>

                  {/* Monitor Name */}
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Monitor Name *"
                      value={formData.name}
                      onChange={e => handleInputChange('name', e.target.value)}
                      error={!!formErrors.name}
                      helperText={
                        formErrors.name ||
                        'A descriptive name for this monitoring check'
                      }
                      placeholder="e.g., Main Website HTTP Check"
                    />
                  </Grid>

                  {/* Check Type */}
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Check Type</InputLabel>
                      <Select
                        value={formData.check_type}
                        label="Check Type"
                        onChange={e =>
                          handleInputChange('check_type', e.target.value)
                        }
                      >
                        <MenuItem value="http">HTTP/HTTPS</MenuItem>
                        <MenuItem value="ping">Ping</MenuItem>
                        <MenuItem value="tcp">TCP Port</MenuItem>
                        <MenuItem value="ssl">SSL Certificate</MenuItem>
                      </Select>
                      <FormHelperText>
                        {getCheckTypeDescription(formData.check_type)}
                      </FormHelperText>
                    </FormControl>
                  </Grid>

                  {/* Monitoring Locations */}
                  <Grid item xs={12}>
                    <MonitoringLocationSelector
                      selectedLocations={formData.monitoring_locations}
                      onLocationChange={locations =>
                        handleInputChange('monitoring_locations', locations)
                      }
                      multiple={true}
                      label="Monitoring Locations"
                      helperText="Choose geographic locations to monitor from. Multiple locations provide better coverage and help detect regional issues."
                    />
                  </Grid>

                  {/* Target URL/Hostname */}
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label={
                        formData.check_type === 'ping'
                          ? 'Hostname or IP Address *'
                          : formData.check_type === 'tcp'
                            ? 'Target Host:Port *'
                            : formData.check_type === 'ssl'
                              ? 'Hostname or URL *'
                              : 'Target URL *'
                      }
                      value={formData.target_url}
                      onChange={e =>
                        handleInputChange('target_url', e.target.value)
                      }
                      error={!!formErrors.target_url}
                      helperText={
                        formErrors.target_url ||
                        (formData.check_type === 'ping'
                          ? 'The hostname or IP address to ping'
                          : formData.check_type === 'tcp'
                            ? 'The hostname:port or IP:port to check'
                            : formData.check_type === 'ssl'
                              ? 'The hostname or URL to check SSL certificate'
                              : 'The URL or endpoint to monitor')
                      }
                      placeholder={
                        formData.check_type === 'ping'
                          ? 'example.com or 192.168.1.1'
                          : formData.check_type === 'tcp'
                            ? 'example.com:80 or 192.168.1.1:443'
                            : formData.check_type === 'ssl'
                              ? 'example.com or https://example.com'
                              : 'https://example.com'
                      }
                    />
                  </Grid>

                  {/* Timing Settings */}
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Check Interval (seconds)"
                      value={formData.check_interval_seconds}
                      onChange={e =>
                        handleInputChange(
                          'check_interval_seconds',
                          parseInt(e.target.value)
                        )
                      }
                      error={!!formErrors.check_interval_seconds}
                      helperText={
                        formErrors.check_interval_seconds ||
                        'How often to run the check (minimum 60 seconds)'
                      }
                      inputProps={{ min: 60, max: 3600 }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Timeout (seconds)"
                      value={formData.timeout_seconds}
                      onChange={e =>
                        handleInputChange(
                          'timeout_seconds',
                          parseInt(e.target.value)
                        )
                      }
                      error={!!formErrors.timeout_seconds}
                      helperText={
                        formErrors.timeout_seconds ||
                        'Maximum time to wait for response'
                      }
                      inputProps={{ min: 1, max: 300 }}
                    />
                  </Grid>

                  {/* HTTP-specific settings */}
                  {formData.check_type === 'http' && (
                    <>
                      <Grid item xs={12}>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="h6" gutterBottom>
                          HTTP Settings
                        </Typography>
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth>
                          <InputLabel>HTTP Method</InputLabel>
                          <Select
                            value={formData.http_method}
                            label="HTTP Method"
                            onChange={e =>
                              handleInputChange('http_method', e.target.value)
                            }
                          >
                            <MenuItem value="GET">GET</MenuItem>
                            <MenuItem value="POST">POST</MenuItem>
                            <MenuItem value="PUT">PUT</MenuItem>
                            <MenuItem value="HEAD">HEAD</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.follow_redirects}
                              onChange={e =>
                                handleInputChange(
                                  'follow_redirects',
                                  e.target.checked
                                )
                              }
                            />
                          }
                          label="Follow Redirects"
                        />
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.ssl_check_enabled}
                              onChange={e =>
                                handleInputChange(
                                  'ssl_check_enabled',
                                  e.target.checked
                                )
                              }
                            />
                          }
                          label="SSL Certificate Check"
                        />
                      </Grid>

                      {/* Expected Status Codes */}
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" gutterBottom>
                          Expected Status Codes
                        </Typography>
                        <Box display="flex" gap={1} alignItems="center" mb={1}>
                          <TextField
                            size="small"
                            label="Status Code"
                            value={newStatusCode}
                            onChange={e => setNewStatusCode(e.target.value)}
                            placeholder="200"
                            inputProps={{ min: 100, max: 599 }}
                            sx={{ width: 150 }}
                          />
                          <Button
                            onClick={handleAddStatusCode}
                            disabled={!newStatusCode}
                          >
                            Add
                          </Button>
                        </Box>
                        <Box display="flex" flexWrap="wrap" gap={1}>
                          {formData.expected_status_codes.map(code => (
                            <Chip
                              key={code}
                              label={code}
                              onDelete={() => handleRemoveStatusCode(code)}
                              color="primary"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </Grid>

                      {/* Advanced HTTP Settings */}
                      <Grid item xs={12}>
                        <Accordion>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography>Advanced HTTP Settings</Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Grid container spacing={2}>
                              {/* HTTP Headers */}
                              <Grid item xs={12}>
                                <Typography variant="subtitle2" gutterBottom>
                                  HTTP Headers
                                </Typography>
                                <Box
                                  display="flex"
                                  gap={1}
                                  alignItems="center"
                                  mb={1}
                                >
                                  <TextField
                                    size="small"
                                    label="Header Name"
                                    value={headerKey}
                                    onChange={e => setHeaderKey(e.target.value)}
                                    placeholder="Authorization"
                                  />
                                  <TextField
                                    size="small"
                                    label="Header Value"
                                    value={headerValue}
                                    onChange={e =>
                                      setHeaderValue(e.target.value)
                                    }
                                    placeholder="Bearer token"
                                  />
                                  <Button
                                    onClick={handleAddHeader}
                                    disabled={!headerKey || !headerValue}
                                  >
                                    Add
                                  </Button>
                                </Box>
                                {Object.entries(formData.http_headers).map(
                                  ([key, value]) => (
                                    <Box
                                      key={key}
                                      display="flex"
                                      justifyContent="space-between"
                                      alignItems="center"
                                      p={1}
                                      border="1px solid #ddd"
                                      borderRadius={1}
                                      mb={1}
                                    >
                                      <Typography variant="body2">
                                        <strong>{key}:</strong> {value}
                                      </Typography>
                                      <Button
                                        size="small"
                                        onClick={() => handleRemoveHeader(key)}
                                        color="error"
                                      >
                                        Remove
                                      </Button>
                                    </Box>
                                  )
                                )}
                              </Grid>

                              {/* Keyword Matching */}
                              <Grid item xs={12} md={8}>
                                <TextField
                                  fullWidth
                                  label="Keyword Match (Optional)"
                                  value={formData.keyword_match}
                                  onChange={e =>
                                    handleInputChange(
                                      'keyword_match',
                                      e.target.value
                                    )
                                  }
                                  helperText="Check if response contains specific text"
                                  placeholder="Success"
                                />
                              </Grid>

                              <Grid item xs={12} md={4}>
                                <FormControl fullWidth>
                                  <InputLabel>Match Type</InputLabel>
                                  <Select
                                    value={formData.keyword_match_type}
                                    label="Match Type"
                                    onChange={e =>
                                      handleInputChange(
                                        'keyword_match_type',
                                        e.target.value
                                      )
                                    }
                                  >
                                    <MenuItem value="contains">
                                      Contains
                                    </MenuItem>
                                    <MenuItem value="exact">
                                      Exact Match
                                    </MenuItem>
                                    <MenuItem value="regex">
                                      Regular Expression
                                    </MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                            </Grid>
                          </AccordionDetails>
                        </Accordion>
                      </Grid>
                    </>
                  )}

                  {/* Status */}
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.is_active}
                          onChange={e =>
                            handleInputChange('is_active', e.target.checked)
                          }
                        />
                      }
                      label="Enable monitoring check"
                    />
                  </Grid>

                  {/* Submit Buttons */}
                  <Grid item xs={12}>
                    <Box
                      display="flex"
                      gap={2}
                      justifyContent="flex-end"
                      sx={{ mt: 2 }}
                    >
                      <Button
                        component={Link}
                        href="/monitoring"
                        variant="outlined"
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="contained"
                        startIcon={
                          loading ? (
                            <CircularProgress size={20} />
                          ) : (
                            <SaveIcon />
                          )
                        }
                        disabled={loading}
                        color="primary"
                      >
                        {loading ? 'Creating...' : 'Create Monitor'}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </form>
            </CardContent>
          </Card>
        </Box>
      )}
    </ProtectedRoute>
  );
}
