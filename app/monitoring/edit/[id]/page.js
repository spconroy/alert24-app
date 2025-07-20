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
  Tooltip,
  IconButton,
  Collapse,
  Paper,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SettingsIcon from '@mui/icons-material/Settings';
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
    // Incident creation settings
    auto_create_incidents: false,
    incident_severity: 'medium',
    incident_threshold_minutes: 5,
    incident_title_template: '',
    incident_description_template: '',
    auto_resolve_incidents: true,
    assigned_on_call_schedule_id: '',
    assigned_escalation_policy_id: '',
    // Service association settings
    linked_service_id: '',
    update_service_status: false,
    service_failure_status: 'down',
    service_recovery_status: 'operational',
  });

  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [onCallSchedules, setOnCallSchedules] = useState([]);
  const [escalationPolicies, setEscalationPolicies] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showIncidentPreview, setShowIncidentPreview] = useState(false);

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

  useEffect(() => {
    if (session && checkId) {
      fetchMonitoringCheck();
    }
  }, [session, checkId]);

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
        // Redirect to status page edit form instead of showing error
        router.replace(`/monitoring/edit-status-page/${checkId}`);
        return;
      }

      setFormData({
        name: check.name?.replace('[MONITORING] ', '') || '',
        // Use direct field from database if available, otherwise fall back to parsed JSON
        check_type: check.check_type || checkData.check_type || 'http',
        target_url: check.target_url || checkData.target_url || '',
        check_interval_seconds:
          check.check_interval_seconds ||
          checkData.check_interval_seconds ||
          300,
        timeout_seconds:
          check.timeout_seconds || checkData.timeout_seconds || 30,
        http_method: check.http_method || checkData.http_method || 'GET',
        http_headers: check.http_headers || checkData.http_headers || {},
        expected_status_codes: check.expected_status_codes ||
          checkData.expected_status_codes || [200],
        keyword_match: check.keyword_match || checkData.keyword_match || '',
        keyword_match_type:
          check.keyword_match_type ||
          checkData.keyword_match_type ||
          'contains',
        ssl_check_enabled:
          check.ssl_check_enabled || checkData.ssl_check_enabled || false,
        follow_redirects:
          check.follow_redirects !== false &&
          checkData.follow_redirects !== false,
        notification_settings:
          check.notification_settings || checkData.notification_settings || {},
        is_active: check.is_active !== false,
        // Incident creation settings
        auto_create_incidents: check.auto_create_incidents || false,
        incident_severity: check.incident_severity || 'medium',
        incident_threshold_minutes: check.incident_threshold_minutes || 5,
        incident_title_template: check.incident_title_template || '',
        incident_description_template: check.incident_description_template || '',
        auto_resolve_incidents: check.auto_resolve_incidents !== false,
        assigned_on_call_schedule_id: check.assigned_on_call_schedule_id || '',
        assigned_escalation_policy_id: check.assigned_escalation_policy_id || '',
        // Service association settings
        linked_service_id: check.linked_service_id || '',
        update_service_status: check.update_service_status || false,
        service_failure_status: check.service_failure_status || 'down',
        service_recovery_status: check.service_recovery_status || 'operational',
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
        name: formData.name,
        check_type: formData.check_type,
        target_url: formData.target_url,
        check_interval_seconds: formData.check_interval_seconds,
        timeout_seconds: formData.timeout_seconds,
        http_method: formData.http_method,
        http_headers: formData.http_headers,
        expected_status_codes: formData.expected_status_codes,
        keyword_match: formData.keyword_match,
        keyword_match_type: formData.keyword_match_type,
        ssl_check_enabled: formData.ssl_check_enabled,
        follow_redirects: formData.follow_redirects,
        notification_settings: formData.notification_settings,
        is_active: formData.is_active,
        // Incident creation settings
        auto_create_incidents: formData.auto_create_incidents,
        incident_severity: formData.incident_severity,
        incident_threshold_minutes: formData.incident_threshold_minutes,
        incident_title_template: formData.incident_title_template || null,
        incident_description_template: formData.incident_description_template || null,
        auto_resolve_incidents: formData.auto_resolve_incidents,
        assigned_on_call_schedule_id: formData.assigned_on_call_schedule_id || null,
        assigned_escalation_policy_id: formData.assigned_escalation_policy_id || null,
        // Service association settings
        linked_service_id: formData.linked_service_id || null,
        update_service_status: formData.update_service_status || false,
        service_failure_status: formData.service_failure_status || 'down',
        service_recovery_status: formData.service_recovery_status || 'operational',
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
              <Grid size={{ xs: 12 }}>
                <Typography variant="h6" gutterBottom>
                  Basic Configuration
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
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
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12 }}>
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
              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Timing Configuration
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <FieldTooltip title="How often to run this check. Shorter intervals consume more resources but provide faster issue detection. Minimum: 60 seconds.">
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
                      formErrors.check_interval_seconds || 'How often to run this check (min: 60s). Shorter intervals consume more resources.'
                    }
                    inputProps={{ min: 60, step: 60 }}
                  />
                </FieldTooltip>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <FieldTooltip title="Maximum time to wait for a response before considering the check failed. Set based on your service's typical response time.">
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
                      'Maximum time to wait for response (1-300s)'
                    }
                    inputProps={{ min: 1, max: 300 }}
                  />
                </FieldTooltip>
              </Grid>

              {/* HTTP-specific options */}
              {formData.check_type === 'http' && (
                <>
                  <Grid size={{ xs: 12 }}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom>
                      HTTP Configuration
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
                        <MenuItem value="DELETE">DELETE</MenuItem>
                        <MenuItem value="HEAD">HEAD</MenuItem>
                        <MenuItem value="OPTIONS">OPTIONS</MenuItem>
                      </Select>
                    </FormControl>
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

                  {/* Expected Status Codes */}
                  <Grid size={{ xs: 12 }}>
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
                  <Grid size={{ xs: 12 }}>
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
                  <Grid size={{ xs: 12 }}>
                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography>Content Validation</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, md: 8 }}>
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
              <Grid size={{ xs: 12 }}>
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

              {/* Incident Management Section */}
              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Incident Management
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Configure automatic incident creation when this monitoring check fails
                </Typography>
              </Grid>

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
                    <FieldTooltip title="How long the service must be down before triggering an incident. Shorter durations mean faster response but may create incidents for brief outages.">
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
                    </FieldTooltip>
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
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
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
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<VisibilityIcon />}
                        onClick={() => setShowIncidentPreview(!showIncidentPreview)}
                        sx={{ mb: 2.5 }}
                      >
                        Preview
                      </Button>
                    </Box>
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

                  {/* Incident Preview */}
                  {showIncidentPreview && (
                    <Grid size={{ xs: 12 }}>
                      <Paper sx={{ p: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
                        <Typography variant="subtitle2" gutterBottom color="primary">
                          📋 Incident Preview
                        </Typography>
                        {(() => {
                          const preview = generateIncidentPreview();
                          return (
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                                Title: {preview.title}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Description: {preview.description}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                This is how the incident will appear with current template and example data.
                              </Typography>
                            </Box>
                          );
                        })()}
                      </Paper>
                    </Grid>
                  )}
                </>
              )}

              {/* Service Association Section */}
              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Service Association
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Link this monitoring check to a service for automatic status updates and incident association
                </Typography>
              </Grid>

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

              {/* Submit Button */}
              <Grid size={{ xs: 12 }}>
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
