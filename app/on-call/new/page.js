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
import { useSession } from 'next-auth/react';
import { useOrganization } from '@/contexts/OrganizationContext';
import dayjs from 'dayjs';

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
  const { data: session } = useSession();
  const { selectedOrganization } = useOrganization();

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

  if (!session) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <Typography>Please sign in to create on-call schedules.</Typography>
      </Box>
    );
  }

  if (success) {
    return (
      <Box sx={{ p: 3 }}>
        <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 600, mx: 'auto' }}>
          <CheckCircleIcon
            sx={{ fontSize: 64, color: 'success.main', mb: 2 }}
          />
          <Typography variant="h5" gutterBottom>
            Schedule Created Successfully!
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={3}>
            Your on-call schedule has been created and is now active.
            Redirecting to the on-call dashboard...
          </Typography>
          <CircularProgress />
        </Paper>
      </Box>
    );
  }

  const renderStepContent = step => {
    switch (step) {
      case 0:
        return (
          <Stack spacing={3}>
            {!selectedOrganization && (
              <Alert severity="warning">
                Please select an organization from the dropdown in the
                navigation bar.
              </Alert>
            )}
            {selectedOrganization && (
              <Alert severity="success" icon={<CheckCircleIcon />}>
                Creating schedule for:{' '}
                <strong>{selectedOrganization.name}</strong>
              </Alert>
            )}

            <TextField
              fullWidth
              label="Schedule Name"
              value={formData.name}
              onChange={e => handleInputChange('name', e.target.value)}
              error={!!formErrors.name}
              helperText={
                formErrors.name ||
                'A descriptive name for this on-call schedule'
              }
              placeholder="e.g., Engineering Team Primary On-Call"
              required
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={formData.description}
              onChange={e => handleInputChange('description', e.target.value)}
              helperText="Describe the purpose and scope of this on-call schedule"
              placeholder="Primary on-call rotation for critical production incidents..."
            />
          </Stack>
        );

      case 1:
        return (
          <Stack spacing={3}>
            <Typography variant="h6" color="primary">
              📅 Schedule Timing
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
                      helperText:
                        formErrors.start_date ||
                        'When this schedule becomes active',
                      required: true,
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="End Date & Time (optional)"
                  value={formData.end_date}
                  onChange={newValue => handleInputChange('end_date', newValue)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!formErrors.end_date,
                      helperText:
                        formErrors.end_date ||
                        'Leave empty for ongoing schedule',
                    },
                  }}
                />
              </Grid>
            </Grid>

            <Divider />

            <Typography variant="h6" color="primary">
              🔄 Rotation Settings
            </Typography>

            <Grid container spacing={3}>
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
                    <MenuItem value="custom">Custom</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {['weekly', 'biweekly'].includes(formData.rotation_type) && (
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
                      {[
                        'Sunday',
                        'Monday',
                        'Tuesday',
                        'Wednesday',
                        'Thursday',
                        'Friday',
                        'Saturday',
                      ].map((day, index) => (
                        <MenuItem key={index} value={index}>
                          {day}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              {formData.rotation_type !== 'custom' && (
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
                        helperText: 'Time of day when rotation occurs',
                      },
                    }}
                  />
                </Grid>
              )}

              {formData.rotation_type === 'custom' && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Rotation Interval (hours)"
                    value={formData.rotation_interval_hours}
                    onChange={e =>
                      handleInputChange(
                        'rotation_interval_hours',
                        parseInt(e.target.value)
                      )
                    }
                    helperText="How often to rotate in hours"
                    inputProps={{ min: 1, max: 8760 }}
                  />
                </Grid>
              )}
            </Grid>

            <Paper
              sx={{
                p: 3,
                bgcolor: 'primary.light',
                color: 'primary.contrastText',
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 'bold', mb: 1 }}
              >
                📋 Rotation Schedule
              </Typography>
              <Typography variant="body2">
                {getRotationDescription()}
              </Typography>
            </Paper>
          </Stack>
        );

      case 2:
        return (
          <Stack spacing={3}>
            <Typography variant="h6" color="primary">
              👥 On-Call Team Members
            </Typography>

            <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
              <Typography
                variant="subtitle1"
                gutterBottom
                sx={{ fontWeight: 'bold' }}
              >
                Add Team Members
              </Typography>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems="flex-end"
              >
                <Autocomplete
                  fullWidth
                  options={organizationMembers.filter(
                    member =>
                      !formData.participants.find(p => p.id === member.id)
                  )}
                  getOptionLabel={option => option.name || option.email}
                  value={selectedMember}
                  onChange={(event, newValue) => setSelectedMember(newValue)}
                  renderInput={params => (
                    <TextField
                      {...params}
                      label="Select Team Member"
                      placeholder="Choose a team member..."
                    />
                  )}
                  renderOption={(props, option) => (
                    <li {...props}>
                      <Avatar sx={{ mr: 2, width: 32, height: 32 }}>
                        {(option.name || option.email).charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body1">
                          {option.name || option.email}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.role === 'owner'
                            ? 'Owner'
                            : option.role === 'admin'
                              ? 'Admin'
                              : 'Member'}
                        </Typography>
                      </Box>
                    </li>
                  )}
                  noOptionsText="No available team members"
                />

                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddParticipant}
                  disabled={!selectedMember}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  Add
                </Button>
              </Stack>
            </Paper>

            {formErrors.participants && (
              <Alert severity="error">{formErrors.participants}</Alert>
            )}

            {formData.participants.length === 0 ? (
              <Paper
                sx={{
                  p: 4,
                  textAlign: 'center',
                  border: '2px dashed',
                  borderColor: 'primary.main',
                }}
              >
                <PersonIcon
                  sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
                />
                <Typography variant="h6" gutterBottom>
                  No Team Members Added
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Add at least one team member to create the on-call rotation.
                </Typography>
              </Paper>
            ) : (
              <Paper sx={{ p: 0, overflow: 'hidden' }}>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    Rotation Order ({formData.participants.length} members)
                  </Typography>
                </Box>

                <List>
                  {formData.participants.map((participant, index) => (
                    <ListItem
                      key={participant.id}
                      divider={index < formData.participants.length - 1}
                    >
                      <ListItemAvatar>
                        <Avatar>
                          {(participant.name || participant.email)
                            .charAt(0)
                            .toUpperCase()}
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
                            <Typography variant="body1">
                              {participant.name || participant.email}
                            </Typography>
                          </Box>
                        }
                        secondary={participant.role || 'Member'}
                      />

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
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>

                {formData.participants.length > 0 && (
                  <Box sx={{ p: 2, bgcolor: 'success.light' }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 'bold', mb: 1 }}
                    >
                      🎯 Rotation Preview
                    </Typography>
                    <Typography variant="body2">
                      <strong>Starting on-call:</strong>{' '}
                      {formData.participants[0]?.name ||
                        formData.participants[0]?.email}
                      <br />
                      <strong>Rotation:</strong> {getRotationDescription()}
                      {formData.participants.length === 1 && (
                        <>
                          <br />
                          <em>
                            ⚠️ Single person schedule - no rotation will occur
                          </em>
                        </>
                      )}
                    </Typography>
                  </Box>
                )}
              </Paper>
            )}
          </Stack>
        );

      case 3:
        return (
          <Stack spacing={3}>
            <Typography variant="h6" color="primary">
              ⚙️ Final Settings
            </Typography>

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
              label="Activate this schedule immediately"
            />

            <TextField
              fullWidth
              label="Timezone"
              value={formData.timezone}
              disabled
              helperText="Schedule timezone (auto-detected)"
            />

            <Divider />

            <Typography variant="h6" color="primary">
              📋 Review Summary
            </Typography>

            <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Schedule Name
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {formData.name || 'Unnamed Schedule'}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Organization
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {selectedOrganization?.name || 'Not selected'}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Rotation Type
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {getRotationDescription()}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Team Members
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {formData.participants.length} members
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Start Date
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {formData.start_date
                      ? formData.start_date.format('MMMM D, YYYY [at] h:mm A')
                      : 'Not set'}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Stack>
        );

      default:
        return null;
    }
  };

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
            Back
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
                      <Typography variant="subtitle2">{step.label}</Typography>
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
                sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}
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
                        loading ? <CircularProgress size={20} /> : <SaveIcon />
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
  );
}
