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
  Paper,
  Stack,
  Container,
  Tooltip,
  IconButton,
  Collapse,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SettingsIcon from '@mui/icons-material/Settings';
import { useOrganization } from '@/contexts/OrganizationContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import StatusPageCheckForm from '@/components/StatusPageCheckForm';
// import MonitoringLocationSelector from '@/components/MonitoringLocationSelector'; // Temporarily disabled

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
    // Service association settings
    linked_service_id: '',
    update_service_status: false,
    service_failure_status: 'down', // Status to set when check fails
    service_recovery_status: 'operational', // Status to set when check recovers
    // Incident creation settings
    auto_create_incidents: false,
    incident_severity: 'medium',
    incident_threshold_minutes: 5,
    incident_title_template: '',
    incident_description_template: '',
    auto_resolve_incidents: true,
    assigned_on_call_schedule_id: '',
    assigned_escalation_policy_id: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [onCallSchedules, setOnCallSchedules] = useState([]);
  const [escalationPolicies, setEscalationPolicies] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showIncidentPreview, setShowIncidentPreview] = useState(false);
  const [showIncidentManagement, setShowIncidentManagement] = useState(false);
  const [showServiceAssociation, setShowServiceAssociation] = useState(false);

  // Headers management
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');

  // Status codes management
  const [newStatusCode, setNewStatusCode] = useState('');

  // Common status codes for quick selection
  const commonStatusCodes = [
    { code: 200, label: '200 - OK' },
    { code: 201, label: '201 - Created' },
    { code: 202, label: '202 - Accepted' },
    { code: 301, label: '301 - Moved Permanently' },
    { code: 302, label: '302 - Found' },
    { code: 401, label: '401 - Unauthorized' },
    { code: 403, label: '403 - Forbidden' },
    { code: 404, label: '404 - Not Found' },
    { code: 500, label: '500 - Internal Server Error' },
  ];

  // Helper function for tooltips
  const FieldTooltip = ({ title, children }) => (
    <Tooltip title={title} placement="right" arrow>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {children}
        <InfoIcon sx={{ fontSize: 16, color: 'action.disabled' }} />
      </Box>
    </Tooltip>
  );

  // Generate incident preview
  const generateIncidentPreview = () => {
    const checkName = formData.name || 'Example Check';
    const targetUrl = formData.target_url || 'https://example.com';
    const timestamp = new Date().toLocaleString();
    const duration = formData.incident_threshold_minutes || 5;
    const errorMessage = 'Connection timeout after 30 seconds';

    const defaultTitle = `${checkName} is experiencing issues`;
    const defaultDescription = `Monitoring check "${checkName}" has been failing for ${duration} minutes. Last error: ${errorMessage}`;

    const customTitle = formData.incident_title_template 
      ? formData.incident_title_template
          .replace('{check_name}', checkName)
          .replace('{target_url}', targetUrl)
          .replace('{timestamp}', timestamp)
      : defaultTitle;

    const customDescription = formData.incident_description_template
      ? formData.incident_description_template
          .replace('{check_name}', checkName)
          .replace('{target_url}', targetUrl)
          .replace('{duration}', duration)
          .replace('{error_message}', errorMessage)
      : defaultDescription;

    return { title: customTitle, description: customDescription };
  };

  const validateForm = () => {
    const errors = {};

    if (!selectedOrganization)
      errors.organization = 'Please select an organization from the navbar';
    if (!formData.name.trim()) errors.name = 'Monitor name is required';
    if (!formData.target_url.trim() && formData.check_type !== 'status_page') {
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

      console.log('Form - selectedOrganization:', selectedOrganization);
      console.log('Form - formData:', formData);
      console.log('Form - submitData:', submitData);

      const response = await fetch('/api/monitoring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error Response:', errorData);

        // Provide more detailed error message
        let errorMessage = 'Failed to create monitoring check';
        if (errorData.error) {
          errorMessage = errorData.error;
        }
        if (errorData.details) {
          errorMessage += `: ${errorData.details}`;
        }
        if (errorData.debug) {
          console.error('Debug info:', errorData.debug);
        }

        throw new Error(errorMessage);
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

  // Fetch on-call schedules and escalation policies when organization changes
  useEffect(() => {
    if (selectedOrganization) {
      fetchOnCallSchedules();
      fetchEscalationPolicies();
      fetchServices();
    }
  }, [selectedOrganization]);

  const fetchOnCallSchedules = async () => {
    if (!selectedOrganization) return;
    
    setLoadingOptions(true);
    try {
      const response = await fetch(`/api/on-call-schedules?organization_id=${selectedOrganization.id}&active_only=true`);
      if (response.ok) {
        const data = await response.json();
        setOnCallSchedules(data.on_call_schedules || []);
      }
    } catch (error) {
      console.error('Error fetching on-call schedules:', error);
    } finally {
      setLoadingOptions(false);
    }
  };

  const fetchEscalationPolicies = async () => {
    if (!selectedOrganization) return;
    
    try {
      const response = await fetch(`/api/escalation-policies?organization_id=${selectedOrganization.id}&active_only=true`);
      if (response.ok) {
        const data = await response.json();
        setEscalationPolicies(data.escalation_policies || []);
      }
    } catch (error) {
      console.error('Error fetching escalation policies:', error);
    }
  };

  const fetchServices = async () => {
    if (!selectedOrganization) return;
    
    try {
      const response = await fetch(`/api/services?organization_id=${selectedOrganization.id}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableServices(data.services || []);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
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
      case 'status_page':
        return 'Monitor cloud provider status pages (Azure, AWS, Google Cloud)';
      default:
        return '';
    }
  };

  return (
    <ProtectedRoute>
      {success ? (
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Alert severity="success" sx={{ mb: 2 }}>
            Monitoring check created successfully! Redirecting to monitoring
            dashboard...
          </Alert>
        </Container>
      ) : (
        <Container maxWidth="lg" sx={{ py: 3 }}>
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
              {formData.check_type === 'status_page' ? (
                <StatusPageCheckForm
                  onSuccess={() => {
                    setSuccess(true);
                    setTimeout(() => router.push('/monitoring'), 2000);
                  }}
                  onCancel={() => router.push('/monitoring')}
                />
              ) : (
                <form onSubmit={handleSubmit}>
                  <Grid container spacing={3}>
                    {/* Organization Info */}
                    <Grid size={{ xs: 12 }}>
                      {selectedOrganization ? (
                        <Alert severity="success" sx={{ mb: 2 }}>
                          <strong>Creating monitoring check for:</strong> 🏢{' '}
                          {selectedOrganization.name}
                        </Alert>
                      ) : (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                          <strong>Please select an organization</strong> from
                          the dropdown in the top navigation bar to create a
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
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        label="Monitor Name *"
                        value={formData.name}
                        onChange={e =>
                          handleInputChange('name', e.target.value)
                        }
                        error={!!formErrors.name}
                        helperText={
                          formErrors.name ||
                          'A descriptive name for this monitoring check'
                        }
                        placeholder="e.g., Main Website HTTP Check"
                      />
                    </Grid>

                    {/* Check Type */}
                    <Grid size={{ xs: 12, md: 6 }}>
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
                          <MenuItem value="status_page">Status Page</MenuItem>
                        </Select>
                        <FormHelperText>
                          {getCheckTypeDescription(formData.check_type)}
                        </FormHelperText>
                      </FormControl>
                    </Grid>

                    {/* Monitoring Locations - TEMPORARILY HIDDEN */}
                    {/* 
                  <Grid size={{ xs: 12 }}>
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
                  */}

                    {/* Target URL/Hostname - Hide for status page checks */}
                    {formData.check_type !== 'status_page' && (
                      <Grid size={{ xs: 12 }}>
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
                    )}

                    {/* Status Page Configuration */}
                    {formData.check_type === 'status_page' && (
                      <Grid size={{ xs: 12 }}>
                        <Alert severity="info" sx={{ mb: 2 }}>
                          Status page monitoring checks will be configured using
                          the dedicated form above.
                        </Alert>
                      </Grid>
                    )}

                    {/* Timing Settings */}
                    <Grid size={{ xs: 12, md: 6 }}>
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

                    <Grid size={{ xs: 12, md: 6 }}>
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
                        <Grid size={{ xs: 12 }}>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="h6" gutterBottom>
                            HTTP Settings
                          </Typography>
                        </Grid>

                        <Grid size={{ xs: 12, md: 4 }}>
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

                        <Grid size={{ xs: 12, md: 4 }}>
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

                        <Grid size={{ xs: 12, md: 4 }}>
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
                        <Grid size={{ xs: 12 }}>
                          <FieldTooltip title="HTTP status codes that indicate a successful response. Common codes: 200 (OK), 201 (Created), 202 (Accepted). Multiple codes can be accepted.">
                            <Typography variant="subtitle2" gutterBottom>
                              Expected Status Codes
                            </Typography>
                          </FieldTooltip>
                          
                          {/* Quick-add preset codes */}
                          <Box mb={2}>
                            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                              Quick add common codes:
                            </Typography>
                            <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                              {commonStatusCodes.map((preset) => (
                                <Button
                                  key={preset.code}
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    if (!formData.expected_status_codes.includes(preset.code)) {
                                      setFormData(prev => ({
                                        ...prev,
                                        expected_status_codes: [...prev.expected_status_codes, preset.code]
                                      }));
                                    }
                                  }}
                                  disabled={formData.expected_status_codes.includes(preset.code)}
                                  sx={{ 
                                    fontSize: '0.75rem',
                                    minWidth: 'auto',
                                    opacity: formData.expected_status_codes.includes(preset.code) ? 0.5 : 1
                                  }}
                                >
                                  {preset.code}
                                </Button>
                              ))}
                            </Box>
                          </Box>

                          {/* Manual entry */}
                          <Box
                            display="flex"
                            gap={1}
                            alignItems="center"
                            mb={1}
                          >
                            <TextField
                              size="small"
                              label="Custom Status Code"
                              value={newStatusCode}
                              onChange={e => setNewStatusCode(e.target.value)}
                              placeholder="e.g., 304"
                              inputProps={{ min: 100, max: 599 }}
                              sx={{ width: 180 }}
                            />
                            <Button
                              onClick={handleAddStatusCode}
                              disabled={!newStatusCode}
                              variant="contained"
                              size="small"
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
                        <Grid size={{ xs: 12 }}>
                          <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                              <Typography>Advanced HTTP Settings</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                              <Grid container spacing={2}>
                                {/* HTTP Headers */}
                                <Grid size={{ xs: 12 }}>
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
                                      onChange={e =>
                                        setHeaderKey(e.target.value)
                                      }
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
                                          onClick={() =>
                                            handleRemoveHeader(key)
                                          }
                                          color="error"
                                        >
                                          Remove
                                        </Button>
                                      </Box>
                                    )
                                  )}
                                </Grid>

                                {/* Keyword Matching */}
                                <Grid size={{ xs: 12, md: 8 }}>
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

                                <Grid size={{ xs: 12, md: 4 }}>
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
                    <Grid size={{ xs: 12 }}>
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

                    {/* Incident Management Section */}
                    <Grid size={{ xs: 12 }}>
                      <Divider sx={{ my: 3 }} />
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          p: 1,
                          borderRadius: 1,
                          '&:hover': { backgroundColor: 'grey.50' }
                        }}
                        onClick={() => setShowIncidentManagement(!showIncidentManagement)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <SettingsIcon color="primary" />
                          <Typography variant="h6">
                            Incident Management
                          </Typography>
                          {formData.auto_create_incidents && (
                            <Chip label="Enabled" size="small" color="primary" />
                          )}
                        </Box>
                        <IconButton size="small">
                          <ExpandMoreIcon sx={{ 
                            transform: showIncidentManagement ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease'
                          }} />
                        </IconButton>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mb: 1 }}>
                        Configure automatic incident creation when this monitoring check fails
                      </Typography>
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                      <Collapse in={showIncidentManagement}>
                        <Box sx={{ pl: 4, pt: 2 }}>
                          <Grid container spacing={2}>
                            <Grid size={{ xs: 12 }}>
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={formData.auto_create_incidents}
                                    onChange={e =>
                                      handleInputChange('auto_create_incidents', e.target.checked)
                                    }
                                  />
                                }
                                label="Automatically create incidents when check fails"
                              />
                            </Grid>

                            {formData.auto_create_incidents && (
                      <>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <FormControl fullWidth>
                            <InputLabel>Incident Severity</InputLabel>
                            <Select
                              value={formData.incident_severity}
                              label="Incident Severity"
                              onChange={e =>
                                handleInputChange('incident_severity', e.target.value)
                              }
                            >
                              <MenuItem value="low">Low</MenuItem>
                              <MenuItem value="medium">Medium</MenuItem>
                              <MenuItem value="high">High</MenuItem>
                              <MenuItem value="critical">Critical</MenuItem>
                            </Select>
                            <FormHelperText>Severity level for auto-created incidents</FormHelperText>
                          </FormControl>
                        </Grid>
                        
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Failure Duration (minutes)"
                            value={formData.incident_threshold_minutes}
                            onChange={e =>
                              handleInputChange('incident_threshold_minutes', parseInt(e.target.value) || 1)
                            }
                            helperText="Create incident after check fails for this duration"
                            inputProps={{ min: 1, max: 1440 }}
                          />
                        </Grid>

                        <Grid size={{ xs: 12, md: 6 }}>
                          <FormControl fullWidth>
                            <InputLabel>On-Call Schedule (Optional)</InputLabel>
                            <Select
                              value={formData.assigned_on_call_schedule_id}
                              label="On-Call Schedule (Optional)"
                              onChange={e =>
                                handleInputChange('assigned_on_call_schedule_id', e.target.value)
                              }
                              disabled={loadingOptions}
                            >
                              <MenuItem value="">
                                <em>No schedule assignment</em>
                              </MenuItem>
                              {onCallSchedules.map(schedule => (
                                <MenuItem key={schedule.id} value={schedule.id}>
                                  {schedule.name}
                                </MenuItem>
                              ))}
                            </Select>
                            <FormHelperText>
                              {loadingOptions ? 'Loading schedules...' : 'Assign incidents to specific on-call schedule'}
                            </FormHelperText>
                          </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, md: 6 }}>
                          <FormControl fullWidth>
                            <InputLabel>Escalation Policy (Optional)</InputLabel>
                            <Select
                              value={formData.assigned_escalation_policy_id}
                              label="Escalation Policy (Optional)"
                              onChange={e =>
                                handleInputChange('assigned_escalation_policy_id', e.target.value)
                              }
                              disabled={loadingOptions}
                            >
                              <MenuItem value="">
                                <em>No escalation policy</em>
                              </MenuItem>
                              {escalationPolicies.map(policy => (
                                <MenuItem key={policy.id} value={policy.id}>
                                  {policy.name}
                                </MenuItem>
                              ))}
                            </Select>
                            <FormHelperText>
                              {loadingOptions ? 'Loading policies...' : 'Apply escalation policy to auto-created incidents'}
                            </FormHelperText>
                          </FormControl>
                        </Grid>
                        
                        <Grid size={{ xs: 12 }}>
                          <TextField
                            fullWidth
                            label="Custom Incident Title Template (Optional)"
                            value={formData.incident_title_template}
                            onChange={e =>
                              handleInputChange('incident_title_template', e.target.value)
                            }
                            placeholder="e.g., {check_name} is experiencing issues"
                            helperText="Use {check_name}, {target_url}, {timestamp} as placeholders. Leave empty for default title."
                          />
                        </Grid>

                        <Grid size={{ xs: 12 }}>
                          <TextField
                            fullWidth
                            label="Custom Incident Description Template (Optional)"
                            value={formData.incident_description_template}
                            onChange={e =>
                              handleInputChange('incident_description_template', e.target.value)
                            }
                            multiline
                            rows={3}
                            placeholder="e.g., Monitoring check '{check_name}' has been failing for {duration} minutes."
                            helperText="Use {check_name}, {target_url}, {duration}, {error_message} as placeholders. Leave empty for default description."
                          />
                        </Grid>

                        <Grid size={{ xs: 12 }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={formData.auto_resolve_incidents}
                                onChange={e =>
                                  handleInputChange('auto_resolve_incidents', e.target.checked)
                                }
                              />
                            }
                              label="Automatically resolve incidents when check recovers"
                            />
                            </Grid>
                            </>
                            )}
                          </Grid>
                        </Box>
                      </Collapse>
                    </Grid>

                    {/* Service Association Section */}
                    <Grid size={{ xs: 12 }}>
                      <Divider sx={{ my: 3 }} />
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          p: 1,
                          borderRadius: 1,
                          '&:hover': { backgroundColor: 'grey.50' }
                        }}
                        onClick={() => setShowServiceAssociation(!showServiceAssociation)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <SettingsIcon color="primary" />
                          <Typography variant="h6">
                            Service Association
                          </Typography>
                          {formData.linked_service_id && (
                            <Chip label="Linked" size="small" color="success" />
                          )}
                        </Box>
                        <IconButton size="small">
                          <ExpandMoreIcon sx={{ 
                            transform: showServiceAssociation ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease'
                          }} />
                        </IconButton>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mb: 1 }}>
                        Link this monitoring check to a service for automatic status updates and incident association
                      </Typography>
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                      <Collapse in={showServiceAssociation}>
                        <Box sx={{ pl: 4, pt: 2 }}>
                          <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 6 }}>
                      <FormControl fullWidth>
                        <InputLabel>Link to Service (Optional)</InputLabel>
                        <Select
                          value={formData.linked_service_id}
                          label="Link to Service (Optional)"
                          onChange={e =>
                            handleInputChange('linked_service_id', e.target.value)
                          }
                          disabled={loadingOptions}
                        >
                          <MenuItem value="">
                            <em>No service linkage</em>
                          </MenuItem>
                          {availableServices.map(service => (
                            <MenuItem key={service.id} value={service.id}>
                              {service.name} ({service.status})
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>
                          {loadingOptions ? 'Loading services...' : 'Link this check to a service for automatic status updates'}
                        </FormHelperText>
                      </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.update_service_status}
                            onChange={e =>
                              handleInputChange('update_service_status', e.target.checked)
                            }
                            disabled={!formData.linked_service_id}
                          />
                        }
                        label="Update service status when check fails"
                      />
                      <FormHelperText>
                        Automatically update the linked service status based on check results
                      </FormHelperText>
                    </Grid>

                    {formData.linked_service_id && formData.update_service_status && (
                      <>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <FormControl fullWidth>
                            <InputLabel>Status When Check Fails</InputLabel>
                            <Select
                              value={formData.service_failure_status}
                              label="Status When Check Fails"
                              onChange={e =>
                                handleInputChange('service_failure_status', e.target.value)
                              }
                            >
                              <MenuItem value="degraded">Degraded Performance</MenuItem>
                              <MenuItem value="down">Service Down</MenuItem>
                              <MenuItem value="maintenance">Under Maintenance</MenuItem>
                            </Select>
                            <FormHelperText>Service status to set when this check fails</FormHelperText>
                          </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, md: 6 }}>
                          <FormControl fullWidth>
                            <InputLabel>Status When Check Recovers</InputLabel>
                            <Select
                              value={formData.service_recovery_status}
                              label="Status When Check Recovers"
                              onChange={e =>
                                handleInputChange('service_recovery_status', e.target.value)
                              }
                            >
                              <MenuItem value="operational">Operational</MenuItem>
                              <MenuItem value="degraded">Degraded Performance</MenuItem>
                            </Select>
                            <FormHelperText>Service status to set when this check recovers</FormHelperText>
                          </FormControl>
                            </Grid>
                            </>
                            )}
                          </Grid>
                        </Box>
                      </Collapse>
                    </Grid>

                    {/* Submit Buttons */}
                    <Grid size={{ xs: 12 }}>
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
              )}
            </CardContent>
          </Card>
        </Container>
      )}
    </ProtectedRoute>
  );
}
