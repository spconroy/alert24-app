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
  Email as EmailIcon,
  Sms as SmsIcon,
  Call as CallIcon,
  Chat as SlackIcon,
} from '@mui/icons-material';
import UserTeamSelector from './UserTeamSelector';

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
    rules: [],
  });


  useEffect(() => {
    console.log('🔄 EscalationPolicyForm useEffect triggered', { escalationPolicy, open });
    if (escalationPolicy) {
      console.log('📝 Setting form data for EDIT mode', escalationPolicy);
      setFormData({
        name: escalationPolicy.name || '',
        description: escalationPolicy.description || '',
        is_active: escalationPolicy.is_active !== false,
        escalation_delay_minutes:
          escalationPolicy.escalation_delay_minutes || 15,
        max_escalation_level: escalationPolicy.max_escalation_level || 3,
        rules: escalationPolicy.rules || [],
      });
    } else {
      console.log('🆕 Setting form data for NEW mode');
      // Reset form for new policy
      setFormData({
        name: '',
        description: '',
        is_active: true,
        escalation_delay_minutes: 15,
        max_escalation_level: 3,
        rules: [],
      });
    }
    setError(null);
    setSuccess(false);
  }, [escalationPolicy, open]);


  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setError(null);
  };

  const addEscalationRule = () => {
    const newRule = {
      level: formData.rules.length + 1,
      delay_minutes: 15,
      notification_channels: ['email'],
      targets: [],
    };

    setFormData(prev => ({
      ...prev,
      rules: [...prev.rules, newRule],
    }));
  };

  const updateEscalationRule = (ruleIndex, field, value) => {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules.map((rule, index) =>
        index === ruleIndex ? { ...rule, [field]: value } : rule
      ),
    }));
  };

  const removeEscalationRule = ruleIndex => {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules
        .filter((_, index) => index !== ruleIndex)
        .map((rule, index) => ({ ...rule, level: index + 1 })),
    }));
  };


  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Policy name is required');
      return false;
    }

    if (formData.rules.length === 0) {
      setError('At least one escalation rule is required');
      return false;
    }

    for (let i = 0; i < formData.rules.length; i++) {
      const rule = formData.rules[i];
      if (!rule.targets || rule.targets.length === 0) {
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


  if (!open) return null;

  console.log('🎨 Rendering EscalationPolicyForm', { 
    escalationPolicy: !!escalationPolicy, 
    rulesCount: formData.rules.length,
    open,
    saving 
  });

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1300
      }}
      onClick={() => console.log('Backdrop clicked')}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '800px',
          width: '90%',
          maxHeight: '90%',
          overflow: 'auto',
          pointerEvents: 'auto'
        }}
        onClick={(e) => {
          e.stopPropagation();
          console.log('Modal content clicked');
        }}
      >
        <div>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              {escalationPolicy
                ? 'Edit Escalation Policy'
                : 'Create Escalation Policy'}
            </Typography>
            <button 
              onClick={() => {
                console.log('Close button clicked');
                onClose();
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '8px'
              }}
            >
              ✕
            </button>
          </Box>

          <div 
            onClick={() => console.log('YELLOW DIV clicked!')}
            style={{ 
              padding: '10px', 
              backgroundColor: 'yellow', 
              marginBottom: '10px',
              cursor: 'pointer'
            }}
          >
            CLICK THIS YELLOW BOX - TESTING CLICKS
          </div>
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

          {/* Test button */}
          <Button 
            onClick={() => console.log('TEST BUTTON CLICKED')}
            variant="contained"
            color="primary"
            sx={{ mb: 2 }}
          >
            TEST BUTTON - CLICK ME
          </Button>

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
                  onClick={(e) => {
                    console.log('Add Level button clicked');
                    addEscalationRule();
                  }}
                  variant="outlined"
                  size="small"
                  sx={{ 
                    pointerEvents: 'auto',
                    zIndex: 1000,
                    position: 'relative'
                  }}
                >
                  Add Level
                </Button>
              </Box>

              {formData.rules.length === 0 ? (
                <Box textAlign="center" py={3}>
                  <Typography variant="body2" color="text.secondary">
                    No escalation rules defined. Add a level to get started.
                  </Typography>
                </Box>
              ) : (
                formData.rules.map((rule, ruleIndex) => (
                  <Card key={`rule-${rule.level}-${ruleIndex}`} variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          Level {rule.level}
                        </Typography>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('NATIVE DELETE BUTTON CLICKED for rule', ruleIndex);
                            removeEscalationRule(ruleIndex);
                          }}
                          style={{ 
                            minWidth: 40, 
                            minHeight: 40,
                            pointerEvents: 'auto',
                            zIndex: 1000,
                            position: 'relative',
                            background: 'red',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          DELETE
                        </button>
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
                        {[
                          { key: 'email', label: 'Email', icon: <EmailIcon fontSize="small" /> },
                          { key: 'sms', label: 'SMS', icon: <SmsIcon fontSize="small" /> },
                          { key: 'call', label: 'Phone Call', icon: <CallIcon fontSize="small" /> },
                          { key: 'slack', label: 'Slack', icon: <SlackIcon fontSize="small" /> }
                        ].map(channel => (
                          <FormControlLabel
                            key={channel.key}
                            control={
                              <Switch
                                checked={rule.notification_channels.includes(
                                  channel.key
                                )}
                                onChange={e => {
                                  const channels = e.target.checked
                                    ? [...rule.notification_channels, channel.key]
                                    : rule.notification_channels.filter(
                                        c => c !== channel.key
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
                              <Box display="flex" alignItems="center" gap={1}>
                                {channel.icon}
                                {channel.label}
                              </Box>
                            }
                            sx={{ display: 'block', mb: 1 }}
                          />
                        ))}
                      </Box>

                      <Typography variant="subtitle2" gutterBottom>
                        Escalation Targets
                      </Typography>
                      <UserTeamSelector
                        organizationId={organizationId}
                        value={rule.targets || []}
                        onChange={(newTargets) => 
                          updateEscalationRule(ruleIndex, 'targets', newTargets)
                        }
                        label="Select users, teams, or on-call schedules to notify"
                        placeholder="Search for users, teams, or on-call schedules to escalate to..."
                        multiple={true}
                        showTeams={true}
                        showUsers={true}
                        showOnCallSchedules={true}
                      />
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
            <button 
              onClick={() => {
                console.log('Cancel button clicked');
                onClose();
              }}
              style={{
                padding: '8px 16px',
                border: '1px solid #ccc',
                background: 'white',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                console.log('Submit button clicked');
                handleSubmit();
              }}
              style={{
                padding: '8px 16px',
                background: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {saving
                ? 'Saving...'
                : escalationPolicy
                  ? 'Update Policy'
                  : 'Create Policy'}
            </button>
          </Box>
        </div>
      </div>
    </div>
  );
}
