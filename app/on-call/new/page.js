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
  IconButton,
  FormControlLabel,
  Switch,
  Chip,
  Autocomplete,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import { useSession } from 'next-auth/react';
import dayjs from 'dayjs';

export default function CreateOnCallSchedulePage() {
  const router = useRouter();
  const { data: session } = useSession();
  
  const [formData, setFormData] = useState({
    organization_id: '',
    name: '',
    description: '',
    start_date: dayjs().add(1, 'hour'),
    end_date: dayjs().add(1, 'week'),
    rotation_type: 'weekly',
    rotation_interval_hours: 168, // 1 week
    participants: [],
    is_active: true,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  });

  const [organizations, setOrganizations] = useState([]);
  const [organizationMembers, setOrganizationMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (session) {
      fetchOrganizations();
    }
  }, [session]);

  useEffect(() => {
    if (formData.organization_id) {
      fetchOrganizationMembers(formData.organization_id);
    }
  }, [formData.organization_id]);

  // Update rotation interval when rotation type changes
  useEffect(() => {
    const intervals = {
      daily: 24,
      weekly: 168,
      biweekly: 336,
      monthly: 720 // ~30 days
    };
    
    if (intervals[formData.rotation_type]) {
      setFormData(prev => ({
        ...prev,
        rotation_interval_hours: intervals[formData.rotation_type]
      }));
    }
  }, [formData.rotation_type]);

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
            organization_id: data.organizations[0].id
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching organizations:', err);
    }
  };

  const fetchOrganizationMembers = async (orgId) => {
    try {
      const response = await fetch(`/api/organizations/${orgId}`);
      if (response.ok) {
        const data = await response.json();
        setOrganizationMembers(data.members || []);
      }
    } catch (err) {
      console.error('Error fetching organization members:', err);
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.organization_id) errors.organization_id = 'Organization is required';
    if (!formData.name.trim()) errors.name = 'Schedule name is required';
    if (!formData.start_date) errors.start_date = 'Start date is required';
    if (!formData.end_date) errors.end_date = 'End date is required';
    if (formData.participants.length === 0) errors.participants = 'At least one participant is required';
    
    // Date validation
    if (formData.start_date && formData.end_date) {
      if (formData.end_date.isBefore(formData.start_date)) {
        errors.end_date = 'End date must be after start date';
      }
      if (formData.start_date.isBefore(dayjs())) {
        errors.start_date = 'Start date cannot be in the past';
      }
    }
    
    // Rotation interval validation
    if (formData.rotation_interval_hours < 1) {
      errors.rotation_interval_hours = 'Rotation interval must be at least 1 hour';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setError('Please fix the form errors before submitting');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const submitData = {
        organization_id: formData.organization_id,
        name: formData.name,
        description: formData.description,
        start_date: formData.start_date.toISOString(),
        end_date: formData.end_date.toISOString(),
        rotation_type: formData.rotation_type,
        rotation_interval_hours: formData.rotation_interval_hours,
        participants: formData.participants.map(p => p.id),
        timezone: formData.timezone,
        is_active: formData.is_active
      };

      const response = await fetch('/api/on-call-schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create on-call schedule');
      }

      const data = await response.json();
      setSuccess(true);
      
      // Redirect to on-call page after a short delay
      setTimeout(() => {
        router.push('/on-call');
      }, 2000);

    } catch (err) {
      console.error('Error creating on-call schedule:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear field error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleAddParticipant = () => {
    if (selectedMember && !formData.participants.find(p => p.id === selectedMember.id)) {
      setFormData(prev => ({
        ...prev,
        participants: [...prev.participants, selectedMember]
      }));
      setSelectedMember(null);
      
      // Clear participants error
      if (formErrors.participants) {
        setFormErrors(prev => ({
          ...prev,
          participants: ''
        }));
      }
    }
  };

  const handleRemoveParticipant = (memberId) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.filter(p => p.id !== memberId)
    }));
  };

  const getRotationDescription = (type) => {
    switch (type) {
      case 'daily': return 'Rotates every day at midnight';
      case 'weekly': return 'Rotates every week on the same day';
      case 'biweekly': return 'Rotates every two weeks';
      case 'monthly': return 'Rotates monthly on the same date';
      case 'custom': return 'Custom rotation interval';
      default: return '';
    }
  };

  if (!session) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Please sign in to create on-call schedules.</Typography>
      </Box>
    );
  }

  if (success) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="success" sx={{ mb: 2 }}>
          On-call schedule created successfully! Redirecting to on-call dashboard...
        </Alert>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box display="flex" alignItems="center" gap={2} mb={4}>
          <Button
            component={Link}
            href="/on-call"
            startIcon={<ArrowBackIcon />}
            variant="outlined"
          >
            Back to On-Call
          </Button>
          <Typography variant="h4" component="h1">
            Create On-Call Schedule
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
                      onChange={(e) => handleInputChange('organization_id', e.target.value)}
                    >
                      {organizations.map((org) => (
                        <MenuItem key={org.id} value={org.id}>
                          {org.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {formErrors.organization_id && (
                      <FormHelperText>{formErrors.organization_id}</FormHelperText>
                    )}
                  </FormControl>
                </Grid>

                {/* Schedule Name */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Schedule Name *"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    error={!!formErrors.name}
                    helperText={formErrors.name || 'A descriptive name for this on-call schedule'}
                    placeholder="e.g., Engineering Team Primary On-Call"
                  />
                </Grid>

                {/* Description */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    helperText="Describe the purpose and scope of this on-call schedule"
                    placeholder="Primary on-call rotation for critical production incidents..."
                  />
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Schedule Configuration
                  </Typography>
                </Grid>

                {/* Start and End Dates */}
                <Grid item xs={12} md={6}>
                  <DateTimePicker
                    label="Start Date & Time *"
                    value={formData.start_date}
                    onChange={(newValue) => handleInputChange('start_date', newValue)}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        error: !!formErrors.start_date,
                        helperText: formErrors.start_date || 'When this schedule becomes active'
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <DateTimePicker
                    label="End Date & Time *"
                    value={formData.end_date}
                    onChange={(newValue) => handleInputChange('end_date', newValue)}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        error: !!formErrors.end_date,
                        helperText: formErrors.end_date || 'When this schedule expires (optional)'
                      }
                    }}
                  />
                </Grid>

                {/* Rotation Type */}
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Rotation Type</InputLabel>
                    <Select
                      value={formData.rotation_type}
                      label="Rotation Type"
                      onChange={(e) => handleInputChange('rotation_type', e.target.value)}
                    >
                      <MenuItem value="daily">Daily</MenuItem>
                      <MenuItem value="weekly">Weekly</MenuItem>
                      <MenuItem value="biweekly">Bi-weekly</MenuItem>
                      <MenuItem value="monthly">Monthly</MenuItem>
                      <MenuItem value="custom">Custom</MenuItem>
                    </Select>
                    <FormHelperText>
                      {getRotationDescription(formData.rotation_type)}
                    </FormHelperText>
                  </FormControl>
                </Grid>

                {/* Rotation Interval (Custom) */}
                {formData.rotation_type === 'custom' && (
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Rotation Interval (hours)"
                      value={formData.rotation_interval_hours}
                      onChange={(e) => handleInputChange('rotation_interval_hours', parseInt(e.target.value))}
                      error={!!formErrors.rotation_interval_hours}
                      helperText={formErrors.rotation_interval_hours || 'How often to rotate in hours'}
                      inputProps={{ min: 1, max: 8760 }}
                    />
                  </Grid>
                )}

                {/* Timezone */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Timezone"
                    value={formData.timezone}
                    onChange={(e) => handleInputChange('timezone', e.target.value)}
                    helperText="Schedule timezone (auto-detected)"
                    disabled
                  />
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    👥 On-Call Responders
                  </Typography>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <strong>How it works:</strong> Add team members who will respond to incidents. 
                    They'll rotate in the order you set them (Person #1 → Person #2 → Person #3...).
                    The first person added will be on-call when the schedule starts.
                  </Alert>
                </Grid>

                {/* Add Participants */}
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ p: 2, mb: 2, backgroundColor: 'grey.50' }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                      ➕ Add Responders to Rotation
                    </Typography>
                    <Box display="flex" gap={2} alignItems="center">
                      <Autocomplete
                        options={organizationMembers.filter(member => 
                          !formData.participants.find(p => p.id === member.id)
                        )}
                        getOptionLabel={(option) => option.name || option.email}
                        value={selectedMember}
                        onChange={(event, newValue) => setSelectedMember(newValue)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="🔍 Search Team Members"
                            placeholder="Type to search for team members..."
                            sx={{ flexGrow: 1, minWidth: 300 }}
                          />
                        )}
                        renderOption={(props, option) => (
                          <li {...props}>
                            <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                            <div>
                              <Typography variant="body1">
                                {option.name || option.email}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {option.role || 'Member'} • Available for on-call
                              </Typography>
                            </div>
                          </li>
                        )}
                        noOptionsText={organizationMembers.length === 0 ? 
                          "No team members found. Make sure you've added people to your organization." :
                          "All team members are already in the rotation."
                        }
                      />
                      <Button
                        startIcon={<AddIcon />}
                        onClick={handleAddParticipant}
                        disabled={!selectedMember}
                        variant="contained"
                        size="large"
                      >
                        Add to Rotation
                      </Button>
                    </Box>
                  </Card>

                  {formErrors.participants && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {formErrors.participants}
                    </Alert>
                  )}

                  {/* Empty State */}
                  {formData.participants.length === 0 && (
                    <Card variant="outlined" sx={{ mb: 2, border: '2px dashed', borderColor: 'primary.main' }}>
                      <CardContent sx={{ textAlign: 'center', py: 4 }}>
                        <PersonIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                        <Typography variant="h6" gutterBottom>
                          No Responders Added Yet
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Use the dropdown above to add team members to the on-call rotation.
                          You need at least one person to create the schedule.
                        </Typography>
                      </CardContent>
                    </Card>
                  )}

                  {/* Participants List */}
                  {formData.participants.length > 0 && (
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" gutterBottom>
                          On-Call Rotation Order ({formData.participants.length} members)
                        </Typography>
                        <List dense>
                          {formData.participants.map((participant, index) => (
                            <ListItem key={participant.id} divider={index < formData.participants.length - 1}>
                              <Chip 
                                label={`#${index + 1}`} 
                                size="small" 
                                color="primary" 
                                sx={{ mr: 2 }}
                              />
                              <ListItemText
                                primary={participant.name || participant.email}
                                secondary={participant.role || 'Member'}
                              />
                              <ListItemSecondaryAction>
                                <IconButton
                                  edge="end"
                                  onClick={() => handleRemoveParticipant(participant.id)}
                                  color="error"
                                  size="small"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </ListItemSecondaryAction>
                            </ListItem>
                          ))}
                        </List>
                        
                        {formData.participants.length > 0 && (
                          <Box sx={{ mt: 2, p: 2, backgroundColor: 'success.light', borderRadius: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                              🔄 Rotation Schedule Preview:
                            </Typography>
                            <Typography variant="body2" color="success.contrastText">
                              <strong>Current on-call:</strong> {formData.participants[0]?.name || formData.participants[0]?.email}
                              {formData.participants.length > 1 && (
                                <>
                                  <br />
                                  <strong>Next up:</strong> {formData.participants[1]?.name || formData.participants[1]?.email}
                                  {formData.participants.length > 2 && ` → ${formData.participants[2]?.name || formData.participants[2]?.email}`}
                                  {formData.participants.length > 3 && ' → ...'}
                                </>
                              )}
                              <br />
                              <strong>Rotation frequency:</strong> Every{' '}
                              {formData.rotation_type === 'custom' 
                                ? `${formData.rotation_interval_hours} hours`
                                : formData.rotation_type
                              }
                              {formData.participants.length === 1 && (
                                <><br /><em>⚠️ Only one person - no rotation will occur</em></>
                              )}
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </Grid>

                {/* Status */}
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.is_active}
                        onChange={(e) => handleInputChange('is_active', e.target.checked)}
                      />
                    }
                    label="Enable this on-call schedule"
                  />
                </Grid>

                {/* Submit Buttons */}
                <Grid item xs={12}>
                  <Box display="flex" gap={2} justifyContent="flex-end" sx={{ mt: 2 }}>
                    <Button
                      component={Link}
                      href="/on-call"
                      variant="outlined"
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                      disabled={loading}
                      color="primary"
                    >
                      {loading ? 'Creating...' : 'Create Schedule'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </form>
          </CardContent>
        </Card>
      </Box>
    </LocalizationProvider>
  );
} 