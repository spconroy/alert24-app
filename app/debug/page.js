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
  HealthAndSafety as HealthIcon,
  MonitorHeart as MonitorIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

export default function DebugPage() {
  const [debugResults, setDebugResults] = useState({});
  const [loading, setLoading] = useState({});

  const runTest = async (testName, endpoint) => {
    setLoading(prev => ({ ...prev, [testName]: true }));
    try {
      console.log(`Running test: ${testName} - ${endpoint}`);
      const response = await fetch(endpoint, {
        method: endpoint.includes('post-signin') ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`Response status: ${response.status}`);
      
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        const text = await response.text();
        data = { parseError: 'Failed to parse JSON', responseText: text };
      }
      
      console.log('Response data:', data);
      
      setDebugResults(prev => ({
        ...prev,
        [testName]: { 
          success: response.ok, 
          data, 
          status: response.status,
          timestamp: new Date().toISOString()
        },
      }));
    } catch (error) {
      console.error(`Test ${testName} failed:`, error);
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
    {
      name: 'Environment Variables',
      description: 'Check if all required environment variables are set',
      endpoint: '/api/debug-env',
      icon: <SettingsIcon />,
    },
    {
      name: 'Monitoring Checks',
      description: 'Test monitoring checks API and database connection',
      endpoint: '/api/monitoring',
      icon: <MonitorIcon />,
    },
    {
      name: 'Status Page Health Check',
      description: 'Test external status page APIs for monitoring health',
      endpoint: '/api/debug/status-page-health?quick=true',
      icon: <HealthIcon />,
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box display="flex" alignItems="center" gap={2} mb={4}>
          <BugReportIcon color="primary" fontSize="large" />
          <Typography variant="h4" component="h1">
            System Debug Panel
          </Typography>
        </Box>

        <Alert severity="info" sx={{ mb: 4 }}>
          This page helps diagnose authentication, monitoring, and external service health issues.
        </Alert>

        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Quick Links
            </Typography>
            <Box display="flex" flex="wrap" gap={2}>
              <Button
                variant="outlined"
                href="/monitoring"
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<MonitorIcon />}
              >
                Monitoring Dashboard
              </Button>
              <Button
                variant="outlined"
                href="/api/debug-env"
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<SettingsIcon />}
              >
                Environment Check
              </Button>
              <Button
                variant="outlined"
                href="/api/monitoring"
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<StorageIcon />}
              >
                Monitoring API
              </Button>
              <Button
                variant="outlined"
                href="/api/auth/debug"
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<SecurityIcon />}
              >
                Auth Debug
              </Button>
            </Box>
          </CardContent>
        </Card>

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
                    onClick={() => {
                      console.log(`Button clicked for: ${test.name}`);
                      runTest(test.name, test.endpoint);
                    }}
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
                        {test.name === 'Status Page Health Check' && debugResults[test.name].success && (
                          <span style={{ marginLeft: '8px', fontSize: '0.9em', color: '#666' }}>
                            {debugResults[test.name].data.summary?.healthPercentage}% healthy 
                            ({debugResults[test.name].data.summary?.healthy}/{debugResults[test.name].data.summary?.total})
                          </span>
                        )}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      {debugResults[test.name].status === 401 ? (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                          Authentication required. Please sign in with Google OAuth first.
                          <br />
                          <strong>Debug info:</strong> {debugResults[test.name].data?.error}
                        </Alert>
                      ) : null}
                      
                      {test.name === 'Status Page Health Check' && debugResults[test.name].success ? (
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            Health Summary
                          </Typography>
                          <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={2} mb={3}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="success.main">
                                {debugResults[test.name].data.summary?.healthy || 0}
                              </Typography>
                              <Typography variant="body2">Healthy</Typography>
                            </Paper>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="warning.main">
                                {debugResults[test.name].data.summary?.degraded || 0}
                              </Typography>
                              <Typography variant="body2">Degraded</Typography>
                            </Paper>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="error.main">
                                {debugResults[test.name].data.summary?.failed || 0}
                              </Typography>
                              <Typography variant="body2">Failed</Typography>
                            </Paper>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="info.main">
                                {debugResults[test.name].data.summary?.avgResponseTime || 0}ms
                              </Typography>
                              <Typography variant="body2">Avg Response</Typography>
                            </Paper>
                          </Box>
                          
                          <Typography variant="h6" gutterBottom>
                            Service Details
                          </Typography>
                          {debugResults[test.name].data.results?.map((result, index) => (
                            <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
                              <Box display="flex" alignItems="center" gap={2}>
                                <Typography variant="body1" fontWeight="bold">
                                  {result.success && result.statusInfo?.isHealthy ? '✅' : 
                                   result.success ? '⚠️' : '❌'} {result.service}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {result.responseTime}ms
                                </Typography>
                              </Box>
                              {result.statusInfo && (
                                <Typography variant="body2" color="text.secondary">
                                  Status: {result.statusInfo.overallStatus} - {result.statusInfo.statusDescription}
                                </Typography>
                              )}
                              {result.error && (
                                <Typography variant="body2" color="error">
                                  Error: {result.error}
                                </Typography>
                              )}
                            </Box>
                          ))}
                          
                          <Accordion sx={{ mt: 2 }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                              <Typography variant="body2">View Raw JSON</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                              <pre
                                style={{
                                  background: '#f5f5f5',
                                  padding: '1rem',
                                  borderRadius: '4px',
                                  overflow: 'auto',
                                  fontSize: '0.7rem',
                                }}
                              >
                                {JSON.stringify(debugResults[test.name], null, 2)}
                              </pre>
                            </AccordionDetails>
                          </Accordion>
                        </Box>
                      ) : (
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
                      )}
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
              
              <strong>If status page health checks fail:</strong>
              <ol>
                <li>Check network connectivity and firewall settings</li>
                <li>Verify external API endpoints are accessible</li>
                <li>Review rate limiting on status page APIs</li>
                <li>Check monitoring_checks table in database</li>
                <li>Run the full health check script: <code>node test-status-page-health.js</code></li>
              </ol>
            </Typography>
          </CardContent>
        </Card>
      </Paper>
    </Container>
  );
}
