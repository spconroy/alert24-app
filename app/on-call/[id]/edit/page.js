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
  ListItemSecondaryAction,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import ClearIcon from '@mui/icons-material/Clear';
import { useOrganization } from '@/contexts/OrganizationContext';
import dayjs from 'dayjs';
import ProtectedRoute from '@/components/ProtectedRoute';

export const runtime = 'edge';

export default function EditOnCallSchedulePage() {
  const router = useRouter();
  const params = useParams();
  const scheduleId = params.id;
  const { session, selectedOrganization } = useOrganization();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: dayjs(),
    end_date: null,
    rotation_type: 'weekly',
    rotation_interval_hours: 168,
    rotation_day: 1,
    rotation_time: dayjs().hour(9).minute(0).second(0),
    participants: [],
    is_active: true,
    timezone: 'UTC',
  });

  const [originalSchedule, setOriginalSchedule] = useState(null);
  const [organizationMembers, setOrganizationMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (scheduleId && session) {
      fetchSchedule();
    }
  }, [scheduleId, session]);

  useEffect(() => {
    if (selectedOrganization?.id) {
      fetchOrganizationMembers(selectedOrganization.id);
    }
  }, [selectedOrganization]);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/on-call-schedules/${scheduleId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch schedule');
      }

      const data = await response.json();
      const schedule = data.schedule;

      setOriginalSchedule(schedule);

      // Parse rotation config if it exists
      let rotationConfig = {};
      try {
        rotationConfig = schedule.rotation_config
          ? typeof schedule.rotation_config === 'string'
            ? JSON.parse(schedule.rotation_config)
            : schedule.rotation_config
          : {};
      } catch (e) {
        console.warn('Failed to parse rotation config:', e);
        rotationConfig = {};
      }

      // Parse members/participants if they exist
      let participants = [];
      try {
        participants = schedule.members
          ? typeof schedule.members === 'string'
            ? JSON.parse(schedule.members)
            : schedule.members
          : [];
      } catch (e) {
        console.warn('Failed to parse members:', e);
        participants = [];
      }

      // Populate form with existing data
      setFormData({
        name: schedule.name || '',
        description: schedule.description || '',
        start_date: rotationConfig.start_date
          ? dayjs(rotationConfig.start_date)
          : dayjs(),
        end_date: rotationConfig.end_date
          ? dayjs(rotationConfig.end_date)
          : null,
        rotation_type:
          rotationConfig.rotation_type || schedule.schedule_type || 'weekly',
        rotation_interval_hours: rotationConfig.rotation_interval_hours || 168,
        rotation_day: rotationConfig.rotation_day || 1,
        rotation_time: rotationConfig.rotation_time
          ? dayjs()
              .hour(rotationConfig.rotation_time.hour || 9)
              .minute(rotationConfig.rotation_time.minute || 0)
          : dayjs().hour(9).minute(0),
        participants: participants,
        is_active: schedule.is_active || false,
        timezone: rotationConfig.timezone || schedule.timezone || 'UTC',
      });
    } catch (err) {
      console.error('Error fetching schedule:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizationMembers = async orgId => {
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

    if (!formData.name.trim()) errors.name = 'Schedule name is required';
    if (!formData.start_date) errors.start_date = 'Start date is required';

    // Date validation - allow past dates for existing schedules
    if (
      formData.end_date &&
      formData.start_date &&
      formData.end_date.isBefore(formData.start_date)
    ) {
      errors.end_date = 'End date must be after start date';
    }

    // Rotation interval validation
    if (formData.rotation_interval_hours < 1) {
      errors.rotation_interval_hours =
        'Rotation interval must be at least 1 hour';
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
      const updateData = {
        name: formData.name,
        description: formData.description,
        is_active: formData.is_active,
        members: formData.participants, // Save participants to members field
        rotation_config: {
          rotation_type: formData.rotation_type,
          rotation_interval_hours: formData.rotation_interval_hours,
          rotation_day: formData.rotation_day,
          rotation_time: formData.rotation_time
            ? {
                hour: formData.rotation_time.hour(),
                minute: formData.rotation_time.minute(),
              }
            : { hour: 9, minute: 0 },
          timezone: formData.timezone,
          start_date: formData.start_date.toISOString(),
          end_date: formData.end_date ? formData.end_date.toISOString() : null,
        },
      };

      const response = await fetch(`/api/on-call-schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update schedule');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/on-call');
      }, 1000);
    } catch (err) {
      console.error('Error updating schedule:', err);
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

    // Clear error for this field
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const handleAddParticipant = () => {
    if (
      selectedMember &&
      !formData.participants.find(p => p.id === selectedMember.id)
    ) {
      setFormData(prev => ({
        ...prev,
        participants: [...prev.participants, selectedMember],
      }));
      setSelectedMember(null);
    }
  };

  const handleRemoveParticipant = participantId => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.filter(p => p.id !== participantId),
    }));
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
      ) : (
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
              Edit On-Call Schedule
            </Typography>
          </Box>

          {/* Alerts */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Schedule updated successfully! Redirecting...
            </Alert>
          )}

          {/* Form */}
          <Card>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <Grid container spacing={3}>
                  {/* Basic Information */}
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom>
                      Basic Information
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Schedule Name"
                      value={formData.name}
                      onChange={e => handleInputChange('name', e.target.value)}
                      error={!!formErrors.name}
                      helperText={formErrors.name}
                      required
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.is_active}
                          onChange={e =>
                            handleInputChange('is_active', e.target.checked)
                          }
                          color="primary"
                        />
                      }
                      label="Active"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Description"
                      value={formData.description}
                      onChange={e =>
                        handleInputChange('description', e.target.value)
                      }
                      multiline
                      rows={3}
                    />
                  </Grid>

                  {/* Rotation Settings */}
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom>
                      Rotation Settings
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Rotation Type</InputLabel>
                      <Select
                        value={formData.rotation_type}
                        onChange={e =>
                          handleInputChange('rotation_type', e.target.value)
                        }
                        label="Rotation Type"
                      >
                        <MenuItem value="daily">Daily</MenuItem>
                        <MenuItem value="weekly">Weekly</MenuItem>
                        <MenuItem value="biweekly">Bi-weekly</MenuItem>
                        <MenuItem value="monthly">Monthly</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Rotation Interval (hours)"
                      type="number"
                      value={formData.rotation_interval_hours}
                      onChange={e =>
                        handleInputChange(
                          'rotation_interval_hours',
                          parseInt(e.target.value) || 0
                        )
                      }
                      error={!!formErrors.rotation_interval_hours}
                      helperText={formErrors.rotation_interval_hours}
                      inputProps={{ min: 1 }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <DateTimePicker
                      label="Start Date"
                      value={formData.start_date}
                      onChange={value => handleInputChange('start_date', value)}
                      renderInput={params => (
                        <TextField
                          {...params}
                          fullWidth
                          error={!!formErrors.start_date}
                          helperText={formErrors.start_date}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <DateTimePicker
                      label="End Date (Optional)"
                      value={formData.end_date}
                      onChange={value => handleInputChange('end_date', value)}
                      renderInput={params => (
                        <TextField
                          {...params}
                          fullWidth
                          error={!!formErrors.end_date}
                          helperText={formErrors.end_date}
                        />
                      )}
                    />
                  </Grid>

                  {/* Participants */}
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom>
                      Participants
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={8}>
                    <Autocomplete
                      options={organizationMembers}
                      getOptionLabel={option =>
                        `${option.name || option.email} (${option.email})`
                      }
                      value={selectedMember}
                      onChange={(event, newValue) =>
                        setSelectedMember(newValue)
                      }
                      renderInput={params => (
                        <TextField
                          {...params}
                          label="Add Team Member"
                          placeholder="Select a team member to add to rotation"
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={handleAddParticipant}
                      disabled={!selectedMember}
                      startIcon={<AddIcon />}
                      sx={{ height: '56px' }}
                    >
                      Add Member
                    </Button>
                  </Grid>

                  {formData.participants.length > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle1" gutterBottom>
                        Rotation Order ({formData.participants.length} members)
                      </Typography>
                      <List>
                        {formData.participants.map((participant, index) => (
                          <ListItem key={participant.id} divider>
                            <ListItemText
                              primary={
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Chip
                                    label={index + 1}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                  />
                                  <PersonIcon color="action" />
                                  {participant.name || participant.email}
                                </Box>
                              }
                              secondary={participant.email}
                            />
                            <ListItemSecondaryAction>
                              <IconButton
                                edge="end"
                                onClick={() =>
                                  handleRemoveParticipant(participant.id)
                                }
                                color="error"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </ListItemSecondaryAction>
                          </ListItem>
                        ))}
                      </List>
                    </Grid>
                  )}

                  {/* Actions */}
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Box display="flex" gap={2} justifyContent="flex-end">
                      <Button
                        component={Link}
                        href="/on-call"
                        variant="outlined"
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={saving}
                        startIcon={
                          saving ? <CircularProgress size={20} /> : <SaveIcon />
                        }
                      >
                        {saving ? 'Updating...' : 'Update Schedule'}
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
