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
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useOrganization } from '@/contexts/OrganizationContext';
// import MonitoringLocationSelector from '@/components/MonitoringLocationSelector'; // Unused - monitoring locations temporarily disabled

export const runtime = 'edge';

export default function EditMonitoringCheckPage() {
  const router = useRouter();
  const params = useParams();
  const checkId = params.id;
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
  const [fetchingData, setFetchingData] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Headers management
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');

  // Status codes management
  const [newStatusCode, setNewStatusCode] = useState('');

  useEffect(() => {
    if (session && checkId) {
      fetchMonitoringCheck();
    }
  }, [session, checkId]);

  const fetchMonitoringCheck = async () => {
    try {
      setFetchingData(true);
      const response = await fetch(`/api/monitoring/${checkId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch monitoring check');
      }

      const result = await response.json();
      const check = result.check;

      // Handle both old JSON format and new direct database fields
      let checkData = {};
      
      // Try to parse description as JSON (old format)
      if (check.description && typeof check.description === 'string') {
        try {
          checkData = JSON.parse(check.description);
        } catch (e) {
          console.warn('Failed to parse check description as JSON:', e);
          checkData = {};
        }
      } else if (check.description && typeof check.description === 'object') {
        checkData = check.description;
      }

      // Debug logging
      console.log('Check data from API:', check);
      console.log('Parsed check data:', checkData);

      // Check if this is a status page check
      if (check.check_type === 'status_page') {
        setError('Status page checks cannot be edited using the standard monitoring edit form. Please delete and recreate the check if needed.');
        return;
      }

      setFormData({
        name: check.name?.replace('[MONITORING] ', '') || '',
        // Use direct field from database if available, otherwise fall back to parsed JSON
        check_type: check.check_type || checkData.check_type || 'http',
        target_url: check.target_url || checkData.target_url || '',
        check_interval_seconds: check.check_interval_seconds || checkData.check_interval_seconds || 300,
        timeout_seconds: check.timeout_seconds || checkData.timeout_seconds || 30,
        http_method: check.http_method || checkData.http_method || 'GET',
        http_headers: check.http_headers || checkData.http_headers || {},
        expected_status_codes: check.expected_status_codes || checkData.expected_status_codes || [200],
        keyword_match: check.keyword_match || checkData.keyword_match || '',
        keyword_match_type: check.keyword_match_type || checkData.keyword_match_type || 'contains',
        ssl_check_enabled: check.ssl_check_enabled || checkData.ssl_check_enabled || false,
        follow_redirects: check.follow_redirects !== false && checkData.follow_redirects !== false,
        notification_settings: check.notification_settings || checkData.notification_settings || {},
        is_active: check.is_active !== false,
      });
    } catch (err) {
      console.error('Error fetching monitoring check:', err);
      setError(`Failed to load monitoring check: ${err.message}`);
    } finally {
      setFetchingData(false);
    }
  };

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
    if (formData.target_url.trim() && formData.check_type === 'http') {
      try {
        new URL(formData.target_url);
      } catch {
        errors.target_url =
          'Please enter a valid URL (e.g., https://example.com)';
      }
    }

    if (formData.check_interval_seconds < 60)
      errors.check_interval_seconds =
        'Check interval must be at least 60 seconds';
    if (formData.timeout_seconds < 1)
      errors.timeout_seconds = 'Timeout must be at least 1 second';
    if (formData.timeout_seconds >= formData.check_interval_seconds)
      errors.timeout_seconds = 'Timeout must be less than check interval';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const updateData = {
        name: `[MONITORING] ${formData.name}`,
        description: JSON.stringify(formData),
        is_active: formData.is_active,
        organization_id: selectedOrganization.id,
      };

      console.log('Updating monitoring check:', updateData);

      const response = await fetch(`/api/monitoring/${checkId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update monitoring check');
      }

      const result = await response.json();
      console.log('Monitoring check updated successfully:', result);

      setSuccess(true);

      // Redirect back to monitoring page after a short delay
      setTimeout(() => {
        router.push('/monitoring');
      }, 1500);
    } catch (err) {
      console.error('Error updating monitoring check:', err);
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

  const addHeader = () => {
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

  const removeHeader = key => {
    setFormData(prev => {
      const newHeaders = { ...prev.http_headers };
      delete newHeaders[key];
      return {
        ...prev,
        http_headers: newHeaders,
      };
    });
  };

  const addStatusCode = () => {
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

  const removeStatusCode = code => {
    setFormData(prev => ({
      ...prev,
      expected_status_codes: prev.expected_status_codes.filter(c => c !== code),
    }));
  };

  if (fetchingData) {
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

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Button
            component={Link}
            href="/monitoring"
            startIcon={<ArrowBackIcon />}
            variant="outlined"
          >
            Back to Monitoring
          </Button>
          <Typography variant="h4" component="h1">
            Edit Monitoring Check
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Monitoring check updated successfully! Redirecting...
        </Alert>
      )}

      {formErrors.organization && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {formErrors.organization}
        </Alert>
      )}

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Basic Configuration */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Basic Configuration
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Monitor Name"
                  value={formData.name}
                  onChange={e => handleInputChange('name', e.target.value)}
                  error={!!formErrors.name}
                  helperText={formErrors.name}
                  required
                />
              </Grid>

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
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={
                    formData.check_type === 'ping'
                      ? 'Hostname or IP Address'
                      : formData.check_type === 'tcp'
                        ? 'Hostname:Port or IP:Port'
                        : formData.check_type === 'ssl'
                          ? 'Hostname or URL'
                          : 'Target URL'
                  }
                  value={formData.target_url}
                  onChange={e =>
                    handleInputChange('target_url', e.target.value)
                  }
                  error={!!formErrors.target_url}
                  helperText={formErrors.target_url}
                  placeholder={
                    formData.check_type === 'ping'
                      ? 'example.com or 8.8.8.8'
                      : formData.check_type === 'tcp'
                        ? 'example.com:443 or 8.8.8.8:53'
                        : formData.check_type === 'ssl'
                          ? 'example.com or https://example.com'
                          : 'https://example.com/api/health'
                  }
                  required
                />
              </Grid>

              {/* Timing Configuration */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Timing Configuration
                </Typography>
              </Grid>

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
                    formErrors.check_interval_seconds || 'Minimum 60 seconds'
                  }
                  inputProps={{ min: 60, step: 60 }}
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
                    'Must be less than check interval'
                  }
                  inputProps={{ min: 1, max: 300 }}
                />
              </Grid>

              {/* HTTP-specific options */}
              {formData.check_type === 'http' && (
                <>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom>
                      HTTP Configuration
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
                        <MenuItem value="DELETE">DELETE</MenuItem>
                        <MenuItem value="HEAD">HEAD</MenuItem>
                        <MenuItem value="OPTIONS">OPTIONS</MenuItem>
                      </Select>
                    </FormControl>
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

                  {/* Expected Status Codes */}
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom>
                      Expected Status Codes
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                      {formData.expected_status_codes.map(code => (
                        <Chip
                          key={code}
                          label={code}
                          onDelete={() => removeStatusCode(code)}
                          size="small"
                        />
                      ))}
                    </Box>
                    <Box display="flex" gap={1}>
                      <TextField
                        size="small"
                        type="number"
                        label="Add Status Code"
                        value={newStatusCode}
                        onChange={e => setNewStatusCode(e.target.value)}
                        inputProps={{ min: 100, max: 599 }}
                        sx={{ width: 200 }}
                      />
                      <Button
                        onClick={addStatusCode}
                        variant="outlined"
                        size="small"
                      >
                        Add
                      </Button>
                    </Box>
                  </Grid>

                  {/* HTTP Headers */}
                  <Grid item xs={12}>
                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography>
                          HTTP Headers (
                          {Object.keys(formData.http_headers).length})
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        {Object.entries(formData.http_headers).map(
                          ([key, value]) => (
                            <Box
                              key={key}
                              display="flex"
                              alignItems="center"
                              gap={1}
                              mb={1}
                            >
                              <TextField
                                size="small"
                                label="Header"
                                value={key}
                                disabled
                                sx={{ flex: 1 }}
                              />
                              <TextField
                                size="small"
                                label="Value"
                                value={value}
                                disabled
                                sx={{ flex: 1 }}
                              />
                              <Button
                                size="small"
                                color="error"
                                onClick={() => removeHeader(key)}
                              >
                                Remove
                              </Button>
                            </Box>
                          )
                        )}
                        <Box display="flex" gap={1} mt={2}>
                          <TextField
                            size="small"
                            label="Header Name"
                            value={headerKey}
                            onChange={e => setHeaderKey(e.target.value)}
                            sx={{ flex: 1 }}
                          />
                          <TextField
                            size="small"
                            label="Header Value"
                            value={headerValue}
                            onChange={e => setHeaderValue(e.target.value)}
                            sx={{ flex: 1 }}
                          />
                          <Button
                            onClick={addHeader}
                            variant="outlined"
                            size="small"
                          >
                            Add
                          </Button>
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  </Grid>

                  {/* Keyword Matching */}
                  <Grid item xs={12}>
                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography>Content Validation</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={8}>
                            <TextField
                              fullWidth
                              label="Keyword to Match (optional)"
                              value={formData.keyword_match}
                              onChange={e =>
                                handleInputChange(
                                  'keyword_match',
                                  e.target.value
                                )
                              }
                              placeholder="Text that should be present in the response"
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
                                <MenuItem value="contains">Contains</MenuItem>
                                <MenuItem value="not_contains">
                                  Does Not Contain
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

              {/* Monitor Status */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active}
                      onChange={e =>
                        handleInputChange('is_active', e.target.checked)
                      }
                    />
                  }
                  label="Monitor is Active"
                />
              </Grid>

              {/* Submit Button */}
              <Grid item xs={12}>
                <Box display="flex" gap={2} justifyContent="flex-end">
                  <Button
                    component={Link}
                    href="/monitoring"
                    variant="outlined"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={
                      loading ? <CircularProgress size={20} /> : <SaveIcon />
                    }
                    disabled={loading}
                  >
                    {loading ? 'Updating...' : 'Update Check'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
