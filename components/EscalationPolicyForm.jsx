'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Divider,
  Switch,
  FormControlLabel,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Notifications as NotificationsIcon,
  Save as SaveIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

export default function EscalationPolicyForm({
  open,
  onClose,
  escalationPolicy = null,
  organizationId,
  onPolicySaved,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    escalation_delay_minutes: 15,
    max_escalation_level: 3,
    escalation_rules: [],
  });

  // Available team members for escalation
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    if (organizationId) {
      fetchTeamMembers();
    }
  }, [organizationId]);

  useEffect(() => {
    if (escalationPolicy) {
      setFormData({
        name: escalationPolicy.name || '',
        description: escalationPolicy.description || '',
        is_active: escalationPolicy.is_active !== false,
        escalation_delay_minutes:
          escalationPolicy.escalation_delay_minutes || 15,
        max_escalation_level: escalationPolicy.max_escalation_level || 3,
        escalation_rules: escalationPolicy.escalation_rules || [],
      });
    } else {
      // Reset form for new policy
      setFormData({
        name: '',
        description: '',
        is_active: true,
        escalation_delay_minutes: 15,
        max_escalation_level: 3,
        escalation_rules: [],
      });
    }
    setError(null);
    setSuccess(false);
  }, [escalationPolicy, open]);

  const fetchTeamMembers = async () => {
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/members`
      );
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.members || []);
      }
    } catch (err) {
      console.error('Error fetching team members:', err);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setError(null);
  };

  const addEscalationRule = () => {
    const newRule = {
      level: formData.escalation_rules.length + 1,
      delay_minutes: 15,
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
  };

  const removeEscalationRule = ruleIndex => {
    setFormData(prev => ({
      ...prev,
      escalation_rules: prev.escalation_rules
        .filter((_, index) => index !== ruleIndex)
        .map((rule, index) => ({ ...rule, level: index + 1 })),
    }));
  };

  const addTargetToRule = (ruleIndex, target) => {
    if (!target) return;

    setFormData(prev => ({
      ...prev,
      escalation_rules: prev.escalation_rules.map((rule, index) =>
        index === ruleIndex
          ? {
              ...rule,
              targets: rule.targets.includes(target)
                ? rule.targets
                : [...rule.targets, target],
            }
          : rule
      ),
    }));
  };

  const removeTargetFromRule = (ruleIndex, target) => {
    setFormData(prev => ({
      ...prev,
      escalation_rules: prev.escalation_rules.map((rule, index) =>
        index === ruleIndex
          ? {
              ...rule,
              targets: rule.targets.filter(t => t !== target),
            }
          : rule
      ),
    }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Policy name is required');
      return false;
    }

    if (formData.escalation_rules.length === 0) {
      setError('At least one escalation rule is required');
      return false;
    }

    for (let i = 0; i < formData.escalation_rules.length; i++) {
      const rule = formData.escalation_rules[i];
      if (rule.targets.length === 0) {
        setError(
          `Escalation level ${rule.level} must have at least one target`
        );
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      setError(null);

      const submitData = {
        ...formData,
        organization_id: organizationId,
      };

      const method = escalationPolicy ? 'PUT' : 'POST';
      const url = escalationPolicy
        ? `/api/escalation-policies/${escalationPolicy.id}`
        : '/api/escalation-policies';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(true);

        if (onPolicySaved) {
          onPolicySaved(data.escalation_policy);
        }

        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save escalation policy');
      }
    } catch (err) {
      console.error('Error saving escalation policy:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getTeamMemberName = userId => {
    const member = teamMembers.find(
      m => m.user_id === userId || m.id === userId
    );
    return member?.users?.name || member?.name || userId;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {escalationPolicy
              ? 'Edit Escalation Policy'
              : 'Create Escalation Policy'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              Escalation policy saved successfully!
            </Alert>
          )}

          {/* Basic Information */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>

              <TextField
                label="Policy Name"
                fullWidth
                value={formData.name}
                onChange={e => handleInputChange('name', e.target.value)}
                sx={{ mb: 2 }}
                required
              />

              <TextField
                label="Description"
                fullWidth
                multiline
                rows={2}
                value={formData.description}
                onChange={e => handleInputChange('description', e.target.value)}
                sx={{ mb: 2 }}
              />

              <Box display="flex" gap={2} mb={2}>
                <TextField
                  label="Default Delay (minutes)"
                  type="number"
                  value={formData.escalation_delay_minutes}
                  onChange={e =>
                    handleInputChange(
                      'escalation_delay_minutes',
                      parseInt(e.target.value) || 15
                    )
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <ScheduleIcon />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ flex: 1 }}
                />

                <TextField
                  label="Max Escalation Level"
                  type="number"
                  value={formData.max_escalation_level}
                  onChange={e =>
                    handleInputChange(
                      'max_escalation_level',
                      parseInt(e.target.value) || 3
                    )
                  }
                  sx={{ flex: 1 }}
                />
              </Box>

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={e =>
                      handleInputChange('is_active', e.target.checked)
                    }
                  />
                }
                label="Active Policy"
              />
            </CardContent>
          </Card>

          {/* Escalation Rules */}
          <Card>
            <CardContent>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={2}
              >
                <Typography variant="h6">Escalation Rules</Typography>
                <Button
                  startIcon={<AddIcon />}
                  onClick={addEscalationRule}
                  variant="outlined"
                  size="small"
                >
                  Add Level
                </Button>
              </Box>

              {formData.escalation_rules.length === 0 ? (
                <Box textAlign="center" py={3}>
                  <Typography variant="body2" color="text.secondary">
                    No escalation rules defined. Add a level to get started.
                  </Typography>
                </Box>
              ) : (
                formData.escalation_rules.map((rule, ruleIndex) => (
                  <Card key={ruleIndex} variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        mb={2}
                      >
                        <Typography variant="subtitle1" fontWeight="bold">
                          Level {rule.level}
                        </Typography>
                        <IconButton
                          onClick={() => removeEscalationRule(ruleIndex)}
                          size="small"
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>

                      <TextField
                        label="Delay (minutes)"
                        type="number"
                        value={rule.delay_minutes}
                        onChange={e =>
                          updateEscalationRule(
                            ruleIndex,
                            'delay_minutes',
                            parseInt(e.target.value) || 15
                          )
                        }
                        size="small"
                        sx={{ mb: 2, width: 150 }}
                      />

                      <Typography variant="subtitle2" gutterBottom>
                        Notification Channels
                      </Typography>
                      <Box mb={2}>
                        {['email', 'sms', 'voice', 'slack'].map(channel => (
                          <FormControlLabel
                            key={channel}
                            control={
                              <Switch
                                checked={rule.notification_channels.includes(
                                  channel
                                )}
                                onChange={e => {
                                  const channels = e.target.checked
                                    ? [...rule.notification_channels, channel]
                                    : rule.notification_channels.filter(
                                        c => c !== channel
                                      );
                                  updateEscalationRule(
                                    ruleIndex,
                                    'notification_channels',
                                    channels
                                  );
                                }}
                                size="small"
                              />
                            }
                            label={
                              channel.charAt(0).toUpperCase() + channel.slice(1)
                            }
                          />
                        ))}
                      </Box>

                      <Typography variant="subtitle2" gutterBottom>
                        Escalation Targets
                      </Typography>
                      <Box mb={2}>
                        <FormControl size="small" sx={{ minWidth: 200, mr: 1 }}>
                          <InputLabel>Add Team Member</InputLabel>
                          <Select
                            value=""
                            label="Add Team Member"
                            onChange={e =>
                              addTargetToRule(ruleIndex, e.target.value)
                            }
                          >
                            {teamMembers
                              .filter(
                                member =>
                                  !rule.targets.includes(
                                    member.user_id || member.id
                                  )
                              )
                              .map(member => (
                                <MenuItem
                                  key={member.user_id || member.id}
                                  value={member.user_id || member.id}
                                >
                                  {member.users?.name || member.name}
                                </MenuItem>
                              ))}
                          </Select>
                        </FormControl>
                      </Box>

                      <Box display="flex" flexWrap="wrap" gap={1}>
                        {rule.targets.map(target => (
                          <Chip
                            key={target}
                            label={getTeamMemberName(target)}
                            onDelete={() =>
                              removeTargetFromRule(ruleIndex, target)
                            }
                            icon={<PersonIcon />}
                            size="small"
                          />
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
        >
          {saving
            ? 'Saving...'
            : escalationPolicy
              ? 'Update Policy'
              : 'Create Policy'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
