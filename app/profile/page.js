'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Avatar,
  Grid,
  Divider,
  Alert,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  NotificationsActive as NotificationIcon,
  Security as SecurityIcon,
  Save as SaveIcon,
  Edit as EditIcon
} from '@mui/icons-material';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    timezone: '',
    notification_preferences: {
      email_incidents: true,
      email_escalations: true,
      sms_critical: false,
      sms_escalations: false
    }
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/api/auth/signin');
      return;
    }
    
    if (session?.user) {
      fetchUserProfile();
    }
  }, [session, status, router]);

  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const data = await response.json();
        setProfileData({
          name: data.name || session.user.name || '',
          email: data.email || session.user.email || '',
          phone: data.phone || '',
          timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          notification_preferences: data.notification_preferences || {
            email_incidents: true,
            email_escalations: true,
            sms_critical: false,
            sms_escalations: false
          }
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaveLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);

    } catch (err) {
      setError(err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNotificationChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      notification_preferences: {
        ...prev.notification_preferences,
        [field]: value
      }
    }));
  };

  const validatePhone = (phone) => {
    // Basic phone validation - adjust as needed
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return !phone || phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  };

  if (status === 'loading' || loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!session) {
    return null; // Will redirect via useEffect
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
          👤 My Profile
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your account information and notification preferences
        </Typography>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>
      )}

      <Grid container spacing={3}>
        {/* Profile Information Card */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon color="primary" />
                  Personal Information
                </Typography>
                <Button
                  startIcon={isEditing ? <SaveIcon /> : <EditIcon />}
                  variant={isEditing ? "contained" : "outlined"}
                  onClick={isEditing ? handleSave : () => setIsEditing(true)}
                  disabled={saveLoading}
                >
                  {saveLoading ? <CircularProgress size={20} /> : (isEditing ? 'Save Changes' : 'Edit Profile')}
                </Button>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Full Name"
                    value={profileData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    disabled={!isEditing}
                    InputProps={{
                      startAdornment: <PersonIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email Address"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={!isEditing}
                    InputProps={{
                      startAdornment: <EmailIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    value={profileData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    disabled={!isEditing}
                    placeholder="+1 (555) 123-4567"
                    error={!validatePhone(profileData.phone)}
                    helperText={!validatePhone(profileData.phone) ? 'Please enter a valid phone number' : 'For SMS notifications and calls'}
                    InputProps={{
                      startAdornment: <PhoneIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth disabled={!isEditing}>
                    <InputLabel>Timezone</InputLabel>
                    <Select
                      value={profileData.timezone}
                      label="Timezone"
                      onChange={(e) => handleInputChange('timezone', e.target.value)}
                    >
                      <MenuItem value="America/New_York">Eastern Time (ET)</MenuItem>
                      <MenuItem value="America/Chicago">Central Time (CT)</MenuItem>
                      <MenuItem value="America/Denver">Mountain Time (MT)</MenuItem>
                      <MenuItem value="America/Los_Angeles">Pacific Time (PT)</MenuItem>
                      <MenuItem value="UTC">UTC</MenuItem>
                      <MenuItem value="Europe/London">London (GMT)</MenuItem>
                      <MenuItem value="Europe/Berlin">Berlin (CET)</MenuItem>
                      <MenuItem value="Asia/Tokyo">Tokyo (JST)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Profile Avatar Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar
                src={session.user?.image}
                alt={profileData.name}
                sx={{ width: 120, height: 120, mx: 'auto', mb: 2 }}
              />
              <Typography variant="h6" gutterBottom>
                {profileData.name || 'User'}
              </Typography>
              <Chip 
                label="Account Active" 
                color="success" 
                size="small" 
                sx={{ mb: 2 }}
              />
              <Typography variant="body2" color="text.secondary">
                Signed in via Google OAuth
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Notification Preferences */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                        checked={profileData.notification_preferences.email_incidents}
                        onChange={(e) => handleNotificationChange('email_incidents', e.target.checked)}
                        disabled={!isEditing}
                      />
                    }
                    label="Email - New Incidents"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={profileData.notification_preferences.email_escalations}
                        onChange={(e) => handleNotificationChange('email_escalations', e.target.checked)}
                        disabled={!isEditing}
                      />
                    }
                    label="Email - Escalations"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={profileData.notification_preferences.sms_critical}
                        onChange={(e) => handleNotificationChange('sms_critical', e.target.checked)}
                        disabled={!isEditing || !profileData.phone}
                      />
                    }
                    label="SMS - Critical Incidents"
                  />
                  {!profileData.phone && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Add phone number to enable SMS notifications
                    </Typography>
                  )}
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={profileData.notification_preferences.sms_escalations}
                        onChange={(e) => handleNotificationChange('sms_escalations', e.target.checked)}
                        disabled={!isEditing || !profileData.phone}
                      />
                    }
                    label="SMS - Escalations"
                  />
                  {!profileData.phone && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Add phone number to enable SMS notifications
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Security & Account */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SecurityIcon color="primary" />
                Security & Account
              </Typography>
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Your account is secured with Google OAuth. To change your password or manage additional security settings, 
                  please visit your Google Account settings.
                </Typography>
                
                <Button
                  variant="outlined"
                  onClick={() => window.open('https://myaccount.google.com/security', '_blank')}
                  sx={{ mt: 2 }}
                >
                  Manage Google Account Security
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
} 