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
  Paper,
  Stepper,
  Step,
  StepLabel,
  Stack,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemAvatar,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import ScheduleIcon from '@mui/icons-material/Schedule';
import NotificationsIcon from '@mui/icons-material/Notifications';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useOrganization } from '@/contexts/OrganizationContext';
import UserTeamSelector from '@/components/UserTeamSelector';
import EscalationStepsOrchestrator from '@/components/EscalationStepsOrchestrator';

const steps = [
  {
    label: 'Basic Information',
    description: 'Policy name and settings',
    icon: <InfoIcon />,
  },
  {
    label: 'Escalation Steps',
    description: 'Configure escalation flow',
    icon: <NotificationsIcon />,
  },
  {
    label: 'Review & Create',
    description: 'Review and submit policy',
    icon: <CheckCircleIcon />,
  },
];

const notificationChannels = [
  { value: 'email', label: 'Email', description: 'Send email notification' },
  { value: 'sms', label: 'SMS', description: 'Send text message' },
  { value: 'voice', label: 'Voice Call', description: 'Make phone call' },
  { value: 'slack', label: 'Slack', description: 'Send Slack message' },
];

export default function CreateEscalationPolicyPage() {
  const router = useRouter();
  const { session, selectedOrganization } = useOrganization();

  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    escalation_timeout_minutes: 30,
    escalation_steps: [],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (!selectedOrganization?.id) {
      setError('Please select an organization from the navigation bar');
    } else {
      setError(null);
    }
  }, [selectedOrganization]);

  const validateStep = (step) => {
    const errors = {};

    switch (step) {
      case 0: // Basic Information
        if (!formData.name.trim()) {
          errors.name = 'Policy name is required';
        }
        if (formData.escalation_timeout_minutes < 1) {
          errors.escalation_timeout_minutes = 'Timeout must be at least 1 minute';
        }
        break;

      case 1: // Escalation Steps
        if (!formData.escalation_steps || formData.escalation_steps.length === 0) {
          errors.escalation_steps = 'At least one escalation step is required';
        } else {
          // Validation is handled by the EscalationStepsOrchestrator component
          const hasInvalidSteps = formData.escalation_steps.some(step => 
            !step.targets || step.targets.length === 0 || 
            !step.notification_channels || step.notification_channels.length === 0
          );
          if (hasInvalidSteps) {
            errors.escalation_steps = 'All escalation steps must have targets and notification channels';
          }
        }
        break;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(activeStep)) return;

    setLoading(true);
    setError(null);

    try {
      const submitData = {
        ...formData,
        organization_id: selectedOrganization.id,
      };

      const response = await fetch('/api/escalation-policies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create escalation policy');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/escalation-policies');
      }, 2000);
    } catch (err) {
      console.error('Error creating escalation policy:', err);
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

    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const handleEscalationStepsChange = (steps) => {
    setFormData(prev => ({
      ...prev,
      escalation_steps: steps,
    }));

    // Clear validation errors when steps change
    if (formErrors.escalation_steps) {
      setFormErrors(prev => ({
        ...prev,
        escalation_steps: '',
      }));
    }
  };

  // Show organization selection prompt if no organization is selected
  if (!selectedOrganization?.id) {
    return (
      <ProtectedRoute>
        <Box sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" gap={2} mb={4}>
            <Button
              component={Link}
              href="/escalation-policies"
              startIcon={<ArrowBackIcon />}
              variant="outlined"
            >
              Back to Escalation Policies
            </Button>
            <Typography variant="h4" component="h1">
              Create Escalation Policy
            </Typography>
          </Box>

          <Alert severity="warning">
            Please select an organization from the navigation bar to create an escalation policy.
          </Alert>
        </Box>
      </ProtectedRoute>
    );
  }

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="Policy Name *"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              error={!!formErrors.name}
              helperText={formErrors.name || 'A descriptive name for this escalation policy'}
              placeholder="e.g., Critical Incidents Escalation"
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              helperText="Describe when this escalation policy should be used"
              placeholder="This policy escalates critical incidents through the engineering team..."
            />

            <TextField
              fullWidth
              type="number"
              label="Default Escalation Timeout (minutes)"
              value={formData.escalation_timeout_minutes}
              onChange={(e) => handleInputChange('escalation_timeout_minutes', parseInt(e.target.value) || 30)}
              error={!!formErrors.escalation_timeout_minutes}
              helperText={formErrors.escalation_timeout_minutes || 'Maximum time to wait for acknowledgment before repeating escalation'}
              inputProps={{ min: 1, max: 1440 }}
              sx={{ maxWidth: 400 }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => handleInputChange('is_active', e.target.checked)}
                />
              }
              label="Enable this escalation policy immediately"
            />
          </Stack>
        );

      case 1:
        return (
          <Box>
            <EscalationStepsOrchestrator
              initialSteps={formData.escalation_steps}
              onChange={handleEscalationStepsChange}
              organizationId={selectedOrganization.id}
              maxSteps={10}
            />
            {formErrors.escalation_steps && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {formErrors.escalation_steps}
              </Alert>
            )}
          </Box>
        );

      case 2:
        return (
          <Stack spacing={3}>
            <Typography variant="h6">Review Escalation Policy</Typography>
            
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>Basic Information</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">Policy Name</Typography>
                    <Typography variant="body1">{formData.name}</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">Status</Typography>
                    <Chip 
                      label={formData.is_active ? 'Active' : 'Inactive'} 
                      color={formData.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </Grid>
                  {formData.description && (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">Description</Typography>
                      <Typography variant="body1">{formData.description}</Typography>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>Escalation Steps</Typography>
                {formData.escalation_steps && formData.escalation_steps.length > 0 ? (
                  <List>
                    {formData.escalation_steps.map((step, index) => (
                      <ListItem key={step.id || index}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            {step.level}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={`Step ${step.level} - ${step.delay_minutes === 0 ? 'Immediate' : `${step.delay_minutes} minutes delay`}`}
                          secondary={
                            <Box>
                              <Typography variant="body2" component="span">
                                Channels: {step.notification_channels?.join(', ') || 'None'}
                              </Typography>
                              <br />
                              <Typography variant="body2" component="span">
                                Targets: {step.targets?.length || 0} selected
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No escalation steps configured
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Stack>
        );

      default:
        return 'Unknown step';
    }
  };

  return (
    <ProtectedRoute>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box display="flex" alignItems="center" gap={2} mb={4}>
          <Button
            component={Link}
            href="/escalation-policies"
            startIcon={<ArrowBackIcon />}
            variant="outlined"
          >
            Back to Escalation Policies
          </Button>
          <Box>
            <Typography variant="h4" component="h1">
              Create Escalation Policy
            </Typography>
            <Typography variant="body1" color="text.secondary">
              For organization: <strong>{selectedOrganization.name}</strong>
            </Typography>
          </Box>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Success Alert */}
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Escalation policy created successfully! Redirecting...
          </Alert>
        )}

        {/* Stepper */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel
                  icon={step.icon}
                  optional={
                    <Typography variant="caption">{step.description}</Typography>
                  }
                >
                  {step.label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>

        {/* Step Content */}
        <Card>
          <CardContent sx={{ p: 4 }}>
            {renderStepContent(activeStep)}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            variant="outlined"
          >
            Back
          </Button>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              component={Link}
              href="/escalation-policies"
              variant="outlined"
              disabled={loading}
            >
              Cancel
            </Button>
            
            {activeStep === steps.length - 1 ? (
              <Button
                onClick={handleSubmit}
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Policy'}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                variant="contained"
              >
                Next
              </Button>
            )}
          </Box>
        </Box>
      </Box>
    </ProtectedRoute>
  );
}