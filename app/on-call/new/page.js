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
  ListItemAvatar,
  Avatar,
  Stack,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Tooltip,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import ScheduleIcon from '@mui/icons-material/Schedule';
import GroupIcon from '@mui/icons-material/Group';
import SettingsIcon from '@mui/icons-material/Settings';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useOrganization } from '@/contexts/OrganizationContext';
import dayjs from 'dayjs';
import ProtectedRoute from '@/components/ProtectedRoute';

const steps = [
  {
    label: 'Basic Information',
    description: 'Schedule name and description',
    icon: <InfoIcon />,
  },
  {
    label: 'Schedule Configuration',
    description: 'When and how often to rotate',
    icon: <ScheduleIcon />,
  },
  {
    label: 'Team Members',
    description: 'Add responders to rotation',
    icon: <GroupIcon />,
  },
  {
    label: 'Settings & Review',
    description: 'Final settings and confirmation',
    icon: <SettingsIcon />,
  },
];

export default function CreateOnCallSchedulePage() {
  const router = useRouter();
  const { selectedOrganization, session } = useOrganization();

  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: dayjs().add(1, 'hour'),
    end_date: null,
    rotation_type: 'weekly',
    rotation_interval_hours: 168, // 1 week
    rotation_day: 1, // Monday (0=Sunday, 1=Monday, etc.)
    rotation_time: dayjs().hour(9).minute(0).second(0), // 9:00 AM
    participants: [],
    is_active: true,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  });

  const [organizationMembers, setOrganizationMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (selectedOrganization?.id) {
      fetchOrganizationMembers(selectedOrganization.id);
    } else {
      setOrganizationMembers([]);
      setFormData(prev => ({ ...prev, participants: [] }));
    }
  }, [selectedOrganization]);

  // Update rotation interval when rotation type changes
  useEffect(() => {
    const intervals = {
      daily: 24,
      weekly: 168,
      biweekly: 336,
      monthly: 720, // ~30 days
    };

    if (intervals[formData.rotation_type]) {
      setFormData(prev => ({
        ...prev,
        rotation_interval_hours: intervals[formData.rotation_type],
      }));
    }
  }, [formData.rotation_type]);

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

  const validateStep = step => {
    const errors = {};

    switch (step) {
      case 0: // Basic Information
        if (!selectedOrganization)
          errors.organization = 'Please select an organization';
        if (!formData.name.trim()) errors.name = 'Schedule name is required';
        break;
      case 1: // Schedule Configuration
        if (!formData.start_date) errors.start_date = 'Start date is required';
        if (formData.start_date && formData.start_date.isBefore(dayjs())) {
          errors.start_date = 'Start date cannot be in the past';
        }
        if (
          formData.end_date &&
          formData.start_date &&
          formData.end_date.isBefore(formData.start_date)
        ) {
          errors.end_date = 'End date must be after start date';
        }
        break;
      case 2: // Team Members
        if (formData.participants.length === 0) {
          errors.participants = 'At least one participant is required';
        }
        break;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prevStep => prevStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prevStep => prevStep - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(2)) {
      // Validate all required fields
      setError('Please complete all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const submitData = {
        organization_id: selectedOrganization.id,
        name: formData.name,
        description: formData.description,
        start_date: formData.start_date.toISOString(),
        end_date: formData.end_date ? formData.end_date.toISOString() : null,
        rotation_type: formData.rotation_type,
        rotation_interval_hours: formData.rotation_interval_hours,
        rotation_day: formData.rotation_day,
        rotation_time: formData.rotation_time
          ? {
              hour: formData.rotation_time.hour(),
              minute: formData.rotation_time.minute(),
            }
          : { hour: 9, minute: 0 },
        participants: formData.participants.map(p => p.id),
        timezone: formData.timezone,
        is_active: formData.is_active,
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

      setSuccess(true);
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

      if (formErrors.participants) {
        setFormErrors(prev => ({ ...prev, participants: '' }));
      }
    }
  };

  const handleRemoveParticipant = memberId => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.filter(p => p.id !== memberId),
    }));
  };

  const getDayName = dayNumber => {
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    return days[dayNumber];
  };

  const getRotationDescription = () => {
    const timeStr = formData.rotation_time
      ? formData.rotation_time.format('h:mm A')
      : '9:00 AM';

    switch (formData.rotation_type) {
      case 'daily':
        return `Every day at ${timeStr}`;
      case 'weekly':
        return `Every ${getDayName(formData.rotation_day)} at ${timeStr}`;
      case 'biweekly':
        return `Every other ${getDayName(formData.rotation_day)} at ${timeStr}`;
      case 'monthly':
        return `Monthly on the same date at ${timeStr}`;
      case 'custom':
        return `Every ${formData.rotation_interval_hours} hours`;
      default:
        return '';
    }
  };

  const renderStepContent = step => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h5" gutterBottom>
              Basic Information
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter the basic details for your on-call schedule
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  label="Schedule Name"
                  fullWidth
                  value={formData.name}
                  onChange={e => handleInputChange('name', e.target.value)}
                  error={!!formErrors.name}
                  helperText={formErrors.name}
                  placeholder="e.g., Production Support Team"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={3}
                  value={formData.description}
                  onChange={e =>
                    handleInputChange('description', e.target.value)
                  }
                  placeholder="Optional description for this schedule"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Timezone"
                  fullWidth
                  value={formData.timezone}
                  onChange={e => handleInputChange('timezone', e.target.value)}
                  placeholder="e.g., America/New_York"
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h5" gutterBottom>
              Schedule Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure when and how often the schedule should rotate
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="Start Date & Time"
                  value={formData.start_date}
                  onChange={newValue =>
                    handleInputChange('start_date', newValue)
                  }
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!formErrors.start_date,
                      helperText: formErrors.start_date,
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="End Date & Time (Optional)"
                  value={formData.end_date}
                  onChange={newValue => handleInputChange('end_date', newValue)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!formErrors.end_date,
                      helperText: formErrors.end_date,
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Rotation Type</InputLabel>
                  <Select
                    value={formData.rotation_type}
                    label="Rotation Type"
                    onChange={e =>
                      handleInputChange('rotation_type', e.target.value)
                    }
                  >
                    <MenuItem value="daily">Daily</MenuItem>
                    <MenuItem value="weekly">Weekly</MenuItem>
                    <MenuItem value="biweekly">Bi-weekly</MenuItem>
                    <MenuItem value="monthly">Monthly</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {formData.rotation_type !== 'daily' && (
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Rotation Day</InputLabel>
                    <Select
                      value={formData.rotation_day}
                      label="Rotation Day"
                      onChange={e =>
                        handleInputChange('rotation_day', e.target.value)
                      }
                    >
                      {[0, 1, 2, 3, 4, 5, 6].map(day => (
                        <MenuItem key={day} value={day}>
                          {getDayName(day)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12} md={6}>
                <TimePicker
                  label="Rotation Time"
                  value={formData.rotation_time}
                  onChange={newValue =>
                    handleInputChange('rotation_time', newValue)
                  }
                  slotProps={{
                    textField: {
                      fullWidth: true,
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>Rotation Schedule:</strong>{' '}
                    {getRotationDescription()}
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h5" gutterBottom>
              Team Members
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Add team members to the on-call rotation
            </Typography>

            {formErrors.participants && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formErrors.participants}
              </Alert>
            )}

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Box display="flex" gap={2} alignItems="flex-end">
                  <Autocomplete
                    options={organizationMembers.filter(
                      member =>
                        !formData.participants.find(p => p.id === member.id)
                    )}
                    getOptionLabel={option =>
                      `${option.name} (${option.email})`
                    }
                    value={selectedMember}
                    onChange={(event, newValue) => setSelectedMember(newValue)}
                    sx={{ flexGrow: 1 }}
                    renderInput={params => (
                      <TextField
                        {...params}
                        label="Add Team Member"
                        placeholder="Search for team members..."
                      />
                    )}
                  />
                  <Button
                    variant="contained"
                    onClick={handleAddParticipant}
                    disabled={!selectedMember}
                    startIcon={<AddIcon />}
                  >
                    Add
                  </Button>
                </Box>
              </Grid>

              {formData.participants.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Rotation Order ({formData.participants.length} members)
                  </Typography>
                  <List>
                    {formData.participants.map((participant, index) => (
                      <ListItem
                        key={participant.id}
                        sx={{
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 1,
                          mb: 1,
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar>
                            <PersonIcon />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Chip
                                label={`#${index + 1}`}
                                size="small"
                                color="primary"
                              />
                              {participant.name}
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
                          >
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Grid>
              )}
            </Grid>
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h5" gutterBottom>
              Settings & Review
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Review your schedule configuration and adjust final settings
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active}
                      onChange={e =>
                        handleInputChange('is_active', e.target.checked)
                      }
                    />
                  }
                  label="Activate schedule immediately"
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Schedule Summary
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Basic Information
                  </Typography>
                  <Typography variant="body2">
                    <strong>Name:</strong> {formData.name}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Description:</strong>{' '}
                    {formData.description || 'None'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Timezone:</strong> {formData.timezone}
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Schedule Configuration
                  </Typography>
                  <Typography variant="body2">
                    <strong>Start:</strong>{' '}
                    {formData.start_date?.format('MMM D, YYYY h:mm A')}
                  </Typography>
                  <Typography variant="body2">
                    <strong>End:</strong>{' '}
                    {formData.end_date?.format('MMM D, YYYY h:mm A') ||
                      'No end date'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Rotation:</strong> {getRotationDescription()}
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Team Members ({formData.participants.length})
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {formData.participants.map((participant, index) => (
                      <Chip
                        key={participant.id}
                        label={`${index + 1}. ${participant.name}`}
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                </Paper>
              </Grid>

              {success && (
                <Grid item xs={12}>
                  <Alert severity="success">
                    On-call schedule created successfully! Redirecting...
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

  return (
    <ProtectedRoute>
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
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Main Content */}
          <Grid container spacing={4}>
            {/* Stepper Sidebar */}
            <Grid item xs={12} md={4} lg={3}>
              <Paper sx={{ p: 3, position: 'sticky', top: 20 }}>
                <Stepper activeStep={activeStep} orientation="vertical">
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
                        <Typography variant="subtitle2">
                          {step.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {step.description}
                        </Typography>
                      </StepLabel>
                    </Step>
                  ))}
                </Stepper>
              </Paper>
            </Grid>

            {/* Form Content */}
            <Grid item xs={12} md={8} lg={9}>
              <Paper sx={{ p: 4 }}>
                {renderStepContent(activeStep)}

                {/* Navigation Buttons */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    mt: 4,
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
                      href="/on-call"
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
                          loading ? (
                            <CircularProgress size={20} />
                          ) : (
                            <SaveIcon />
                          )
                        }
                      >
                        {loading ? 'Creating...' : 'Create Schedule'}
                      </Button>
                    ) : (
                      <Button variant="contained" onClick={handleNext}>
                        Next
                      </Button>
                    )}
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </LocalizationProvider>
    </ProtectedRoute>
  );
}
