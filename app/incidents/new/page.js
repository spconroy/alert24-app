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
} from '@mui/material';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import { useSession } from 'next-auth/react';

export default function CreateIncidentPage() {
  const router = useRouter();
  const { data: session } = useSession();

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
    if (formData.organization_id) {
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

      // Fetch organization details and members
      const orgResponse = await fetch(`/api/organizations/${orgId}`);
      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        setOrganizationMembers(orgData.members || []);
      }

      // Fetch services (status pages for now)
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

  const validateForm = () => {
    const errors = {};

    if (!formData.organization_id)
      errors.organization_id = 'Organization is required';
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (!formData.description.trim())
      errors.description = 'Description is required';

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
      // Map form data to match backend API expectations (camelCase)
      const submitData = {
        organizationId: formData.organization_id,
        title: formData.title,
        description: formData.description,
        severity: formData.severity,
        status: formData.status,
        affectedServices: formData.affected_services.map(service =>
          typeof service === 'string' ? service : service.id
        ),
        impactDescription: formData.impact_description,
        assignedTo: formData.assigned_to,
        createdBy: session?.user?.id || session?.user?.email,
        escalationPolicyId: formData.escalation_policy_id,
        tags: formData.tags,
        source: 'manual',
      };

      const response = await fetch('/api/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create incident');
      }

      const data = await response.json();
      setSuccess(true);

      // Redirect to the new incident after a short delay
      setTimeout(() => {
        router.push(`/incidents/${data.incident.id}`);
      }, 2000);
    } catch (err) {
      console.error('Error creating incident:', err);
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

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = tagToRemove => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  const handleKeyPress = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  if (!session) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <Typography>Please sign in to create incidents.</Typography>
      </Box>
    );
  }

  if (success) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="success" sx={{ mb: 2 }}>
          Incident created successfully! Redirecting to incident details...
        </Alert>
      </Box>
    );
  }

  return (
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
          Create New Incident
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
              {/* Organization Selection */}
              <Grid item xs={12}>
                <FormControl fullWidth error={!!formErrors.organization_id}>
                  <InputLabel>Organization *</InputLabel>
                  <Select
                    value={formData.organization_id}
                    label="Organization *"
                    onChange={e =>
                      handleInputChange('organization_id', e.target.value)
                    }
                  >
                    {organizations.map(org => (
                      <MenuItem key={org.id} value={org.id}>
                        {org.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.organization_id && (
                    <FormHelperText>
                      {formErrors.organization_id}
                    </FormHelperText>
                  )}
                </FormControl>
              </Grid>

              {/* Title */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Incident Title *"
                  value={formData.title}
                  onChange={e => handleInputChange('title', e.target.value)}
                  error={!!formErrors.title}
                  helperText={
                    formErrors.title ||
                    'A clear, concise description of the incident'
                  }
                  placeholder="e.g., API service experiencing high latency"
                />
              </Grid>

              {/* Description */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Description *"
                  value={formData.description}
                  onChange={e =>
                    handleInputChange('description', e.target.value)
                  }
                  error={!!formErrors.description}
                  helperText={
                    formErrors.description ||
                    'Detailed description of the incident and its impact'
                  }
                  placeholder="Describe the incident, when it started, symptoms, and any initial investigation findings..."
                />
              </Grid>

              {/* Severity and Status */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Severity</InputLabel>
                  <Select
                    value={formData.severity}
                    label="Severity"
                    onChange={e =>
                      handleInputChange('severity', e.target.value)
                    }
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="critical">Critical</MenuItem>
                  </Select>
                  <FormHelperText>
                    {formData.severity === 'critical' &&
                      'Service completely unavailable'}
                    {formData.severity === 'high' &&
                      'Major functionality impacted'}
                    {formData.severity === 'medium' &&
                      'Some functionality impacted'}
                    {formData.severity === 'low' &&
                      'Minor impact or cosmetic issue'}
                  </FormHelperText>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    label="Status"
                    onChange={e => handleInputChange('status', e.target.value)}
                  >
                    <MenuItem value="open">Open</MenuItem>
                    <MenuItem value="investigating">Investigating</MenuItem>
                    <MenuItem value="monitoring">Monitoring</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Impact Description */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Impact Description"
                  value={formData.impact_description}
                  onChange={e =>
                    handleInputChange('impact_description', e.target.value)
                  }
                  helperText="Describe the customer or business impact"
                  placeholder="e.g., Users unable to login, checkout process failing for 25% of customers"
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Assignment & Escalation
                </Typography>
              </Grid>

              {/* Assigned To */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Assign To</InputLabel>
                  <Select
                    value={formData.assigned_to}
                    label="Assign To"
                    onChange={e =>
                      handleInputChange('assigned_to', e.target.value)
                    }
                  >
                    <MenuItem value="">Unassigned</MenuItem>
                    {organizationMembers.map(member => (
                      <MenuItem key={member.id} value={member.id}>
                        {member.name || member.email}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Escalation Policy */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Escalation Policy</InputLabel>
                  <Select
                    value={formData.escalation_policy_id}
                    label="Escalation Policy"
                    onChange={e =>
                      handleInputChange('escalation_policy_id', e.target.value)
                    }
                  >
                    <MenuItem value="">No escalation policy</MenuItem>
                    {escalationPolicies.map(policy => (
                      <MenuItem key={policy.id} value={policy.id}>
                        {policy.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Affected Services */}
              <Grid item xs={12}>
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
              </Grid>

              {/* Tags */}
              <Grid item xs={12}>
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
                        >
                          Add
                        </Button>
                      ),
                    }}
                  />

                  {formData.tags.length > 0 && (
                    <Box
                      sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}
                    >
                      {formData.tags.map(tag => (
                        <Chip
                          key={tag}
                          label={tag}
                          onDelete={() => handleRemoveTag(tag)}
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  )}
                </Box>
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
                    href="/incidents"
                    variant="outlined"
                    disabled={loading}
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
                    color="error"
                  >
                    {loading ? 'Creating...' : 'Create Incident'}
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
