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
  Avatar,
  Paper,
  Tooltip,
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
import ScheduleIcon from '@mui/icons-material/Schedule';
import GroupIcon from '@mui/icons-material/Group';
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
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Basic Information Card */}
              <Grid size={{ xs: 12 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                      <PersonIcon color="primary" />
                      Basic Information
                    </Typography>
                    
                    <Grid container spacing={3}>
                      <Grid size={{ xs: 12, md: 8 }}>
                        <TextField
                          fullWidth
                          label="Schedule Name"
                          value={formData.name}
                          onChange={e => handleInputChange('name', e.target.value)}
                          error={!!formErrors.name}
                          helperText={formErrors.name}
                          required
                          variant="outlined"
                        />
                      </Grid>

                      <Grid size={{ xs: 12, md: 4 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', height: '56px' }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={formData.is_active}
                                onChange={e =>
                                  handleInputChange('is_active', e.target.checked)
                                }
                                color="primary"
                                size="medium"
                              />
                            }
                            label="Schedule Active"
                            sx={{ ml: 1 }}
                          />
                        </Box>
                      </Grid>

                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth
                          label="Description"
                          value={formData.description}
                          onChange={e =>
                            handleInputChange('description', e.target.value)
                          }
                          multiline
                          rows={3}
                          variant="outlined"
                          placeholder="Add a description for this on-call schedule..."
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Schedule Configuration Card */}
              <Grid size={{ xs: 12 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                      <ScheduleIcon color="primary" />
                      Schedule Configuration
                    </Typography>
                    
                    <Grid container spacing={3}>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <FormControl fullWidth variant="outlined">
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

                      <Grid size={{ xs: 12, md: 6 }}>
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
                          helperText={formErrors.rotation_interval_hours || 'How many hours between rotations'}
                          inputProps={{ min: 1 }}
                          variant="outlined"
                        />
                      </Grid>

                      <Grid size={{ xs: 12 }}>
                        <Typography variant="subtitle1" gutterBottom sx={{ mt: 2, mb: 2, fontWeight: 600 }}>
                          Schedule Timeline
                        </Typography>
                      </Grid>

                      <Grid size={{ xs: 12, md: 6 }}>
                        <DateTimePicker
                          label="Start Date & Time"
                          value={formData.start_date}
                          onChange={value => handleInputChange('start_date', value)}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              variant: 'outlined',
                              error: !!formErrors.start_date,
                              helperText: formErrors.start_date || 'When the schedule begins',
                            }
                          }}
                        />
                      </Grid>

                      <Grid size={{ xs: 12, md: 6 }}>
                        <DateTimePicker
                          label="End Date & Time (Optional)"
                          value={formData.end_date}
                          onChange={value => handleInputChange('end_date', value)}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              variant: 'outlined',
                              error: !!formErrors.end_date,
                              helperText: formErrors.end_date || 'Leave empty for ongoing schedule',
                            }
                          }}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Team Members Card */}
              <Grid size={{ xs: 12 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                      <GroupIcon color="primary" />
                      Team Members
                      {formData.participants.length > 0 && (
                        <Chip
                          label={`${formData.participants.length} member${formData.participants.length !== 1 ? 's' : ''}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                    </Typography>
                    
                    <Grid container spacing={3}>
                      <Grid size={{ xs: 12, md: 8 }}>
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
                              placeholder="Search and select a team member..."
                              variant="outlined"
                            />
                          )}
                          noOptionsText="No team members found"
                        />
                      </Grid>

                      <Grid size={{ xs: 12, md: 4 }}>
                        <Button
                          fullWidth
                          variant="contained"
                          onClick={handleAddParticipant}
                          disabled={!selectedMember}
                          startIcon={<AddIcon />}
                          sx={{ height: '56px' }}
                        >
                          Add to Rotation
                        </Button>
                      </Grid>

                      {formData.participants.length > 0 && (
                        <Grid size={{ xs: 12 }}>
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                              Rotation Order
                            </Typography>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Members will be on-call in the order shown below. Drag to reorder.
                            </Typography>
                            <Paper variant="outlined" sx={{ mt: 2 }}>
                              <List disablePadding>
                                {formData.participants.map((participant, index) => (
                                  <ListItem 
                                    key={participant.id} 
                                    divider={index < formData.participants.length - 1}
                                    sx={{ py: 2 }}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                                      <Chip
                                        label={index + 1}
                                        size="small"
                                        color="primary"
                                        sx={{ minWidth: '32px' }}
                                      />
                                      <Avatar sx={{ width: 40, height: 40 }}>
                                        {(participant.name || participant.email || '?').charAt(0).toUpperCase()}
                                      </Avatar>
                                      <Box>
                                        <Typography variant="body1" fontWeight="medium">
                                          {participant.name || participant.email || 'Unknown User'}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                          {participant.email}
                                        </Typography>
                                      </Box>
                                    </Box>
                                    <ListItemSecondaryAction>
                                      <Tooltip title="Remove from rotation">
                                        <IconButton
                                          edge="end"
                                          onClick={() =>
                                            handleRemoveParticipant(participant.id)
                                          }
                                          color="error"
                                          size="small"
                                        >
                                          <ClearIcon />
                                        </IconButton>
                                      </Tooltip>
                                    </ListItemSecondaryAction>
                                  </ListItem>
                                ))}
                              </List>
                            </Paper>
                          </Box>
                        </Grid>
                      )}

                      {formData.participants.length === 0 && (
                        <Grid size={{ xs: 12 }}>
                          <Paper 
                            variant="outlined" 
                            sx={{ 
                              p: 4, 
                              textAlign: 'center',
                              backgroundColor: 'grey.50',
                              borderStyle: 'dashed'
                            }}
                          >
                            <PersonIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                              No team members added
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Add team members to create the on-call rotation order.
                            </Typography>
                          </Paper>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Actions */}
              <Grid size={{ xs: 12 }}>
                <Card>
                  <CardContent>
                    <Box display="flex" gap={2} justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">
                        {formData.participants.length > 0 
                          ? `Schedule configured with ${formData.participants.length} team member${formData.participants.length !== 1 ? 's' : ''}`
                          : 'Add team members to complete the schedule setup'
                        }
                      </Typography>
                      <Box display="flex" gap={2}>
                        <Button
                          component={Link}
                          href="/on-call"
                          variant="outlined"
                          disabled={saving}
                          size="large"
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
                          size="large"
                        >
                          {saving ? 'Updating...' : 'Update Schedule'}
                        </Button>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </form>
        </Box>
      )}
    </ProtectedRoute>
  );
}
