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

const steps = [
  {
    label: 'Basic Information',
    description: 'Policy name and settings',
    icon: <InfoIcon />,
  },
  {
    label: 'Escalation Rules',
    description: 'Define notification levels',
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
    escalation_delay_minutes: 15,
    max_escalation_level: 3,
    escalation_rules: [
      {
        level: 1,
        delay_minutes: 0,
        notification_channels: ['email'],
        targets: [],
      },
    ],
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
        if (formData.escalation_delay_minutes < 1) {
          errors.escalation_delay_minutes = 'Delay must be at least 1 minute';
        }
        if (formData.max_escalation_level < 1 || formData.max_escalation_level > 10) {
          errors.max_escalation_level = 'Max level must be between 1 and 10';
        }
        break;

      case 1: // Escalation Rules
        formData.escalation_rules.forEach((rule, index) => {
          if (!rule.targets || rule.targets.length === 0) {
            errors[`rule_${index}_targets`] = `Level ${rule.level} must have at least one target`;
          }
          if (rule.notification_channels.length === 0) {
            errors[`rule_${index}_channels`] = `Level ${rule.level} must have at least one notification channel`;
          }
          if (rule.delay_minutes < 0) {
            errors[`rule_${index}_delay`] = 'Delay cannot be negative';
          }
        });
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

  const addEscalationRule = () => {
    const newLevel = formData.escalation_rules.length + 1;
    const newRule = {
      level: newLevel,
      delay_minutes: newLevel === 1 ? 0 : (newLevel - 1) * formData.escalation_delay_minutes,
      notification_channels: ['email'],
      targets: [],
    };

    setFormData(prev => ({
      ...prev,
      escalation_rules: [...prev.escalation_rules, newRule],
    }));
  };

  const updateEscalationRule = (ruleIndex, field, value) => {
    setFormData(prev => ({
      ...prev,
      escalation_rules: prev.escalation_rules.map((rule, index) =>
        index === ruleIndex ? { ...rule, [field]: value } : rule
      ),
    }));

    const errorKey = `rule_${ruleIndex}_${field.replace('notification_channels', 'channels').replace('targets', 'targets')}`;
    if (formErrors[errorKey]) {
      setFormErrors(prev => ({
        ...prev,
        [errorKey]: '',
      }));
    }
  };

  const removeEscalationRule = (ruleIndex) => {
    if (formData.escalation_rules.length > 1) {
      setFormData(prev => ({
        ...prev,
        escalation_rules: prev.escalation_rules
          .filter((_, index) => index !== ruleIndex)
          .map((rule, index) => ({ ...rule, level: index + 1 })),
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

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Default Escalation Delay (minutes)"
                  value={formData.escalation_delay_minutes}
                  onChange={(e) => handleInputChange('escalation_delay_minutes', parseInt(e.target.value) || 15)}
                  error={!!formErrors.escalation_delay_minutes}
                  helperText={formErrors.escalation_delay_minutes || 'Time between escalation levels'}
                  inputProps={{ min: 1, max: 1440 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Maximum Escalation Level"
                  value={formData.max_escalation_level}
                  onChange={(e) => handleInputChange('max_escalation_level', parseInt(e.target.value) || 3)}
                  error={!!formErrors.max_escalation_level}
                  helperText={formErrors.max_escalation_level || 'Maximum number of escalation levels'}
                  inputProps={{ min: 1, max: 10 }}
                />
              </Grid>
            </Grid>

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
          <Stack spacing={3}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">
                Escalation Rules ({formData.escalation_rules.length})
              </Typography>
              <Button
                startIcon={<AddIcon />}
                onClick={addEscalationRule}
                variant="outlined"
                disabled={formData.escalation_rules.length >= formData.max_escalation_level}
              >
                Add Level
              </Button>
            </Box>

            {formData.escalation_rules.map((rule, index) => (
              <Card key={index} variant="outlined">
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6" color="primary">
                      Level {rule.level}
                    </Typography>
                    {formData.escalation_rules.length > 1 && (
                      <IconButton
                        onClick={() => removeEscalationRule(index)}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Delay (minutes)"
                        value={rule.delay_minutes}
                        onChange={(e) => updateEscalationRule(index, 'delay_minutes', parseInt(e.target.value) || 0)}
                        error={!!formErrors[`rule_${index}_delay`]}
                        helperText={formErrors[`rule_${index}_delay`] || (index === 0 ? 'Immediate notification' : 'Time to wait before this level')}
                        inputProps={{ min: 0, max: 1440 }}
                      />
                    </Grid>

                    <Grid item xs={12} md={8}>
                      <FormControl 
                        fullWidth 
                        error={!!formErrors[`rule_${index}_channels`]}
                      >
                        <InputLabel>Notification Channels *</InputLabel>
                        <Select
                          multiple
                          value={rule.notification_channels}
                          onChange={(e) => updateEscalationRule(index, 'notification_channels', e.target.value)}
                          label="Notification Channels *"
                          renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {selected.map((value) => (
                                <Chip 
                                  key={value} 
                                  label={notificationChannels.find(c => c.value === value)?.label || value}
                                  size="small" 
                                />
                              ))}
                            </Box>
                          )}
                        >
                          {notificationChannels.map((channel) => (
                            <MenuItem key={channel.value} value={channel.value}>
                              <Box>
                                <Typography variant="body2">{channel.label}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {channel.description}
                                </Typography>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                        {formErrors[`rule_${index}_channels`] && (
                          <FormHelperText>{formErrors[`rule_${index}_channels`]}</FormHelperText>
                        )}
                      </FormControl>
                    </Grid>

                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>
                        Escalation Targets *
                      </Typography>
                      <UserTeamSelector
                        organizationId={selectedOrganization.id}
                        value={rule.targets || []}
                        onChange={(newTargets) => updateEscalationRule(index, 'targets', newTargets)}
                        label="Select users, teams, or on-call schedules"
                        placeholder="Search for users, teams, or on-call schedules..."
                        multiple={true}
                        showTeams={true}
                        showUsers={true}
                        showOnCallSchedules={true}
                      />
                      {formErrors[`rule_${index}_targets`] && (
                        <FormHelperText error sx={{ mt: 1 }}>
                          {formErrors[`rule_${index}_targets`]}
                        </FormHelperText>
                      )}
                    </Grid>
                  </Grid>

                  {/* Rule Summary */}
                  <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Summary:</strong> {rule.delay_minutes === 0 ? 'Immediately' : `After ${rule.delay_minutes} minutes`}, 
                      notify {rule.targets?.length || 0} target{(rule.targets?.length || 0) !== 1 ? 's' : ''} via{' '}
                      {rule.notification_channels.length === 0 ? 'no channels selected' : 
                       rule.notification_channels.map(ch => notificationChannels.find(c => c.value === ch)?.label || ch).join(', ')}
                    </Typography>
                  </Paper>
                </CardContent>
              </Card>
            ))}
          </Stack>
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
                <Typography variant="h6" gutterBottom>Escalation Rules</Typography>
                <List>
                  {formData.escalation_rules.map((rule, index) => (
                    <ListItem key={index}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {rule.level}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={`Level ${rule.level} - ${rule.delay_minutes === 0 ? 'Immediate' : `${rule.delay_minutes} minutes`}`}
                        secondary={
                          <Box>
                            <Typography variant="body2" component="span">
                              Channels: {rule.notification_channels.join(', ')}
                            </Typography>
                            <br />
                            <Typography variant="body2" component="span">
                              Targets: {rule.targets?.length || 0} selected
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
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