'use client';
import { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  BugReport as BugReportIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';

export default function DebugPage() {
  const [debugResults, setDebugResults] = useState({});
  const [loading, setLoading] = useState({});

  const runTest = async (testName, endpoint) => {
    setLoading(prev => ({ ...prev, [testName]: true }));
    try {
      const response = await fetch(endpoint, {
        method: endpoint.includes('post-signin') ? 'POST' : 'GET',
      });
      const data = await response.json();
      setDebugResults(prev => ({
        ...prev,
        [testName]: { success: response.ok, data, status: response.status },
      }));
    } catch (error) {
      setDebugResults(prev => ({
        ...prev,
        [testName]: { success: false, error: error.message, status: 'error' },
      }));
    } finally {
      setLoading(prev => ({ ...prev, [testName]: false }));
    }
  };

  const tests = [
    {
      name: 'Auth Debug',
      description: 'Test NextAuth session and environment variables',
      endpoint: '/api/auth/debug',
      icon: <SecurityIcon />,
    },
    {
      name: 'Google OAuth Test',
      description: 'Verify Google OAuth configuration',
      endpoint: '/api/auth/test-google',
      icon: <SecurityIcon />,
    },
    {
      name: 'Post-Signin Test',
      description: 'Test user creation after authentication',
      endpoint: '/api/auth/post-signin',
      icon: <StorageIcon />,
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box display="flex" alignItems="center" gap={2} mb={4}>
          <BugReportIcon color="primary" fontSize="large" />
          <Typography variant="h4" component="h1">
            Authentication Debug Panel
          </Typography>
        </Box>

        <Alert severity="info" sx={{ mb: 4 }}>
          This page helps diagnose Google OAuth authentication issues on
          Cloudflare Pages.
        </Alert>

        <Box display="grid" gap={3}>
          {tests.map(test => (
            <Card key={test.name}>
              <CardContent>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  mb={2}
                >
                  <Box display="flex" alignItems="center" gap={2}>
                    {test.icon}
                    <Box>
                      <Typography variant="h6">{test.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {test.description}
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    variant="contained"
                    onClick={() => runTest(test.name, test.endpoint)}
                    disabled={loading[test.name]}
                    startIcon={
                      loading[test.name] && <CircularProgress size={16} />
                    }
                  >
                    {loading[test.name] ? 'Running...' : 'Run Test'}
                  </Button>
                </Box>

                {debugResults[test.name] && (
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>
                        Results {debugResults[test.name].success ? '✅' : '❌'}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <pre
                        style={{
                          background: '#f5f5f5',
                          padding: '1rem',
                          borderRadius: '4px',
                          overflow: 'auto',
                          fontSize: '0.8rem',
                        }}
                      >
                        {JSON.stringify(debugResults[test.name], null, 2)}
                      </pre>
                    </AccordionDetails>
                  </Accordion>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>

        <Card sx={{ mt: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Quick Fixes
            </Typography>
            <Typography variant="body2" component="div">
              <strong>If authentication fails:</strong>
              <ol>
                <li>Check Cloudflare Pages environment variables are set</li>
                <li>
                  Verify Google OAuth redirect URIs in Google Cloud Console
                </li>
                <li>Ensure NEXTAUTH_URL matches your deployed domain</li>
                <li>Check the browser console for detailed error messages</li>
                <li>Verify database connection and user table structure</li>
              </ol>
            </Typography>
          </CardContent>
        </Card>
      </Paper>
    </Container>
  );
}
