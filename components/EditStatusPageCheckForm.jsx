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
  FormControlLabel,
  Switch,
} from '@mui/material';
import { CheckCircle, Error, Warning } from '@mui/icons-material';
import { useOrganization } from '@/contexts/OrganizationContext';
import StatusPageProviderSelector from './StatusPageProviderSelector';

const EditStatusPageCheckForm = ({ check, onSuccess, onCancel }) => {
  const { selectedOrganization } = useOrganization();
  const [formData, setFormData] = useState({
    name: '',
    provider: '',
    service: '',
    regions: [],
    check_interval_seconds: 300,
    linked_service_id: '',
    failure_behavior: 'match_status',
    failure_message: '',
    update_service_status: false,
    service_failure_status: 'down',
    service_recovery_status: 'operational',
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
  const [availableServices, setAvailableServices] = useState([]);
  const [onCallSchedules, setOnCallSchedules] = useState([]);
  const [escalationPolicies, setEscalationPolicies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState(null);

  // Initialize form data from the check prop
  useEffect(() => {
    if (check) {
      const statusPageConfig = check.status_page_config || {};
      
      setFormData({
        name: check.name || '',
        provider: statusPageConfig.provider || '',
        service: statusPageConfig.service || '',
        regions: statusPageConfig.regions || [],
        check_interval_seconds: check.check_interval_seconds || 300,
        linked_service_id: check.linked_service_id || '',
        failure_behavior: statusPageConfig.failure_behavior || 'match_status',
        failure_message: statusPageConfig.failure_message || '',
        update_service_status: check.update_service_status || false,
        service_failure_status: check.service_failure_status || 'down',
        service_recovery_status: check.service_recovery_status || 'operational',
        // Incident creation settings
        auto_create_incidents: check.auto_create_incidents || false,
        incident_severity: check.incident_severity || 'medium',
        incident_threshold_minutes: check.incident_threshold_minutes || 5,
        incident_title_template: check.incident_title_template || '',
        incident_description_template: check.incident_description_template || '',
        auto_resolve_incidents: check.auto_resolve_incidents !== false, // Default to true
        assigned_on_call_schedule_id: check.assigned_on_call_schedule_id || '',
        assigned_escalation_policy_id: check.assigned_escalation_policy_id || '',
      });
    }
  }, [check]);

  // Load available services for linking
  const loadAvailableServices = async () => {
    if (!selectedOrganization?.id) {
      setAvailableServices([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/services?organization_id=${selectedOrganization.id}`
      );

      if (!response.ok) {
        setAvailableServices([]);
        return;
      }

      const data = await response.json();
      if (data.success) {
        setAvailableServices(data.services || []);
      } else {
        setAvailableServices([]);
      }
    } catch (err) {
      console.error('Error loading services:', err);
      setAvailableServices([]);
    }
  };

  const fetchOnCallSchedules = async () => {
    if (!selectedOrganization?.id) return;
    
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
    if (!selectedOrganization?.id) return;
    
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

  useEffect(() => {
    if (selectedOrganization?.id) {
      loadAvailableServices();
      fetchOnCallSchedules();
      fetchEscalationPolicies();
    }
  }, [selectedOrganization]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
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
      // Format the check configuration for update
      const updateData = {
        name: formData.name,
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
        update_service_status: formData.update_service_status || false,
        service_failure_status: formData.service_failure_status || 'down',
        service_recovery_status: formData.service_recovery_status || 'operational',
      };

      const response = await fetch(`/api/monitoring/${check.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess(data.monitoring_check);
      } else {
        setError('Failed to update check: ' + data.error);
      }
    } catch (err) {
      setError('Error updating check: ' + err.message);
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
        Edit Status Page Check
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
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
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Check Name"
                value={formData.name}
                onChange={e => handleInputChange('name', e.target.value)}
                required
                helperText="A descriptive name for this status page check"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
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

            <Grid size={{ xs: 12 }}>
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
                <Grid size={{ xs: 12 }}>
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

                <Grid size={{ xs: 12, md: 6 }}>
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

                <Grid size={{ xs: 12, md: 6 }}>
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

                {/* Service Status Update Options */}
                <Grid size={{ xs: 12 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.update_service_status}
                        onChange={e =>
                          handleInputChange('update_service_status', e.target.checked)
                        }
                      />
                    }
                    label="Update service status when check fails"
                  />
                  <FormHelperText>
                    Automatically update the linked service status based on check results
                  </FormHelperText>
                </Grid>

                {formData.update_service_status && (
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
              </>
            )}

            {/* Incident Management Section */}
            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Incident Management
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Configure automatic incident creation when this status page check fails
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
                    helperText="Use {check_name}, {service_name}, {timestamp} as placeholders. Leave empty for default title."
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
                    placeholder="e.g., Status page check '{check_name}' for {service_name} has been failing for {duration} minutes."
                    helperText="Use {check_name}, {service_name}, {duration}, {error_message} as placeholders. Leave empty for default description."
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
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
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
          {loading ? 'Updating...' : 'Update Check'}
        </Button>
      </Box>
    </Box>
  );
};

export default EditStatusPageCheckForm;