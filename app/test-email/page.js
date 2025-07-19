'use client';

import { useState } from 'react';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Card, 
  CardContent,
  Alert,
  CircularProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip
} from '@mui/material';

export default function TestEmailPage() {
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [configStatus, setConfigStatus] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const checkConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-config' })
      });
      const data = await response.json();
      setConfigStatus(data);
    } catch (error) {
      setConfigStatus({ success: false, error: error.message });
    }
    setLoading(false);
  };

  const sendTestEmail = async () => {
    if (!testEmail) {
      alert('Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', testEmail })
      });
      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({ success: false, error: error.message });
    }
    setLoading(false);
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        📧 Email Service Test
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Test your Alert24 email service configuration and send test emails.
      </Typography>

      {/* Configuration Check */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Configuration Status
          </Typography>
          
          <Button 
            onClick={checkConfig} 
            disabled={loading}
            variant="outlined"
            sx={{ mb: 2 }}
          >
            {loading ? <CircularProgress size={20} /> : 'Check Configuration'}
          </Button>

          {configStatus && (
            <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" gutterBottom>
                Configuration Details:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="API Key"
                    secondary={
                      <Chip 
                        label={configStatus.config?.hasApiKey ? 'Present' : 'Missing'} 
                        color={configStatus.config?.hasApiKey ? 'success' : 'error'}
                        size="small"
                      />
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="API Key Valid"
                    secondary={
                      <Chip 
                        label={configStatus.config?.apiKeyValid ? 'Valid' : 'Invalid'} 
                        color={configStatus.config?.apiKeyValid ? 'success' : 'error'}
                        size="small"
                      />
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="From Email"
                    secondary={configStatus.config?.fromEmail || 'Not set'}
                  />
                </ListItem>
                {configStatus.sendgridStatus && (
                  <>
                    <ListItem>
                      <ListItemText 
                        primary="SendGrid Status"
                        secondary={
                          <Chip 
                            label={configStatus.sendgridStatus.valid ? 'Connected' : 'Error'} 
                            color={configStatus.sendgridStatus.valid ? 'success' : 'error'}
                            size="small"
                          />
                        }
                      />
                    </ListItem>
                    {configStatus.sendgridStatus.account && (
                      <>
                        <ListItem>
                          <ListItemText 
                            primary="Account Type"
                            secondary={configStatus.sendgridStatus.account.type}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Reputation"
                            secondary={configStatus.sendgridStatus.account.reputation}
                          />
                        </ListItem>
                      </>
                    )}
                  </>
                )}
              </List>
              
              <Alert 
                severity={configStatus.success ? 'success' : 'error'}
                sx={{ mt: 2 }}
              >
                {configStatus.message}
              </Alert>
            </Paper>
          )}
        </CardContent>
      </Card>

      {/* Send Test Email */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Send Test Email
          </Typography>
          
          <TextField
            fullWidth
            label="Test Email Address"
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Enter email address to send test to"
            sx={{ mb: 2 }}
          />
          
          <Button 
            onClick={sendTestEmail} 
            disabled={loading || !testEmail}
            variant="contained"
            sx={{ mb: 2 }}
          >
            {loading ? <CircularProgress size={20} /> : 'Send Test Email'}
          </Button>

          {testResult && (
            <Alert 
              severity={testResult.success ? 'success' : 'error'}
              sx={{ mt: 2 }}
            >
              {testResult.success 
                ? `✅ Test email sent successfully to ${testResult.targetEmail}!` 
                : `❌ Failed to send email: ${testResult.error}`
              }
              {testResult.originalError && (
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Technical details: {testResult.originalError}
                </Typography>
              )}
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}