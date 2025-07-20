'use client';
import { useState, useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
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
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  BugReport as BugReportIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  HealthAndSafety as HealthIcon,
  MonitorHeart as MonitorIcon,
  Settings as SettingsIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Phone as PhoneIcon,
  NotificationsActive as NotificationsIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';

export default function DebugPage() {
  const { selectedOrganization } = useOrganization();
  const [debugResults, setDebugResults] = useState({});
  const [loading, setLoading] = useState({});
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testCallPhone, setTestCallPhone] = useState('');
  
  // Escalation test state
  const [escalationPolicies, setEscalationPolicies] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState('');
  const [selectedStep, setSelectedStep] = useState('');
  const [escalationResults, setEscalationResults] = useState(null);
  const [escalationLoading, setEscalationLoading] = useState(false);
  const [debugResponse, setDebugResponse] = useState(null);

  // Load escalation policies on page load
  const loadEscalationPolicies = async () => {
    if (!selectedOrganization?.id) {
      alert('Please select an organization first');
      return;
    }
    
    try {
      const response = await fetch(`/api/debug/incident-paging?organization_id=${selectedOrganization.id}`);
      if (response.ok) {
        const data = await response.json();
        setDebugResponse(data); // Store full response for display
        console.log('Debug API Response:', data);
        console.log('Escalation Policies:', data.escalationPolicies?.policies);
        setEscalationPolicies(data.escalationPolicies?.policies || []);
        if (data.escalationPolicies?.policies?.length > 0) {
          setSelectedPolicy(data.escalationPolicies.policies[0].id);
          console.log('Selected Policy:', data.escalationPolicies.policies[0]);
          console.log('Policy Rules:', data.escalationPolicies.policies[0].rules);
        }
      }
    } catch (error) {
      console.error('Failed to load escalation policies:', error);
      setDebugResponse({ error: error.message });
    }
  };

  // Test escalation policy
  const testEscalationPolicy = async () => {
    if (!selectedPolicy || selectedStep === '') return;
    
    setEscalationLoading(true);
    try {
      const response = await fetch('/api/debug/test-escalation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyId: selectedPolicy,
          stepIndex: parseInt(selectedStep),
          testData: {
            title: 'Test Escalation Policy',
            description: 'This is a test of the escalation policy system.',
            severity: 'high',
          },
        }),
      });
      
      const result = await response.json();
      setEscalationResults(result);
    } catch (error) {
      setEscalationResults({ success: false, error: error.message });
    } finally {
      setEscalationLoading(false);
    }
  };

  const getSelectedPolicySteps = () => {
    const policy = escalationPolicies.find(p => p.id === selectedPolicy);
    console.log('getSelectedPolicySteps - Selected Policy ID:', selectedPolicy);
    console.log('getSelectedPolicySteps - Found Policy:', policy);
    console.log('getSelectedPolicySteps - Policy Rules:', policy?.rules);
    return policy?.rules || [];
  };

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
          timestamp: new Date().toISOString(),
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

  const sendTestEmail = async () => {
    if (!testEmail) {
      alert('Please enter an email address');
      return;
    }

    const testName = 'Email Test';
    setLoading(prev => ({ ...prev, [testName]: true }));
    
    try {
      console.log(`Sending test email to: ${testEmail}`);
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'test',
          testEmail: testEmail
        }),
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
          timestamp: new Date().toISOString(),
          emailSent: testEmail,
        },
      }));
    } catch (error) {
      console.error(`Email test failed:`, error);
      setDebugResults(prev => ({
        ...prev,
        [testName]: { success: false, error: error.message, status: 'error' },
      }));
    } finally {
      setLoading(prev => ({ ...prev, [testName]: false }));
    }
  };

  const sendTestSMS = async () => {
    if (!testPhone) {
      alert('Please enter a phone number');
      return;
    }

    const testName = 'SMS Test';
    setLoading(prev => ({ ...prev, [testName]: true }));
    
    try {
      console.log(`Sending test SMS to: ${testPhone}`);
      const response = await fetch('/api/test-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'test',
          testPhone: testPhone
        }),
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
          timestamp: new Date().toISOString(),
          phoneSent: testPhone,
        },
      }));
    } catch (error) {
      console.error(`SMS test failed:`, error);
      setDebugResults(prev => ({
        ...prev,
        [testName]: { success: false, error: error.message, status: 'error' },
      }));
    } finally {
      setLoading(prev => ({ ...prev, [testName]: false }));
    }
  };

  const sendTestCall = async () => {
    if (!testCallPhone) {
      alert('Please enter a phone number');
      return;
    }

    const testName = 'Phone Call Test';
    setLoading(prev => ({ ...prev, [testName]: true }));
    
    try {
      console.log(`Making test call to: ${testCallPhone}`);
      const response = await fetch('/api/test-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          testPhone: testCallPhone
        }),
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
          timestamp: new Date().toISOString(),
          phoneCalled: testCallPhone,
        },
      }));
    } catch (error) {
      console.error(`Phone call test failed:`, error);
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
      name: 'Auth Debug (NextAuth)',
      description: 'Test NextAuth session and environment variables',
      endpoint: '/api/auth/debug',
      icon: <SecurityIcon />,
    },
    {
      name: 'Session Debug (Custom)',
      description: 'Test custom session manager authentication',
      endpoint: '/api/auth/session-debug',
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
      name: 'Monitoring Checks (Auth Required)',
      description: 'Test monitoring checks API with authentication',
      endpoint: '/api/monitoring',
      icon: <MonitorIcon />,
    },
    {
      name: 'Monitoring Debug (No Auth)',
      description: 'Test database connection without authentication',
      endpoint: '/api/debug-monitoring',
      icon: <MonitorIcon />,
    },
    {
      name: 'Status Page Health Check',
      description: 'Test external status page APIs for monitoring health',
      endpoint: '/api/debug/status-page-health?quick=true',
      icon: <HealthIcon />,
    },
    {
      name: 'Escalation Policy Test',
      description: 'Test escalation policy configuration and notifications',
      endpoint: '/api/debug/incident-paging',
      icon: <NotificationsIcon />,
      isEscalationTest: true,
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
          This page helps diagnose authentication, monitoring, and external
          service health issues.
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
                href="/api/debug-monitoring"
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<StorageIcon />}
              >
                Monitoring Debug
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
                  {test.isEscalationTest ? (
                    <Button
                      variant="contained"
                      onClick={loadEscalationPolicies}
                      disabled={loading[test.name]}
                      startIcon={<NotificationsIcon />}
                    >
                      Load Policies
                    </Button>
                  ) : (
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
                  )}
                </Box>

                {/* Escalation Test UI */}
                {test.isEscalationTest && escalationPolicies.length > 0 && (
                  <Box sx={{ mt: 3, p: 3, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      Test Escalation Policy
                    </Typography>
                    
                    <Box display="grid" gridTemplateColumns="1fr 1fr 120px" gap={2} alignItems="end">
                      <TextField
                        select
                        label="Escalation Policy"
                        value={selectedPolicy}
                        onChange={(e) => {
                          setSelectedPolicy(e.target.value);
                          setSelectedStep('');
                        }}
                        size="small"
                      >
                        {escalationPolicies.map((policy) => (
                          <MenuItem key={policy.id} value={policy.id}>
                            {policy.name} ({(policy.rules && Array.isArray(policy.rules)) ? policy.rules.length : 0} steps)
                          </MenuItem>
                        ))}
                      </TextField>
                      
                      <TextField
                        select
                        label="Step"
                        value={selectedStep}
                        onChange={(e) => setSelectedStep(e.target.value)}
                        disabled={!selectedPolicy}
                        size="small"
                      >
                        {getSelectedPolicySteps().map((step, index) => (
                          <MenuItem key={index} value={index}>
                            Step {step.level || index + 1} ({step.targets?.length || 0} targets)
                          </MenuItem>
                        ))}
                      </TextField>
                      
                      <Button
                        variant="contained"
                        color="warning"
                        onClick={testEscalationPolicy}
                        disabled={!selectedPolicy || selectedStep === '' || escalationLoading}
                        startIcon={escalationLoading ? <CircularProgress size={16} /> : <PlayArrowIcon />}
                        size="small"
                      >
                        {escalationLoading ? 'Testing...' : 'Test'}
                      </Button>
                    </Box>
                    
                    {escalationResults && (
                      <Box sx={{ mt: 2 }}>
                        <Alert severity={escalationResults.success ? "success" : "error"}>
                          {escalationResults.message || escalationResults.error}
                        </Alert>
                        
                        {escalationResults.results && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2">
                              Notifications sent: {escalationResults.results.notifications.length}
                            </Typography>
                            {escalationResults.results.notifications.map((notification, index) => (
                              <Box key={index} sx={{ ml: 2, mt: 1 }}>
                                <Typography variant="body2">
                                  📧 {notification.target.name} via {notification.channels.join(', ')}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    )}
                    
                    {/* Debug Response JSON Display */}
                    {debugResponse && (
                      <Box sx={{ mt: 3 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Debug API Response (Raw JSON)
                        </Typography>
                        <TextField
                          multiline
                          rows={12}
                          fullWidth
                          value={JSON.stringify(debugResponse, null, 2)}
                          variant="outlined"
                          size="small"
                          InputProps={{
                            readOnly: true,
                            style: {
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              backgroundColor: '#f5f5f5',
                            },
                          }}
                          sx={{
                            '& .MuiInputBase-root': {
                              padding: '8px',
                            },
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                )}

                {debugResults[test.name] && (
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>
                        Results {debugResults[test.name].success ? '✅' : '❌'}
                        {test.name === 'Status Page Health Check' &&
                          debugResults[test.name].success && (
                            <span
                              style={{
                                marginLeft: '8px',
                                fontSize: '0.9em',
                                color: '#666',
                              }}
                            >
                              {
                                debugResults[test.name].data.summary
                                  ?.healthPercentage
                              }
                              % healthy (
                              {debugResults[test.name].data.summary?.healthy}/
                              {debugResults[test.name].data.summary?.total})
                            </span>
                          )}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      {debugResults[test.name].status === 401 ? (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                          Authentication required. Please sign in with Google
                          OAuth first.
                          <br />
                          <strong>Debug info:</strong>{' '}
                          {debugResults[test.name].data?.error}
                        </Alert>
                      ) : null}

                      {test.name === 'Environment Variables' &&
                      debugResults[test.name].success ? (
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            Environment Status
                          </Typography>
                          <Box
                            display="grid"
                            gridTemplateColumns="repeat(auto-fit, minmax(250px, 1fr))"
                            gap={2}
                            mb={3}
                          >
                            <Paper sx={{ p: 2 }}>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Supabase URL
                              </Typography>
                              <Typography variant="body1">
                                {debugResults[test.name].data.environment
                                  ?.hasSupabaseUrl
                                  ? '✅ Set'
                                  : '❌ Missing'}
                              </Typography>
                              {debugResults[test.name].data.environment
                                ?.supabaseUrlPrefix && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {
                                    debugResults[test.name].data.environment
                                      .supabaseUrlPrefix
                                  }
                                  ...
                                </Typography>
                              )}
                            </Paper>
                            <Paper sx={{ p: 2 }}>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Anon Key
                              </Typography>
                              <Typography variant="body1">
                                {debugResults[test.name].data.environment
                                  ?.hasSupabaseAnonKey
                                  ? '✅ Set'
                                  : '❌ Missing'}
                              </Typography>
                            </Paper>
                            <Paper sx={{ p: 2 }}>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Service Key
                              </Typography>
                              <Typography variant="body1">
                                {debugResults[test.name].data.environment
                                  ?.hasSupabaseServiceKey
                                  ? '✅ Set'
                                  : '❌ Missing'}
                              </Typography>
                            </Paper>
                            <Paper sx={{ p: 2 }}>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Environment
                              </Typography>
                              <Typography variant="body1">
                                {debugResults[test.name].data.environment
                                  ?.NODE_ENV || 'Unknown'}
                              </Typography>
                            </Paper>
                          </Box>
                        </Box>
                      ) : null}

                      {(test.name === 'Monitoring Checks (Auth Required)' ||
                        test.name === 'Monitoring Debug (No Auth)') &&
                      debugResults[test.name].data ? (
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            Monitoring Status
                          </Typography>
                          <Box
                            display="grid"
                            gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))"
                            gap={2}
                            mb={3}
                          >
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography
                                variant="h4"
                                color={
                                  debugResults[test.name].success
                                    ? 'success.main'
                                    : 'error.main'
                                }
                              >
                                {debugResults[test.name].success ? '✅' : '❌'}
                              </Typography>
                              <Typography variant="body2">
                                API Status
                              </Typography>
                            </Paper>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="info.main">
                                {debugResults[test.name].data.count ||
                                  debugResults[test.name].data.monitoring_checks
                                    ?.length ||
                                  0}
                              </Typography>
                              <Typography variant="body2">
                                Total Checks
                              </Typography>
                            </Paper>
                            {debugResults[test.name].data.database && (
                              <Paper sx={{ p: 2, textAlign: 'center' }}>
                                <Typography
                                  variant="h4"
                                  color={
                                    debugResults[test.name].data.database
                                      .success
                                      ? 'success.main'
                                      : 'error.main'
                                  }
                                >
                                  {debugResults[test.name].data.database.success
                                    ? '✅'
                                    : '❌'}
                                </Typography>
                                <Typography variant="body2">
                                  Database
                                </Typography>
                              </Paper>
                            )}
                            {debugResults[test.name].data.tableAccess && (
                              <Paper sx={{ p: 2, textAlign: 'center' }}>
                                <Typography
                                  variant="h4"
                                  color={
                                    debugResults[test.name].data.tableAccess
                                      .success
                                      ? 'success.main'
                                      : 'error.main'
                                  }
                                >
                                  {debugResults[test.name].data.tableAccess
                                    .success
                                    ? '✅'
                                    : '❌'}
                                </Typography>
                                <Typography variant="body2">
                                  Table Access
                                </Typography>
                              </Paper>
                            )}
                          </Box>
                          {debugResults[test.name].data.error && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                              <Typography variant="body2">
                                <strong>Error:</strong>{' '}
                                {debugResults[test.name].data.error}
                              </Typography>
                              {debugResults[test.name].data.details && (
                                <Typography variant="body2">
                                  <strong>Details:</strong>{' '}
                                  {debugResults[test.name].data.details}
                                </Typography>
                              )}
                            </Alert>
                          )}
                          {debugResults[test.name].data.diagnostics && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                              <Typography variant="body2">
                                <strong>Diagnosis:</strong>{' '}
                                {
                                  debugResults[test.name].data.diagnostics
                                    .message
                                }
                              </Typography>
                              {debugResults[test.name].data.diagnostics
                                .nextSteps && (
                                <Box sx={{ mt: 1 }}>
                                  <Typography variant="body2">
                                    <strong>Next Steps:</strong>
                                  </Typography>
                                  <ul
                                    style={{ margin: 0, paddingLeft: '20px' }}
                                  >
                                    {debugResults[
                                      test.name
                                    ].data.diagnostics.nextSteps.map(
                                      (step, index) => (
                                        <li key={index}>
                                          <Typography variant="body2">
                                            {step}
                                          </Typography>
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </Box>
                              )}
                            </Alert>
                          )}
                        </Box>
                      ) : null}

                      {test.name === 'Status Page Health Check' &&
                      debugResults[test.name].success ? (
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            Health Summary
                          </Typography>
                          <Box
                            display="grid"
                            gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))"
                            gap={2}
                            mb={3}
                          >
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="success.main">
                                {debugResults[test.name].data.summary
                                  ?.healthy || 0}
                              </Typography>
                              <Typography variant="body2">Healthy</Typography>
                            </Paper>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="warning.main">
                                {debugResults[test.name].data.summary
                                  ?.degraded || 0}
                              </Typography>
                              <Typography variant="body2">Degraded</Typography>
                            </Paper>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="error.main">
                                {debugResults[test.name].data.summary?.failed ||
                                  0}
                              </Typography>
                              <Typography variant="body2">Failed</Typography>
                            </Paper>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="h4" color="info.main">
                                {debugResults[test.name].data.summary
                                  ?.avgResponseTime || 0}
                                ms
                              </Typography>
                              <Typography variant="body2">
                                Avg Response
                              </Typography>
                            </Paper>
                          </Box>

                          <Typography variant="h6" gutterBottom>
                            Service Details
                          </Typography>
                          {debugResults[test.name].data.results?.map(
                            (result, index) => (
                              <Box
                                key={index}
                                sx={{
                                  mb: 2,
                                  p: 2,
                                  border: '1px solid #ddd',
                                  borderRadius: 1,
                                }}
                              >
                                <Box display="flex" alignItems="center" gap={2}>
                                  <Typography variant="body1" fontWeight="bold">
                                    {result.success &&
                                    result.statusInfo?.isHealthy
                                      ? '✅'
                                      : result.success
                                        ? '⚠️'
                                        : '❌'}{' '}
                                    {result.service}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {result.responseTime}ms
                                  </Typography>
                                </Box>
                                {result.statusInfo && (
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    Status: {result.statusInfo.overallStatus} -{' '}
                                    {result.statusInfo.statusDescription}
                                  </Typography>
                                )}
                                {result.error && (
                                  <Typography variant="body2" color="error">
                                    Error: {result.error}
                                  </Typography>
                                )}
                              </Box>
                            )
                          )}

                          <Accordion sx={{ mt: 2 }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                              <Typography variant="body2">
                                View Raw JSON
                              </Typography>
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
                                {JSON.stringify(
                                  debugResults[test.name],
                                  null,
                                  2
                                )}
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
            <Box display="flex" alignItems="center" gap={2} mb={3}>
              <EmailIcon color="primary" />
              <Typography variant="h6">
                Email Test
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Send a test email to verify email configuration and delivery
            </Typography>
            
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <TextField
                label="Email Address"
                variant="outlined"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter email address to test"
                size="small"
                sx={{ flexGrow: 1 }}
                type="email"
              />
              <Button
                variant="contained"
                onClick={sendTestEmail}
                disabled={loading['Email Test'] || !testEmail}
                startIcon={
                  loading['Email Test'] ? <CircularProgress size={16} /> : <EmailIcon />
                }
              >
                {loading['Email Test'] ? 'Sending...' : 'Send Test Email'}
              </Button>
            </Box>

            {debugResults['Email Test'] && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>
                    Email Test Results {debugResults['Email Test'].success ? '✅' : '❌'}
                    {debugResults['Email Test'].emailSent && (
                      <span
                        style={{
                          marginLeft: '8px',
                          fontSize: '0.9em',
                          color: '#666',
                        }}
                      >
                        (sent to {debugResults['Email Test'].emailSent})
                      </span>
                    )}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {debugResults['Email Test'].success ? (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      Test email sent successfully! Check your inbox at{' '}
                      <strong>{debugResults['Email Test'].emailSent}</strong>
                    </Alert>
                  ) : (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      Failed to send test email. Check the error details below.
                    </Alert>
                  )}
                  
                  <pre
                    style={{
                      background: '#f5f5f5',
                      padding: '1rem',
                      borderRadius: '4px',
                      overflow: 'auto',
                      fontSize: '0.8rem',
                    }}
                  >
                    {JSON.stringify(debugResults['Email Test'], null, 2)}
                  </pre>
                </AccordionDetails>
              </Accordion>
            )}
          </CardContent>
        </Card>

        <Card sx={{ mt: 4 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={3}>
              <SmsIcon color="primary" />
              <Typography variant="h6">
                SMS Test
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Send a test SMS to verify Twilio configuration and delivery
            </Typography>
            
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <TextField
                label="Phone Number"
                variant="outlined"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="Enter phone number (e.g., +1234567890)"
                size="small"
                sx={{ flexGrow: 1 }}
                type="tel"
                helperText="Include country code (e.g., +1 for US)"
              />
              <Button
                variant="contained"
                onClick={sendTestSMS}
                disabled={loading['SMS Test'] || !testPhone}
                startIcon={
                  loading['SMS Test'] ? <CircularProgress size={16} /> : <SmsIcon />
                }
              >
                {loading['SMS Test'] ? 'Sending...' : 'Send Test SMS'}
              </Button>
            </Box>

            {debugResults['SMS Test'] && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>
                    SMS Test Results {debugResults['SMS Test'].success ? '✅' : '❌'}
                    {debugResults['SMS Test'].phoneSent && (
                      <span
                        style={{
                          marginLeft: '8px',
                          fontSize: '0.9em',
                          color: '#666',
                        }}
                      >
                        (sent to {debugResults['SMS Test'].phoneSent})
                      </span>
                    )}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {debugResults['SMS Test'].success ? (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      Test SMS sent successfully! Check your phone at{' '}
                      <strong>{debugResults['SMS Test'].phoneSent}</strong>
                    </Alert>
                  ) : (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      Failed to send test SMS. Check the error details below.
                      {debugResults['SMS Test'].status === 401 && (
                        <>
                          <br />
                          <strong>Note:</strong> Authentication may be required or Twilio credentials may be missing.
                        </>
                      )}
                    </Alert>
                  )}
                  
                  <pre
                    style={{
                      background: '#f5f5f5',
                      padding: '1rem',
                      borderRadius: '4px',
                      overflow: 'auto',
                      fontSize: '0.8rem',
                    }}
                  >
                    {JSON.stringify(debugResults['SMS Test'], null, 2)}
                  </pre>
                </AccordionDetails>
              </Accordion>
            )}
          </CardContent>
        </Card>

        <Card sx={{ mt: 4 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={3}>
              <PhoneIcon color="primary" />
              <Typography variant="h6">
                Phone Call Test
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Make a test phone call to verify Twilio Voice API configuration
            </Typography>
            
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <TextField
                label="Phone Number"
                variant="outlined"
                value={testCallPhone}
                onChange={(e) => setTestCallPhone(e.target.value)}
                placeholder="Enter phone number (e.g., +1234567890)"
                size="small"
                sx={{ flexGrow: 1 }}
                type="tel"
                helperText="Include country code (e.g., +1 for US)"
              />
              <Button
                variant="contained"
                onClick={sendTestCall}
                disabled={loading['Phone Call Test'] || !testCallPhone}
                startIcon={
                  loading['Phone Call Test'] ? <CircularProgress size={16} /> : <PhoneIcon />
                }
              >
                {loading['Phone Call Test'] ? 'Calling...' : 'Make Test Call'}
              </Button>
            </Box>

            {debugResults['Phone Call Test'] && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>
                    Phone Call Test Results {debugResults['Phone Call Test'].success ? '✅' : '❌'}
                    {debugResults['Phone Call Test'].phoneCalled && (
                      <span
                        style={{
                          marginLeft: '8px',
                          fontSize: '0.9em',
                          color: '#666',
                        }}
                      >
                        (called {debugResults['Phone Call Test'].phoneCalled})
                      </span>
                    )}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {debugResults['Phone Call Test'].success ? (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      Test call initiated successfully! You should receive a call at{' '}
                      <strong>{debugResults['Phone Call Test'].phoneCalled}</strong>
                      {debugResults['Phone Call Test'].data.callId && (
                        <>
                          <br />
                          <strong>Call ID:</strong> {debugResults['Phone Call Test'].data.callId}
                        </>
                      )}
                    </Alert>
                  ) : (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      Failed to make test call. Check the error details below.
                      {debugResults['Phone Call Test'].status === 401 && (
                        <>
                          <br />
                          <strong>Note:</strong> Authentication may be required or Twilio credentials may be missing.
                        </>
                      )}
                      {debugResults['Phone Call Test'].status === 400 && (
                        <>
                          <br />
                          <strong>Note:</strong> Check that the phone number format is correct and includes country code.
                        </>
                      )}
                    </Alert>
                  )}
                  
                  <pre
                    style={{
                      background: '#f5f5f5',
                      padding: '1rem',
                      borderRadius: '4px',
                      overflow: 'auto',
                      fontSize: '0.8rem',
                    }}
                  >
                    {JSON.stringify(debugResults['Phone Call Test'], null, 2)}
                  </pre>
                </AccordionDetails>
              </Accordion>
            )}
          </CardContent>
        </Card>

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
                <li>
                  Run the full health check script:{' '}
                  <code>node test-status-page-health.js</code>
                </li>
              </ol>
            </Typography>
          </CardContent>
        </Card>
      </Paper>
    </Container>
  );
}
