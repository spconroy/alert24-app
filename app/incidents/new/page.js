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
  Chip,
  Alert,
  CircularProgress,
  Grid,
  Autocomplete,
  FormHelperText,
  Divider,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Stack,
  IconButton,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useOrganization } from '@/contexts/OrganizationContext';

const steps = [
  {
    label: 'Basic Information',
    description: 'Incident details and severity',
    icon: <InfoIcon />,
  },
  {
    label: 'Impact & Services',
    description: 'Affected services and impact',
    icon: <WarningIcon />,
  },
  {
    label: 'Assignment & Escalation',
    description: 'Assign responders and policies',
    icon: <PersonIcon />,
  },
  {
    label: 'Review & Create',
    description: 'Review and submit incident',
    icon: <CheckCircleIcon />,
  },
];

const severityColors = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
  low: 'success',
  maintenance: 'default',
};

const statusColors = {
  open: 'error',
  investigating: 'warning',
  identified: 'info',
  monitoring: 'primary',
  resolved: 'success',
};

export default function CreateIncidentPage() {
  const router = useRouter();
  const { session, selectedOrganization } = useOrganization();

  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    organization_id: '',
    title: '',
    description: '',
    severity: 'medium',
    status: 'open',
    affected_services: [],
    impact_description: '',
    assigned_to: '',
    escalation_policy_id: '',
    tags: [],
  });

  const [organizations, setOrganizations] = useState([]);
  const [escalationPolicies, setEscalationPolicies] = useState([]);
  const [organizationMembers, setOrganizationMembers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // New tag input
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (session) {
      fetchOrganizations();
    }
  }, [session]);

  useEffect(() => {
    if (selectedOrganization?.id) {
      setFormData(prev => ({
        ...prev,
        organization_id: selectedOrganization.id,
      }));
      fetchOrganizationData(selectedOrganization.id);
    }
  }, [selectedOrganization]);

  useEffect(() => {
    if (
      formData.organization_id &&
      formData.organization_id !== selectedOrganization?.id
    ) {
      fetchOrganizationData(formData.organization_id);
    }
  }, [formData.organization_id]);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);

        // Auto-select if only one organization
        if (data.organizations?.length === 1) {
          setFormData(prev => ({
            ...prev,
            organization_id: data.organizations[0].id,
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching organizations:', err);
    }
  };

  const fetchOrganizationData = async orgId => {
    try {
      // Fetch escalation policies
      const policiesResponse = await fetch(
        `/api/escalation-policies?organization_id=${orgId}&active_only=true`
      );
      if (policiesResponse.ok) {
        const policiesData = await policiesResponse.json();
        setEscalationPolicies(policiesData.escalation_policies || []);
      }

      // Fetch organization members
      const membersResponse = await fetch(
        `/api/organizations/${orgId}/members`
      );
      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        setOrganizationMembers(membersData.members || []);
      } else {
        const errorData = await membersResponse.text();
        console.error('Failed to fetch members:', membersResponse.status, errorData);
      }

      // Fetch services (status pages can list services)
      const servicesResponse = await fetch(
        `/api/services?organization_id=${orgId}`
      );
      if (servicesResponse.ok) {
        const servicesData = await servicesResponse.json();
        setServices(servicesData.services || []);
      }
    } catch (err) {
      console.error('Error fetching organization data:', err);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear field-specific errors
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: null,
      }));
    }
  };

  const handleNext = () => {
    const currentStepErrors = validateCurrentStep();
    if (Object.keys(currentStepErrors).length === 0) {
      setActiveStep(prev => prev + 1);
    } else {
      setFormErrors(currentStepErrors);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const validateCurrentStep = () => {
    const errors = {};

    switch (activeStep) {
      case 0: // Basic Information
        if (!formData.title.trim()) {
          errors.title = 'Title is required';
        }
        if (!formData.organization_id) {
          errors.organization_id = 'Organization is required';
        }
        break;
      case 1: // Impact & Services
        if (!formData.impact_description.trim()) {
          errors.impact_description = 'Impact description is required';
        }
        break;
      case 2: // Assignment & Escalation
        // Optional fields - no validation needed
        break;
    }

    return errors;
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      handleInputChange('tags', [...formData.tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = tagToRemove => {
    handleInputChange(
      'tags',
      formData.tags.filter(tag => tag !== tagToRemove)
    );
  };

  const handleKeyPress = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: formData.organization_id,
          title: formData.title,
          description: formData.description,
          severity: formData.severity,
          status: formData.status,
          affectedServices: formData.affected_services,
          impactDescription: formData.impact_description,
          assignedTo: formData.assigned_to || null,
          escalationPolicyId: formData.escalation_policy_id || null,
          tags: formData.tags,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create incident');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/incidents');
      }, 2000);
    } catch (err) {
      console.error('Error creating incident:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityDescription = () => {
    const descriptions = {
      critical: 'Service completely unavailable',
      high: 'Major functionality impacted',
      medium: 'Some features affected',
      low: 'Minor issues or bugs',
      maintenance: 'Planned maintenance work',
    };
    return descriptions[formData.severity] || '';
  };

  const renderStepContent = step => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Provide the essential details about this incident.
            </Typography>

            {formErrors.title && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formErrors.title}
              </Alert>
            )}

            {formErrors.organization_id && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formErrors.organization_id}
              </Alert>
            )}

            <Stack spacing={3}>
              <FormControl fullWidth required>
                <InputLabel>Organization</InputLabel>
                <Select
                  value={formData.organization_id}
                  onChange={e =>
                    handleInputChange('organization_id', e.target.value)
                  }
                  label="Organization"
                  disabled={!!selectedOrganization}
                >
                  {organizations.map(org => (
                    <MenuItem key={org.id} value={org.id}>
                      {org.name}
                    </MenuItem>
                  ))}
                </Select>
                {selectedOrganization && (
                  <FormHelperText>
                    Auto-selected from your current organization
                  </FormHelperText>
                )}
              </FormControl>

              <TextField
                fullWidth
                required
                label="Incident Title"
                value={formData.title}
                onChange={e => handleInputChange('title', e.target.value)}
                placeholder="Brief description of the issue"
                error={!!formErrors.title}
                helperText={
                  formErrors.title || 'Keep it concise and descriptive'
                }
              />

              <TextField
                fullWidth
                multiline
                rows={4}
                label="Description"
                value={formData.description}
                onChange={e => handleInputChange('description', e.target.value)}
                placeholder="Detailed description of the incident..."
                helperText="Provide context, symptoms, and any relevant details"
              />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Severity</InputLabel>
                    <Select
                      value={formData.severity}
                      onChange={e =>
                        handleInputChange('severity', e.target.value)
                      }
                      label="Severity"
                    >
                      {Object.entries(severityColors).map(
                        ([severity, color]) => (
                          <MenuItem key={severity} value={severity}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Chip
                                label={
                                  severity.charAt(0).toUpperCase() +
                                  severity.slice(1)
                                }
                                color={color}
                                size="small"
                              />
                            </Box>
                          </MenuItem>
                        )
                      )}
                    </Select>
                    <FormHelperText>{getSeverityDescription()}</FormHelperText>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={formData.status}
                      onChange={e =>
                        handleInputChange('status', e.target.value)
                      }
                      label="Status"
                    >
                      {Object.entries(statusColors).map(([status, color]) => (
                        <MenuItem key={status} value={status}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Chip
                              label={
                                status.charAt(0).toUpperCase() + status.slice(1)
                              }
                              color={color}
                              size="small"
                            />
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Stack>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Impact & Services
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Describe the impact and identify affected services.
            </Typography>

            {formErrors.impact_description && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formErrors.impact_description}
              </Alert>
            )}

            <Stack spacing={3}>
              <TextField
                fullWidth
                required
                multiline
                rows={4}
                label="Impact Description"
                value={formData.impact_description}
                onChange={e =>
                  handleInputChange('impact_description', e.target.value)
                }
                placeholder="Describe how this incident affects users and services..."
                error={!!formErrors.impact_description}
                helperText={
                  formErrors.impact_description ||
                  'Explain the business impact and user experience'
                }
              />

              <Autocomplete
                multiple
                options={services}
                getOptionLabel={option => option.name || option}
                value={formData.affected_services}
                onChange={(e, newValue) =>
                  handleInputChange('affected_services', newValue)
                }
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Affected Services"
                    helperText="Select services affected by this incident"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option.name || option}
                      {...getTagProps({ index })}
                      key={index}
                    />
                  ))
                }
              />

              <Box>
                <TextField
                  fullWidth
                  label="Add Tags"
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyPress={handleKeyPress}
                  helperText="Press Enter to add tags for categorization"
                  InputProps={{
                    endAdornment: (
                      <Button
                        onClick={handleAddTag}
                        disabled={!newTag.trim()}
                        startIcon={<AddIcon />}
                        size="small"
                      >
                        Add
                      </Button>
                    ),
                  }}
                />

                {formData.tags.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Tags ({formData.tags.length})
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      {formData.tags.map(tag => (
                        <Chip
                          key={tag}
                          label={tag}
                          onDelete={() => handleRemoveTag(tag)}
                          color="primary"
                          variant="outlined"
                          deleteIcon={<DeleteIcon />}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
              </Box>
            </Stack>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Assignment & Escalation
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Assign the incident and configure escalation policies.
            </Typography>

            <Stack spacing={3}>
              <FormControl fullWidth>
                <InputLabel>Assign To</InputLabel>
                <Select
                  value={formData.assigned_to}
                  onChange={e =>
                    handleInputChange('assigned_to', e.target.value)
                  }
                  label="Assign To"
                >
                  <MenuItem value="">
                    <em>Unassigned</em>
                  </MenuItem>
                  {organizationMembers.length === 0 ? (
                    <MenuItem disabled>
                      <em>No members found</em>
                    </MenuItem>
                  ) : (
                    organizationMembers.map(member => (
                        <MenuItem key={member.id} value={member.users?.id || member.user_id}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <PersonIcon fontSize="small" />
                            {member.users?.name || member.name} (
                            {member.users?.email || member.email})
                          </Box>
                        </MenuItem>
                    ))
                  )}
                </Select>
                <FormHelperText>
                  Assign this incident to a team member
                </FormHelperText>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Escalation Policy</InputLabel>
                <Select
                  value={formData.escalation_policy_id}
                  onChange={e =>
                    handleInputChange('escalation_policy_id', e.target.value)
                  }
                  label="Escalation Policy"
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
                  Choose how this incident should escalate if not resolved
                </FormHelperText>
              </FormControl>
            </Stack>
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review & Create
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Review the incident details before creating.
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Basic Information
                  </Typography>
                  <Typography variant="body2">
                    <strong>Title:</strong> {formData.title}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Severity:</strong>{' '}
                    <Chip
                      label={
                        formData.severity.charAt(0).toUpperCase() +
                        formData.severity.slice(1)
                      }
                      color={severityColors[formData.severity]}
                      size="small"
                    />
                  </Typography>
                  <Typography variant="body2">
                    <strong>Status:</strong>{' '}
                    <Chip
                      label={
                        formData.status.charAt(0).toUpperCase() +
                        formData.status.slice(1)
                      }
                      color={statusColors[formData.status]}
                      size="small"
                    />
                  </Typography>
                  {formData.description && (
                    <Typography variant="body2">
                      <strong>Description:</strong> {formData.description}
                    </Typography>
                  )}
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Impact & Services
                  </Typography>
                  <Typography variant="body2">
                    <strong>Impact:</strong> {formData.impact_description}
                  </Typography>
                  {formData.affected_services.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        <strong>Affected Services:</strong>
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={1}
                        flexWrap="wrap"
                        useFlexGap
                        sx={{ mt: 0.5 }}
                      >
                        {formData.affected_services.map((service, index) => (
                          <Chip
                            key={index}
                            label={service.name || service}
                            variant="outlined"
                            size="small"
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Assignment & Escalation
                  </Typography>
                  <Typography variant="body2">
                    <strong>Assigned To:</strong>{' '}
                    {formData.assigned_to
                      ? organizationMembers.find(
                          m => (m.users?.id || m.user_id) === formData.assigned_to
                        )?.users?.name ||
                        organizationMembers.find(
                          m => (m.users?.id || m.user_id) === formData.assigned_to
                        )?.name ||
                        'Unknown'
                      : 'Unassigned'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Escalation Policy:</strong>{' '}
                    {formData.escalation_policy_id
                      ? escalationPolicies.find(
                          p => p.id === formData.escalation_policy_id
                        )?.name || 'Unknown'
                      : 'None'}
                  </Typography>
                  {formData.tags.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        <strong>Tags:</strong>
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={1}
                        flexWrap="wrap"
                        useFlexGap
                        sx={{ mt: 0.5 }}
                      >
                        {formData.tags.map(tag => (
                          <Chip
                            key={tag}
                            label={tag}
                            color="primary"
                            variant="outlined"
                            size="small"
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Paper>
              </Grid>

              {success && (
                <Grid item xs={12}>
                  <Alert severity="success">
                    Incident created successfully! Redirecting...
                  </Alert>
                </Grid>
              )}
            </Grid>
          </Box>
        );

      default:
        return null;
    }
  };

  if (!session) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="200px"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ProtectedRoute>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box display="flex" alignItems="center" gap={2} mb={4}>
          <Button
            component={Link}
            href="/incidents"
            startIcon={<ArrowBackIcon />}
            variant="outlined"
          >
            Back to Incidents
          </Button>
          <Typography variant="h4" component="h1">
            Create Incident
          </Typography>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Progress Stepper */}
        <Paper sx={{ p: 3, mb: 4 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel
                  icon={step.icon}
                  optional={
                    index < activeStep ? (
                      <CheckCircleIcon
                        sx={{ color: 'success.main', fontSize: 16 }}
                      />
                    ) : null
                  }
                >
                  <Typography variant="subtitle2">{step.label}</Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>

        {/* Main Content */}
        <Paper sx={{ p: 4 }}>
          {renderStepContent(activeStep)}

          {/* Navigation Buttons */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              mt: 4,
              pt: 3,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              variant="outlined"
            >
              Back
            </Button>

            <Box display="flex" gap={2}>
              <Button
                component={Link}
                href="/incidents"
                variant="outlined"
                color="inherit"
              >
                Cancel
              </Button>

              {activeStep === steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={loading}
                  startIcon={
                    loading ? <CircularProgress size={20} /> : <SaveIcon />
                  }
                  color="error"
                >
                  {loading ? 'Creating...' : 'Create Incident'}
                </Button>
              ) : (
                <Button variant="contained" onClick={handleNext}>
                  Next
                </Button>
              )}
            </Box>
          </Box>
        </Paper>
      </Box>
    </ProtectedRoute>
  );
}
