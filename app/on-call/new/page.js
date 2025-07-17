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
