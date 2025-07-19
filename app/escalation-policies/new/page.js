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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Switch,
  Chip,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function CreateEscalationPolicyPage() {
  const router = useRouter();
  const { session, selectedOrganization } = useOrganization();

  const [formData, setFormData] = useState({
    organization_id: '',
    name: '',
    description: '',
    is_active: true,
    notification_rules: [
      {
        delay_minutes: 0,
        notification_type: 'email',
        target_type: 'user',
        target_id: '',
        escalation_level: 1,
      },
    ],
  });

  const [organizationMembers, setOrganizationMembers] = useState([]);
  const [onCallSchedules, setOnCallSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (session && selectedOrganization?.id) {
      // Use the selected organization from navbar
      setFormData(prev => ({
        ...prev,
        organization_id: selectedOrganization.id,
      }));
      fetchOrganizationMembers(selectedOrganization.id);
      fetchOnCallSchedules(selectedOrganization.id);
    }
  }, [session, selectedOrganization]);

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

  const fetchOnCallSchedules = async orgId => {
    try {
      const response = await fetch(
        `/api/on-call-schedules?organization_id=${orgId}`
      );
      if (response.ok) {
        const data = await response.json();
        setOnCallSchedules(data.schedules || []);
      }
    } catch (err) {
      console.error('Error fetching on-call schedules:', err);
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) errors.name = 'Policy name is required';

    // Validate notification rules
    formData.notification_rules.forEach((rule, index) => {
      if (!rule.target_id) {
        errors[`rule_${index}_target`] =
          'Target is required for each notification rule';
      }
      if (rule.delay_minutes < 0) {
        errors[`rule_${index}_delay`] = 'Delay cannot be negative';
      }
    });

    // Check for duplicate escalation levels
    const levels = formData.notification_rules.map(
      rule => rule.escalation_level
    );
    const uniqueLevels = [...new Set(levels)];
    if (levels.length !== uniqueLevels.length) {
      errors.escalation_levels = 'Each escalation level must be unique';
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

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/escalation-policies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || 'Failed to create escalation policy'
        );
      }

      const data = await response.json();
      setSuccess(true);

      // Redirect to incidents page after a short delay
      setTimeout(() => {
        router.push('/incidents');
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

    // Clear field error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const handleRuleChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      notification_rules: prev.notification_rules.map((rule, i) =>
        i === index ? { ...rule, [field]: value } : rule
      ),
    }));

    // Clear related errors
    const errorKey = `rule_${index}_${field}`;
    if (formErrors[errorKey]) {
      setFormErrors(prev => ({
        ...prev,
        [errorKey]: '',
      }));
    }
  };

  const addNotificationRule = () => {
    const newLevel =
      Math.max(...formData.notification_rules.map(r => r.escalation_level), 0) +
      1;
    setFormData(prev => ({
      ...prev,
      notification_rules: [
        ...prev.notification_rules,
        {
          delay_minutes: newLevel * 15, // Default to 15 minute increments
          notification_type: 'email',
          target_type: 'user',
          target_id: '',
          escalation_level: newLevel,
        },
      ],
    }));
  };

  const removeNotificationRule = index => {
    if (formData.notification_rules.length > 1) {
      setFormData(prev => ({
        ...prev,
        notification_rules: prev.notification_rules.filter(
          (_, i) => i !== index
        ),
      }));
    }
  };

  const getNotificationTypeDescription = type => {
    switch (type) {
      case 'email':
        return 'Send email notification';
      case 'sms':
        return 'Send SMS text message';
      case 'voice':
        return 'Make voice call';
      case 'slack':
        return 'Send Slack message';
      case 'webhook':
        return 'Send webhook notification';
      default:
        return '';
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
            Please select an organization from the navigation bar to create an
            escalation policy.
          </Alert>
        </Box>
      </ProtectedRoute>
    );
  }

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
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Form */}
        <Card>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                {/* Policy Name */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Policy Name *"
                    value={formData.name}
                    onChange={e => handleInputChange('name', e.target.value)}
                    error={!!formErrors.name}
                    helperText={
                      formErrors.name ||
                      'A descriptive name for this escalation policy'
                    }
                    placeholder="e.g., Critical Incidents Escalation"
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
                    onChange={e =>
                      handleInputChange('description', e.target.value)
                    }
                    helperText="Describe when this escalation policy should be used"
                    placeholder="This policy escalates critical incidents through the engineering team..."
                  />
                </Grid>

                {/* Status */}
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
                    label="Enable this escalation policy"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Typography variant="h6" gutterBottom>
                      Notification Rules
                    </Typography>
                    <Button
                      startIcon={<AddIcon />}
                      onClick={addNotificationRule}
                      variant="outlined"
                      color="primary"
                    >
                      Add Rule
                    </Button>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    Define who gets notified and when during incident escalation
                  </Typography>
                </Grid>

                {/* Error for escalation levels */}
                {formErrors.escalation_levels && (
                  <Grid item xs={12}>
                    <Alert severity="error">
                      {formErrors.escalation_levels}
                    </Alert>
                  </Grid>
                )}

                {/* Notification Rules */}
                {formData.notification_rules.map((rule, index) => (
                  <Grid item xs={12} key={index}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box
                          display="flex"
                          justifyContent="between"
                          alignItems="center"
                          mb={2}
                        >
                          <Typography variant="h6">
                            Escalation Level {rule.escalation_level}
                          </Typography>
                          {formData.notification_rules.length > 1 && (
                            <IconButton
                              onClick={() => removeNotificationRule(index)}
                              color="error"
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          )}
                        </Box>

                        <Grid container spacing={2}>
                          {/* Delay */}
                          <Grid item xs={12} md={3}>
                            <TextField
                              fullWidth
                              type="number"
                              label="Delay (minutes)"
                              value={rule.delay_minutes}
                              onChange={e =>
                                handleRuleChange(
                                  index,
                                  'delay_minutes',
                                  parseInt(e.target.value) || 0
                                )
                              }
                              error={!!formErrors[`rule_${index}_delay`]}
                              helperText={
                                formErrors[`rule_${index}_delay`] ||
                                'Time to wait before triggering'
                              }
                              inputProps={{ min: 0, max: 1440 }}
                            />
                          </Grid>

                          {/* Notification Type */}
                          <Grid item xs={12} md={3}>
                            <FormControl fullWidth>
                              <InputLabel>Notification Type</InputLabel>
                              <Select
                                value={rule.notification_type}
                                label="Notification Type"
                                onChange={e =>
                                  handleRuleChange(
                                    index,
                                    'notification_type',
                                    e.target.value
                                  )
                                }
                              >
                                <MenuItem value="email">Email</MenuItem>
                                <MenuItem value="sms">SMS</MenuItem>
                                <MenuItem value="voice">Voice Call</MenuItem>
                                <MenuItem value="slack">Slack</MenuItem>
                                <MenuItem value="webhook">Webhook</MenuItem>
                              </Select>
                              <FormHelperText>
                                {getNotificationTypeDescription(
                                  rule.notification_type
                                )}
                              </FormHelperText>
                            </FormControl>
                          </Grid>

                          {/* Target Type */}
                          <Grid item xs={12} md={2}>
                            <FormControl fullWidth>
                              <InputLabel>Target Type</InputLabel>
                              <Select
                                value={rule.target_type}
                                label="Target Type"
                                onChange={e =>
                                  handleRuleChange(
                                    index,
                                    'target_type',
                                    e.target.value
                                  )
                                }
                              >
                                <MenuItem value="user">User</MenuItem>
                                <MenuItem value="team">Team</MenuItem>
                                <MenuItem value="on_call">On-Call</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>

                          {/* Target Selection */}
                          <Grid item xs={12} md={4}>
                            <FormControl
                              fullWidth
                              error={!!formErrors[`rule_${index}_target`]}
                            >
                              <InputLabel>Target *</InputLabel>
                              <Select
                                value={rule.target_id}
                                label="Target *"
                                onChange={e =>
                                  handleRuleChange(
                                    index,
                                    'target_id',
                                    e.target.value
                                  )
                                }
                              >
                                {rule.target_type === 'user' &&
                                  organizationMembers.map(member => (
                                    <MenuItem key={member.id} value={member.id}>
                                      {member.name || member.email}
                                    </MenuItem>
                                  ))}
                                {rule.target_type === 'team' && (
                                  <MenuItem value="engineering">
                                    Engineering Team
                                  </MenuItem>
                                )}
                                {rule.target_type === 'on_call' &&
                                  onCallSchedules.map(schedule => (
                                    <MenuItem
                                      key={schedule.id}
                                      value={schedule.id}
                                    >
                                      {schedule.name}
                                    </MenuItem>
                                  ))}
                              </Select>
                              {formErrors[`rule_${index}_target`] && (
                                <FormHelperText>
                                  {formErrors[`rule_${index}_target`]}
                                </FormHelperText>
                              )}
                            </FormControl>
                          </Grid>

                          {/* Rule Summary */}
                          <Grid item xs={12}>
                            <Box
                              sx={{
                                p: 1,
                                backgroundColor: 'grey.50',
                                borderRadius: 1,
                              }}
                            >
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                <strong>Summary:</strong> After{' '}
                                {rule.delay_minutes} minutes, send{' '}
                                {rule.notification_type} to{' '}
                                {rule.target_type === 'user' &&
                                  organizationMembers.find(
                                    m => m.id === rule.target_id
                                  )?.name}
                                {rule.target_type === 'team' &&
                                  'Engineering Team'}
                                {rule.target_type === 'on_call' &&
                                  (onCallSchedules.find(
                                    s => s.id === rule.target_id
                                  )?.name ||
                                    'Selected On-Call Schedule')}
                                {!rule.target_id && 'selected target'}
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}

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
                      color="primary"
                    >
                      {loading ? 'Creating...' : 'Create Policy'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </form>
          </CardContent>
        </Card>
      </Box>
    </ProtectedRoute>
  );
}
