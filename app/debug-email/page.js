'use client';
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  TextField,
} from '@mui/material';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function DebugEmailPage() {
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const { session } = useOrganization();

  const testEmailService = async () => {
    setLoading(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testEmail: testEmail || session?.user?.email,
          action: 'test',
        }),
      });

      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const checkEmailConfig = async () => {
    setLoading(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'check-config',
        }),
      });

      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Email Service Debug
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Configuration Check
          </Typography>
          <Button
            variant="outlined"
            onClick={checkEmailConfig}
            disabled={loading}
            sx={{ mr: 2 }}
          >
            {loading ? <CircularProgress size={20} /> : 'Check Email Config'}
          </Button>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Send Test Email
          </Typography>
          <TextField
            label="Test Email Address"
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            placeholder={session?.user?.email || 'test@example.com'}
            fullWidth
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            onClick={testEmailService}
            disabled={loading || !session}
          >
            {loading ? <CircularProgress size={20} /> : 'Send Test Email'}
          </Button>
        </CardContent>
      </Card>

      {testResult && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Test Results
            </Typography>
            {testResult.success ? (
              <Alert severity="success">{testResult.message}</Alert>
            ) : (
              <Alert severity="error">Error: {testResult.error}</Alert>
            )}
            {testResult.config && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Configuration Status:
                </Typography>
                <pre
                  style={{
                    backgroundColor: '#f5f5f5',
                    padding: '16px',
                    borderRadius: '4px',
                    overflow: 'auto',
                    fontSize: '12px',
                  }}
                >
                  {JSON.stringify(testResult.config, null, 2)}
                </pre>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {!session && (
        <Alert severity="info">
          Please sign in to test email functionality.
        </Alert>
      )}
    </Box>
  );
}
