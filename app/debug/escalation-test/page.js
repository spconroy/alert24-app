'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  CircularProgress,
  Grid,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import BugReportIcon from '@mui/icons-material/BugReport';
import SecurityIcon from '@mui/icons-material/Security';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function EscalationTestPage() {
  const { session, selectedOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [error, setError] = useState(null);
  const [testResults, setTestResults] = useState(null);

  // Test form state
  const [selectedPolicy, setSelectedPolicy] = useState('');
  const [selectedStep, setSelectedStep] = useState('');
  const [testIncident, setTestIncident] = useState({
    title: 'Test Escalation Policy',
    description: 'This is a test of the escalation policy system.',
    severity: 'high',
  });

  useEffect(() => {
    if (session && selectedOrganization?.id) {
      fetchDebugInfo();
    }
  }, [session, selectedOrganization]);

  const fetchDebugInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/debug/incident-paging?organization_id=${selectedOrganization.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch debug info');
      }
      
      const data = await response.json();
      setDebugInfo(data);
      
      // Auto-select first policy if available
      if (data.escalationPolicies.policies.length > 0) {
        setSelectedPolicy(data.escalationPolicies.policies[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestEscalation = async () => {
    if (!selectedPolicy || selectedStep === '') {
      setError('Please select both a policy and step to test');
      return;
    }

    try {
      setTesting(true);
      setError(null);
      setTestResults(null);

      const response = await fetch('/api/debug/test-escalation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          policyId: selectedPolicy,
          stepIndex: parseInt(selectedStep),
          testData: testIncident,
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Test failed');
      }

      setTestResults(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const getSelectedPolicySteps = () => {
    if (!selectedPolicy || !debugInfo) return [];
    
    const policy = debugInfo.escalationPolicies.policies.find(p => p.id === selectedPolicy);
    return policy?.rules || [];
  };

  const getStepTargetSummary = (step) => {
    if (!step.targets || step.targets.length === 0) return 'No targets';
    
    const targetTypes = step.targets.reduce((acc, target) => {
      acc[target.type] = (acc[target.type] || 0) + 1;
      return acc;
    }, {});
    
    return Object.entries(targetTypes)
      .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
      .join(', ');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ProtectedRoute>
      <Box sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <BugReportIcon color="primary" />
            <Typography variant="h4" component="h1">
              Escalation Policy Test Center
            </Typography>
          </Box>
          <Tooltip title="Refresh Debug Info">
            <IconButton onClick={fetchDebugInfo} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Test your escalation policies to ensure notifications are working correctly.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Debug Information */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <SecurityIcon color="info" />
                  <Typography variant="h6">Debug Information</Typography>
                </Box>
                
                {debugInfo && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Organization: {debugInfo.organization.name}
                    </Typography>
                    <Typography variant="subtitle2" gutterBottom>
                      User: {debugInfo.user.name} ({debugInfo.user.email})
                    </Typography>
                    <Typography variant="subtitle2" gutterBottom>
                      Phone: {debugInfo.user.phone || 'Not set'}
                    </Typography>
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Typography variant="subtitle2" gutterBottom>
                      Escalation Policies: {debugInfo.escalationPolicies.count}
                    </Typography>
                    
                    {debugInfo.escalationPolicies.policies.map((policy) => (
                      <Box key={policy.id} sx={{ ml: 2, mb: 1 }}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2">
                            {policy.name}
                          </Typography>
                          <Chip 
                            label={`${policy.rules?.length || 0} steps`} 
                            size="small" 
                            color="primary" 
                          />
                          {policy.is_default && (
                            <Chip label="Default" size="small" color="success" />
                          )}
                        </Box>
                      </Box>
                    ))}
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Typography variant="subtitle2" gutterBottom>
                      Recent Incidents: {debugInfo.recentIncidents.length}
                    </Typography>
                    
                    {debugInfo.recentIncidents.slice(0, 3).map((incident) => (
                      <Box key={incident.id} sx={{ ml: 2, mb: 1 }}>
                        <Typography variant="body2">
                          {incident.title} - {incident.status}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Test Configuration */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <NotificationsIcon color="warning" />
                  <Typography variant="h6">Test Configuration</Typography>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Escalation Policy</InputLabel>
                      <Select
                        value={selectedPolicy}
                        onChange={(e) => {
                          setSelectedPolicy(e.target.value);
                          setSelectedStep(''); // Reset step selection
                        }}
                        label="Escalation Policy"
                      >
                        {debugInfo?.escalationPolicies.policies.map((policy) => (
                          <MenuItem key={policy.id} value={policy.id}>
                            {policy.name} ({policy.rules?.length || 0} steps)
                            {policy.is_default && ' - Default'}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <FormControl fullWidth disabled={!selectedPolicy}>
                      <InputLabel>Escalation Step</InputLabel>
                      <Select
                        value={selectedStep}
                        onChange={(e) => setSelectedStep(e.target.value)}
                        label="Escalation Step"
                      >
                        {getSelectedPolicySteps().map((step, index) => (
                          <MenuItem key={index} value={index}>
                            Step {step.level || index + 1} 
                            ({step.delay_minutes || 0}min delay) - 
                            {getStepTargetSummary(step)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Test Incident Title"
                      value={testIncident.title}
                      onChange={(e) => setTestIncident(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Test Incident Description"
                      value={testIncident.description}
                      onChange={(e) => setTestIncident(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Severity (affects channels)</InputLabel>
                      <Select
                        value={testIncident.severity}
                        onChange={(e) => setTestIncident(prev => ({ ...prev, severity: e.target.value }))}
                        label="Severity (affects channels)"
                      >
                        <MenuItem value="low">Low (Email only)</MenuItem>
                        <MenuItem value="medium">Medium (Email only)</MenuItem>
                        <MenuItem value="high">High (Email + SMS + Call)</MenuItem>
                        <MenuItem value="critical">Critical (Email + SMS + Call)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={testing ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                      onClick={handleTestEscalation}
                      disabled={!selectedPolicy || selectedStep === '' || testing}
                      color="warning"
                      size="large"
                    >
                      {testing ? 'Testing...' : 'Test Escalation Policy'}
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Test Results */}
          {testResults && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Test Results
                  </Typography>
                  
                  <Alert 
                    severity={testResults.success ? "success" : "error"} 
                    sx={{ mb: 2 }}
                  >
                    {testResults.message}
                  </Alert>

                  {testResults.results && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Policy: {testResults.results.policy.name}
                      </Typography>
                      <Typography variant="subtitle2" gutterBottom>
                        Step: Level {testResults.results.step.level} 
                        ({testResults.results.step.delay_minutes}min delay, 
                        {testResults.results.step.targets} targets)
                      </Typography>

                      <Divider sx={{ my: 2 }} />

                      {testResults.results.notifications.length > 0 && (
                        <Accordion defaultExpanded>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle2">
                              Notifications Sent ({testResults.results.notifications.length})
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <List dense>
                              {testResults.results.notifications.map((notification, index) => (
                                <ListItem key={index}>
                                  <ListItemText
                                    primary={
                                      <Box display="flex" alignItems="center" gap={1}>
                                        <Typography variant="body2">
                                          {notification.target.name}
                                        </Typography>
                                        {notification.channels.map(channel => (
                                          <Chip key={channel} label={channel} size="small" />
                                        ))}
                                      </Box>
                                    }
                                    secondary={
                                      <Box>
                                        <Typography variant="caption">
                                          {notification.target.type === 'user' 
                                            ? `Email: ${notification.target.email}${notification.target.phone ? `, Phone: ${notification.target.phone}` : ''}`
                                            : `Schedule: ${notification.target.schedule_name}, Current: ${notification.target.current_user?.name}`
                                          }
                                        </Typography>
                                      </Box>
                                    }
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </AccordionDetails>
                        </Accordion>
                      )}

                      {testResults.results.errors.length > 0 && (
                        <Accordion>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle2" color="error">
                              Errors ({testResults.results.errors.length})
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <List dense>
                              {testResults.results.errors.map((error, index) => (
                                <ListItem key={index}>
                                  <ListItemText
                                    primary={
                                      <Typography variant="body2" color="error">
                                        {error}
                                      </Typography>
                                    }
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </AccordionDetails>
                        </Accordion>
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Box>
    </ProtectedRoute>
  );
}