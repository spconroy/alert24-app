'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Typography,
  Box,
  Alert,
  LinearProgress,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Schedule as ScheduleIcon,
  NotificationsActive as NotificationIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Call as CallIcon,
} from '@mui/icons-material';

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

export default function UserProfileForm({ 
  initialData = {}, 
  onSave, 
  loading = false,
  readOnly = false 
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    notification_preferences: {
      email_incidents: true,
      email_escalations: true,
      sms_critical: false,
      sms_escalations: false,
      call_critical: false,
      call_escalations: false,
    },
    ...initialData,
  });

  const [isEditing, setIsEditing] = useState(!readOnly);
  const [errors, setErrors] = useState({});
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    setFormData(prev => ({ ...prev, ...initialData }));
  }, [initialData]);

  // Calculate profile completion percentage
  const calculateProfileCompletion = () => {
    const fields = [
      { key: 'name', weight: 25 },
      { key: 'email', weight: 25 },
      { key: 'phone', weight: 20 },
      { key: 'timezone', weight: 15 },
      { key: 'notification_preferences', weight: 15 },
    ];

    let totalScore = 0;
    let maxScore = 0;

    fields.forEach(field => {
      maxScore += field.weight;
      
      if (field.key === 'notification_preferences') {
        // Check if at least one notification preference is set
        const prefs = formData.notification_preferences || {};
        const hasAnyPref = Object.values(prefs).some(Boolean);
        if (hasAnyPref) totalScore += field.weight;
      } else if (formData[field.key] && formData[field.key].toString().trim()) {
        totalScore += field.weight;
      }
    });

    return Math.round((totalScore / maxScore) * 100);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email?.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (formData.phone && !validatePhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePhone = phone => {
    if (!phone) return true; // Phone is optional
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  };

  const formatPhoneNumber = phone => {
    if (!phone) return '';
    
    // Remove all non-digits except leading +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // Basic US phone number formatting
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
    }
    
    return phone; // Return as-is if doesn't match expected formats
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleNotificationChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      notification_preferences: {
        ...prev.notification_preferences,
        [field]: value,
      },
    }));
  };

  const handlePhoneChange = (value) => {
    const formatted = formatPhoneNumber(value);
    handleInputChange('phone', formatted);
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaveLoading(true);
    try {
      await onSave?.(formData);
      if (!readOnly) setIsEditing(false);
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setSaveLoading(false);
    }
  };

  const completionPercentage = calculateProfileCompletion();

  return (
    <Box>
      {/* Profile Completion Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6" color="primary">
              Profile Completion
            </Typography>
            <Chip
              icon={<CheckCircleIcon />}
              label={`${completionPercentage}%`}
              color={completionPercentage >= 80 ? 'success' : completionPercentage >= 50 ? 'warning' : 'default'}
              variant={completionPercentage >= 80 ? 'filled' : 'outlined'}
            />
          </Box>
          
          <LinearProgress
            variant="determinate"
            value={completionPercentage}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: 'grey.200',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                backgroundColor: completionPercentage >= 80 ? 'success.main' : 
                                completionPercentage >= 50 ? 'warning.main' : 'primary.main',
              },
            }}
          />
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {completionPercentage < 100 && 'Complete your profile to unlock all features'}
            {completionPercentage === 100 && 'Your profile is complete! 🎉'}
          </Typography>
        </CardContent>
      </Card>

      {/* Main Profile Form */}
      <Card>
        <CardContent>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={3}
          >
            <Typography
              variant="h6"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <PersonIcon color="primary" />
              Profile Information
            </Typography>
            
            {!readOnly && (
              <Button
                startIcon={isEditing ? <SaveIcon /> : <EditIcon />}
                variant={isEditing ? 'contained' : 'outlined'}
                onClick={isEditing ? handleSave : () => setIsEditing(true)}
                disabled={saveLoading || loading}
              >
                {saveLoading ? (
                  <CircularProgress size={20} />
                ) : isEditing ? (
                  'Save Changes'
                ) : (
                  'Edit Profile'
                )}
              </Button>
            )}
          </Box>

          <Grid container spacing={3}>
            {/* Basic Information */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Full Name"
                value={formData.name || ''}
                onChange={e => handleInputChange('name', e.target.value)}
                disabled={!isEditing || loading}
                error={!!errors.name}
                helperText={errors.name}
                required
                InputProps={{
                  startAdornment: (
                    <PersonIcon sx={{ mr: 1, color: 'action.active' }} />
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={formData.email || ''}
                onChange={e => handleInputChange('email', e.target.value)}
                disabled={!isEditing || loading}
                error={!!errors.email}
                helperText={errors.email}
                required
                InputProps={{
                  startAdornment: (
                    <EmailIcon sx={{ mr: 1, color: 'action.active' }} />
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone Number"
                value={formData.phone || ''}
                onChange={e => handlePhoneChange(e.target.value)}
                disabled={!isEditing || loading}
                placeholder="+1 (555) 123-4567"
                error={!!errors.phone}
                helperText={
                  errors.phone || 'For SMS notifications and emergency contact'
                }
                InputProps={{
                  startAdornment: (
                    <PhoneIcon sx={{ mr: 1, color: 'action.active' }} />
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth disabled={!isEditing || loading}>
                <InputLabel>Timezone</InputLabel>
                <Select
                  value={formData.timezone || ''}
                  label="Timezone"
                  onChange={e => handleInputChange('timezone', e.target.value)}
                  startAdornment={
                    <ScheduleIcon sx={{ mr: 1, color: 'action.active' }} />
                  }
                >
                  {TIMEZONES.map(tz => (
                    <MenuItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* Notification Preferences */}
          <Box sx={{ mt: 4 }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <NotificationIcon color="primary" />
              Notification Preferences
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Choose how you want to be notified about incidents and escalations
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.notification_preferences?.email_incidents || false}
                      onChange={e =>
                        handleNotificationChange('email_incidents', e.target.checked)
                      }
                      disabled={!isEditing || loading}
                    />
                  }
                  label="Email - New Incidents"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.notification_preferences?.email_escalations || false}
                      onChange={e =>
                        handleNotificationChange('email_escalations', e.target.checked)
                      }
                      disabled={!isEditing || loading}
                    />
                  }
                  label="Email - Escalations"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.notification_preferences?.sms_critical || false}
                      onChange={e =>
                        handleNotificationChange('sms_critical', e.target.checked)
                      }
                      disabled={!isEditing || loading || !formData.phone}
                    />
                  }
                  label="SMS - Critical Incidents"
                />
                {!formData.phone && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Add phone number to enable SMS notifications
                  </Typography>
                )}
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.notification_preferences?.sms_escalations || false}
                      onChange={e =>
                        handleNotificationChange('sms_escalations', e.target.checked)
                      }
                      disabled={!isEditing || loading || !formData.phone}
                    />
                  }
                  label="SMS - Escalations"
                />
                {!formData.phone && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Add phone number to enable SMS notifications
                  </Typography>
                )}
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.notification_preferences?.call_critical || false}
                      onChange={e =>
                        handleNotificationChange('call_critical', e.target.checked)
                      }
                      disabled={!isEditing || loading || !formData.phone}
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <CallIcon fontSize="small" />
                      Phone Call - Critical Incidents
                    </Box>
                  }
                />
                {!formData.phone && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Add phone number to enable phone call notifications
                  </Typography>
                )}
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.notification_preferences?.call_escalations || false}
                      onChange={e =>
                        handleNotificationChange('call_escalations', e.target.checked)
                      }
                      disabled={!isEditing || loading || !formData.phone}
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <CallIcon fontSize="small" />
                      Phone Call - Escalations
                    </Box>
                  }
                />
                {!formData.phone && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Add phone number to enable phone call notifications
                  </Typography>
                )}
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}