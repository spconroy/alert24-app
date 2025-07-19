import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  FormGroup,
  FormControlLabel,
  Switch,
  Button,
  Alert,
  Box,
  Divider,
} from '@mui/material';
import { Save as SaveIcon, Email as EmailIcon } from '@mui/icons-material';

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState({
    email_invitations: true,
    email_incidents: true,
    email_monitoring: true,
    email_updates: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/notifications/preferences');
      if (response.ok) {
        const data = await response.json();
        setPreferences({
          email_invitations: data.email_invitations,
          email_incidents: data.email_incidents,
          email_monitoring: data.email_monitoring,
          email_updates: data.email_updates,
        });
      } else {
        throw new Error('Failed to fetch preferences');
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
      setMessage({ type: 'error', text: 'Failed to load notification preferences' });
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = (key) => (event) => {
    setPreferences(prev => ({
      ...prev,
      [key]: event.target.checked,
    }));
  };

  const savePreferences = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Notification preferences updated successfully' });
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      setMessage({ type: 'error', text: 'Failed to save notification preferences' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography>Loading notification preferences...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <EmailIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">Email Notification Preferences</Typography>
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Choose which types of email notifications you'd like to receive. You can change these settings at any time.
        </Typography>

        {message && (
          <Alert 
            severity={message.type} 
            sx={{ mb: 2 }}
            onClose={() => setMessage(null)}
          >
            {message.text}
          </Alert>
        )}

        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={preferences.email_invitations}
                onChange={handlePreferenceChange('email_invitations')}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body1">Organization Invitations</Typography>
                <Typography variant="body2" color="text.secondary">
                  Receive emails when you're invited to join organizations
                </Typography>
              </Box>
            }
          />

          <Divider sx={{ my: 2 }} />

          <FormControlLabel
            control={
              <Switch
                checked={preferences.email_incidents}
                onChange={handlePreferenceChange('email_incidents')}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body1">Incident Notifications</Typography>
                <Typography variant="body2" color="text.secondary">
                  Receive emails about new incidents, status updates, and resolutions
                </Typography>
              </Box>
            }
          />

          <Divider sx={{ my: 2 }} />

          <FormControlLabel
            control={
              <Switch
                checked={preferences.email_monitoring}
                onChange={handlePreferenceChange('email_monitoring')}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body1">Monitoring Alerts</Typography>
                <Typography variant="body2" color="text.secondary">
                  Receive emails when services go down, recover, or are degraded
                </Typography>
              </Box>
            }
          />

          <Divider sx={{ my: 2 }} />

          <FormControlLabel
            control={
              <Switch
                checked={preferences.email_updates}
                onChange={handlePreferenceChange('email_updates')}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body1">Product Updates</Typography>
                <Typography variant="body2" color="text.secondary">
                  Receive emails about new features, announcements, and product updates
                </Typography>
              </Box>
            }
          />
        </FormGroup>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={savePreferences}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Note: You can also unsubscribe from specific types of emails using the unsubscribe links in each email.
        </Typography>
      </CardContent>
    </Card>
  );
}