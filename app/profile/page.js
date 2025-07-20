'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Typography,
  Box,
  Button,
  Avatar,
  Grid,
  Alert,
  Card,
  CardContent,
  Chip,
  CircularProgress,
} from '@mui/material';
import { Security as SecurityIcon } from '@mui/icons-material';
import { useOrganization } from '@/contexts/OrganizationContext';
import UserProfileForm from '@/components/UserProfileForm';

export default function ProfilePage() {
  const { session, sessionStatus } = useOrganization();
  const router = useRouter();

  const [profileData, setProfileData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/api/auth/signin');
      return;
    }

    if (session?.user) {
      fetchUserProfile();
    }
  }, [session, sessionStatus, router]);

  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const data = await response.json();
        const user = data.user || data; // Handle both response formats
        setProfileData({
          name: user.name || session.user.name || '',
          email: user.email || session.user.email || '',
          phone: user.phone_number || user.phone || '',
          timezone:
            user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          notification_preferences: user.notification_preferences || {
            email_incidents: true,
            email_escalations: true,
            sms_critical: false,
            sms_escalations: false,
            call_critical: false,
            call_escalations: false,
          },
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async formData => {
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      setSuccess('Profile updated successfully!');
      setProfileData(formData);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
      throw err; // Re-throw so UserProfileForm can handle it
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
        >
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
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Profile Avatar Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Box
                sx={{ position: 'relative', display: 'inline-block', mb: 2 }}
              >
                <Avatar
                  src={session.user?.image}
                  alt={profileData.name}
                  sx={{
                    width: 120,
                    height: 120,
                    mx: 'auto',
                    border: '4px solid',
                    borderColor: session.user?.image
                      ? 'primary.main'
                      : 'grey.300',
                    boxShadow: session.user?.image
                      ? '0 4px 20px rgba(25, 118, 210, 0.3)'
                      : 'none',
                  }}
                >
                  {!session.user?.image && (profileData.name?.charAt(0) || '?')}
                </Avatar>
                {session.user?.image && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      backgroundColor: 'success.main',
                      color: 'white',
                      borderRadius: '50%',
                      width: 24,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      border: '2px solid white',
                    }}
                  >
                    ✓
                  </Box>
                )}
              </Box>
              <Typography variant="h6" gutterBottom>
                {profileData.name || 'User'}
              </Typography>
              <Chip
                label="Account Active"
                color="success"
                size="small"
                sx={{ mb: 1 }}
              />
              <Box sx={{ mb: 2 }}>
                {session.user?.image ? (
                  <Chip
                    label="Google Profile Photo"
                    color="primary"
                    size="small"
                    sx={{
                      backgroundColor: 'primary.main',
                      color: 'white',
                      fontWeight: 500,
                    }}
                  />
                ) : (
                  <Chip
                    label="Default Avatar"
                    color="default"
                    size="small"
                    sx={{
                      backgroundColor: 'grey.200',
                      color: 'text.secondary',
                    }}
                  />
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">
                {session.user?.image
                  ? 'Your Google account profile photo is displayed'
                  : 'Signed in via Google OAuth'}
              </Typography>
              {!session.user?.image && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  sx={{ mt: 1 }}
                >
                  To see your Google profile photo, make sure your Google
                  account has a profile picture set
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* User Profile Form */}
        <Grid size={{ xs: 12, md: 8 }}>
          <UserProfileForm
            initialData={profileData}
            onSave={handleSave}
            loading={loading}
          />
        </Grid>

        {/* Security & Account */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <SecurityIcon color="primary" />
                Security & Account
              </Typography>

              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Your account is secured with Google OAuth. To change your
                  password or manage additional security settings, please visit
                  your Google Account settings.
                </Typography>

                <Button
                  variant="outlined"
                  onClick={() =>
                    window.open(
                      'https://myaccount.google.com/security',
                      '_blank'
                    )
                  }
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
