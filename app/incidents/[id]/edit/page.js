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
  Container,
} from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import EscalateIcon from '@mui/icons-material/TrendingUp';
import HistoryIcon from '@mui/icons-material/History';
import InfoIcon from '@mui/icons-material/Info';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useOrganization } from '@/contexts/OrganizationContext';

export const runtime = 'edge';

export default function EditIncidentPage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useOrganization();
  const incidentId = params.id;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    severity: 'medium',
    status: 'open',
    affected_services: [],
    impact_description: '',
    assigned_to: '',
    escalation_policy_id: '',
    tags: [],
    resolution_notes: '',
  });

  const [originalIncident, setOriginalIncident] = useState(null);
  const [escalationPolicies, setEscalationPolicies] = useState([]);
  const [organizationMembers, setOrganizationMembers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // New tag input
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (incidentId && session) {
      fetchIncident();
    }
  }, [incidentId, session]);

  // Track unsaved changes
  useEffect(() => {
    if (originalIncident) {
      const hasChanges = JSON.stringify(formData) !== JSON.stringify({
        title: originalIncident.title || '',
        description: originalIncident.description || '',
        severity: originalIncident.severity || 'medium',
        status: originalIncident.status || 'open',
        affected_services: originalIncident.affected_services || [],
        impact_description: originalIncident.impact_description || '',
        assigned_to: originalIncident.assigned_to || '',
        escalation_policy_id: originalIncident.escalation_policy_id || '',
        tags: originalIncident.tags || [],
        resolution_notes: originalIncident.resolution_notes || '',
      });
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, originalIncident]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const fetchIncident = async () => {
    try {
      console.log('Fetching incident with ID:', incidentId);
      const response = await fetch(`/api/incidents/${incidentId}`);
      console.log('Incident fetch response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Incident data received:', data);
        const incident = data.incident;
        setOriginalIncident(incident);

        // Populate form with existing data
        setFormData({
          title: incident.title || '',
          description: incident.description || '',
          severity: incident.severity || 'medium',
          status: incident.status || 'open',
          affected_services: incident.affected_services || [],
          impact_description: incident.impact_description || '',
          assigned_to: incident.assigned_to || '',
          escalation_policy_id: incident.escalation_policy_id || '',
          tags: incident.tags || [],
          resolution_notes: incident.resolution_notes || '',
        });

        // Fetch related data
        await fetchOrganizationData(incident.organization_id);
      } else if (response.status === 404) {
        setError('Incident not found');
      } else {
        const errorData = await response.text();
        console.error('Failed to fetch incident:', response.status, errorData);
        setError('Failed to load incident');
      }
    } catch (err) {
      console.error('Error fetching incident:', err);
      setError('Failed to load incident');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizationData = async orgId => {
    try {
      console.log('Fetching organization data for orgId:', orgId);
      
      // Fetch escalation policies
      console.log('Fetching escalation policies...');
      const policiesResponse = await fetch(
        `/api/escalation-policies?organization_id=${orgId}&active_only=true`
      );
      console.log('Escalation policies response status:', policiesResponse.status);
      if (policiesResponse.ok) {
        const policiesData = await policiesResponse.json();
        console.log('Escalation policies data:', policiesData);
        setEscalationPolicies(policiesData.escalation_policies || []);
      }

      // Fetch organization members
      console.log('Fetching organization members...');
      const membersResponse = await fetch(`/api/organizations/${orgId}/members`);
      console.log('Members response status:', membersResponse.status);
      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        console.log('Members data:', membersData);
        setOrganizationMembers(membersData.members || []);
      } else {
        const membersError = await membersResponse.text();
        console.error('Members fetch error:', membersResponse.status, membersError);
      }

      // Fetch services
      console.log('Fetching services...');
      const servicesResponse = await fetch(
        `/api/services?organization_id=${orgId}`
      );
      console.log('Services response status:', servicesResponse.status);
      if (servicesResponse.ok) {
        const servicesData = await servicesResponse.json();
        console.log('Services data:', servicesData);
        setServices(servicesData.services || []);
      } else {
        const servicesError = await servicesResponse.text();
        console.error('Services fetch error:', servicesResponse.status, servicesError);
      }
    } catch (err) {
      console.error('Error fetching organization data:', err);
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.length > 200) {
      errors.title = 'Title must be less than 200 characters';
    }
    
    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    } else if (formData.description.length > 2000) {
      errors.description = 'Description must be less than 2000 characters';
    }

    if (formData.impact_description && formData.impact_description.length > 1000) {
      errors.impact_description = 'Impact description must be less than 1000 characters';
    }

    if (formData.status === 'resolved' && !formData.resolution_notes.trim()) {
      errors.resolution_notes = 'Resolution notes are required when status is resolved';
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

    setSaving(true);
    setError(null);

    try {
      const submitData = {
        ...formData,
        affected_services: formData.affected_services.map(service =>
          typeof service === 'string' ? service : service.name || service.id
        ),
      };

      const response = await fetch(`/api/incidents/${incidentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update incident');
      }

      setSuccess(true);
      setHasUnsavedChanges(false);

      // Redirect to the incident detail page after a short delay
      setTimeout(() => {
        router.push(`/incidents/${incidentId}`);
      }, 2000);
    } catch (err) {
      console.error('Error updating incident:', err);
      setError(err.message);
    } finally {
      setSaving(false);
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

  return (
    <ProtectedRoute>
      {loading ? (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
        >
          <CircularProgress />
        </Box>
      ) : error && !originalIncident ? (
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button
            component={Link}
            href="/incidents"
            startIcon={<ArrowBackIcon />}
            variant="outlined"
          >
            Back to Incidents
          </Button>
        </Container>
      ) : success ? (
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Alert severity="success" sx={{ mb: 2 }}>
            Incident updated successfully! Redirecting to incident details...
          </Alert>
        </Container>
      ) : (
        <Container maxWidth="lg" sx={{ py: 3 }}>
          {/* Header */}
          <Box display="flex" alignItems="center" gap={2} mb={4}>
            <Button
              component={Link}
              href={`/incidents/${incidentId}`}
              startIcon={<ArrowBackIcon />}
              variant="outlined"
            >
              Back to Incident
            </Button>
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
                Edit Incident #{originalIncident?.incident_number}
              </Typography>
              {originalIncident?.title && (
                <Typography variant="h6" color="text.secondary" sx={{ mt: 0.5 }}>
                  {originalIncident.title}
                </Typography>
              )}
            </Box>
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Unsaved Changes Warning */}
          {hasUnsavedChanges && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              You have unsaved changes. Make sure to save before leaving this page.
            </Alert>
          )}

          {/* Form */}
          <Card elevation={2}>
            <CardContent sx={{ p: 4 }}>
              <form onSubmit={handleSubmit}>
                <Grid container spacing={4}>
                  {/* Basic Information Section */}
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
                      Basic Information
                    </Typography>
                  </Grid>

                  {/* Title */}
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      label="Incident Title *"
                      value={formData.title}
                      onChange={e => handleInputChange('title', e.target.value)}
                      error={!!formErrors.title}
                      helperText={
                        formErrors.title ||
                        `A clear, concise description of the incident (${formData.title.length}/200)`
                      }
                      placeholder="e.g., API service experiencing high latency"
                      variant="outlined"
                      sx={{ mb: 1 }}
                    />
                  </Grid>

                  {/* Description */}
                  <Grid size={{ xs: 12 }}>
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
                        `Detailed description of the incident and its impact (${formData.description.length}/2000)`
                      }
                      placeholder="Describe the incident, when it started, symptoms, and any initial investigation findings..."
                      variant="outlined"
                      sx={{ mb: 1 }}
                    />
                  </Grid>

                  {/* Classification Section */}
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, mt: 2 }}>
                      Classification
                    </Typography>
                  </Grid>

                  {/* Severity and Status */}
                  <Grid size={{ xs: 12, md: 6 }}>
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

                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={formData.status}
                        label="Status"
                        onChange={e =>
                          handleInputChange('status', e.target.value)
                        }
                      >
                        <MenuItem value="open">Open</MenuItem>
                        <MenuItem value="investigating">Investigating</MenuItem>
                        <MenuItem value="monitoring">Monitoring</MenuItem>
                        <MenuItem value="resolved">Resolved</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Impact Description */}
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Impact Description"
                      value={formData.impact_description}
                      onChange={e =>
                        handleInputChange('impact_description', e.target.value)
                      }
                      error={!!formErrors.impact_description}
                      helperText={
                        formErrors.impact_description ||
                        `Describe the customer or business impact (${formData.impact_description.length}/1000)`
                      }
                      placeholder="e.g., Users unable to login, checkout process failing for 25% of customers"
                      variant="outlined"
                      sx={{ mb: 1 }}
                    />
                  </Grid>

                  {/* Resolution Notes (only show if resolved) */}
                  {formData.status === 'resolved' && (
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Resolution Notes"
                        value={formData.resolution_notes}
                        onChange={e =>
                          handleInputChange('resolution_notes', e.target.value)
                        }
                        error={!!formErrors.resolution_notes}
                        helperText={
                          formErrors.resolution_notes ||
                          'Describe how the incident was resolved and the root cause'
                        }
                        placeholder="Explain the root cause and steps taken to resolve the incident..."
                      />
                    </Grid>
                  )}

                  {/* Assignment Section */}
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, mt: 3 }}>
                      Assignment & Escalation
                    </Typography>
                  </Grid>

                  {/* Assigned To */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box display="flex" gap={1} alignItems="start">
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
                            <MenuItem key={member.id} value={member.users?.id || member.user_id}>
                              {member.users?.name || member.name} ({member.users?.email || member.email})
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Button
                        variant="outlined"
                        startIcon={<EscalateIcon />}
                        sx={{ mt: 1, minWidth: 120 }}
                        onClick={() => {
                          // For now, just show a simple escalation action
                          alert('Escalation feature coming soon!');
                        }}
                      >
                        Escalate
                      </Button>
                    </Box>
                  </Grid>

                  {/* Escalation Policy */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth>
                      <InputLabel>Escalation Policy</InputLabel>
                      <Select
                        value={formData.escalation_policy_id}
                        label="Escalation Policy"
                        onChange={e =>
                          handleInputChange(
                            'escalation_policy_id',
                            e.target.value
                          )
                        }
                      >
                        <MenuItem value="">No escalation policy</MenuItem>
                        {escalationPolicies.map(policy => (
                          <MenuItem key={policy.id} value={policy.id}>
                            {policy.name}
                          </MenuItem>
                        ))}
                      </Select>
                      {formData.escalation_policy_id && (
                        <FormHelperText>
                          <InfoIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                          Policy will determine automatic escalation rules for this incident
                        </FormHelperText>
                      )}
                    </FormControl>
                  </Grid>

                  {/* Services Section */}
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, mt: 3 }}>
                      Affected Services
                    </Typography>
                  </Grid>

                  {/* Affected Services */}
                  <Grid size={{ xs: 12 }}>
                    <Autocomplete
                      multiple
                      options={services}
                      getOptionLabel={option => option.name || option.id || 'Unnamed Service'}
                      value={formData.affected_services}
                      onChange={(e, newValue) =>
                        handleInputChange('affected_services', newValue)
                      }
                      renderInput={params => (
                        <TextField
                          {...params}
                          label="Affected Services"
                          helperText="Select services affected by this incident"
                          variant="outlined"
                        />
                      )}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            variant="outlined"
                            label={option.name || option.id || 'Unnamed Service'}
                            {...getTagProps({ index })}
                            key={index}
                            color="primary"
                          />
                        ))
                      }
                      sx={{ mb: 1 }}
                    />
                  </Grid>

                  {/* Tags Section */}
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, mt: 3 }}>
                      Tags & Metadata
                    </Typography>
                    <Box>
                      <TextField
                        fullWidth
                        label="Add Tags"
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        onKeyPress={handleKeyPress}
                        helperText="Press Enter or click Add to include tags for categorization"
                        sx={{ mb: 1 }}
                      />
                      <Button
                        onClick={handleAddTag}
                        disabled={!newTag.trim()}
                        variant="outlined"
                        size="small"
                        sx={{ mb: 2 }}
                      >
                        Add Tag
                      </Button>

                      {formData.tags.length > 0 && (
                        <Box
                          sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 1,
                          }}
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
                  <Grid size={{ xs: 12 }}>
                    <Box
                      display="flex"
                      gap={2}
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider' }}
                    >
                      <Button
                        component={Link}
                        href={`/incidents/${incidentId}`}
                        variant="text"
                        color="inherit"
                        startIcon={<HistoryIcon />}
                      >
                        View History
                      </Button>
                      <Box display="flex" gap={2}>
                        <Button
                          component={Link}
                          href={`/incidents/${incidentId}`}
                          variant="outlined"
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="contained"
                          startIcon={
                            saving ? <CircularProgress size={20} /> : <SaveIcon />
                          }
                          disabled={saving}
                          color="primary"
                          size="large"
                        >
                          {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                        {/* Bottom Save Button for Long Forms */}
                        <Button
                          type="submit"
                          variant="contained"
                          startIcon={
                            saving ? <CircularProgress size={20} /> : <SaveIcon />
                          }
                          disabled={saving}
                          color="primary"
                          size="large"
                          sx={{ 
                            position: 'fixed', 
                            bottom: 24, 
                            right: 24, 
                            zIndex: 1000,
                            display: { xs: 'flex', md: 'none' }
                          }}
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </Button>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </form>
            </CardContent>
          </Card>
        </Container>
      )}
    </ProtectedRoute>
  );
}
