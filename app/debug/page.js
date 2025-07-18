'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Alert,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  BugReport as BugIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

export default function DebugPage() {
  const [loading, setLoading] = useState({});
  const [results, setResults] = useState({});
  const [organizationId, setOrganizationId] = useState(
    '80fe7a23-0a4d-461b-bb4a-f0a5fd251781'
  );
  const [checkId, setCheckId] = useState(
    'ad1639a7-a9dd-41a9-92fa-cdd3a80d46fc'
  );
  const [statusPageId, setStatusPageId] = useState(
    '26242a8f-3b68-43e1-b546-edffd3b006e7'
  );

  const executeAction = async (
    actionName,
    endpoint,
    data = {},
    method = 'POST'
  ) => {
    setLoading(prev => ({ ...prev, [actionName]: true }));
    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };

      if (method !== 'GET' && Object.keys(data).length > 0) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(endpoint, options);
      const result = await response.json();

      setResults(prev => ({
        ...prev,
        [actionName]: {
          success: response.ok,
          data: result,
          timestamp: new Date().toLocaleTimeString(),
        },
      }));
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [actionName]: {
          success: false,
          data: { error: error.message },
          timestamp: new Date().toLocaleTimeString(),
        },
      }));
    } finally {
      setLoading(prev => ({ ...prev, [actionName]: false }));
    }
  };

  const renderResult = actionName => {
    const result = results[actionName];
    if (!result) return null;

    return (
      <Alert
        severity={result.success ? 'success' : 'error'}
        sx={{ mt: 2 }}
        icon={result.success ? <CheckIcon /> : <ErrorIcon />}
      >
        <Typography variant="body2" component="div">
          <strong>{result.timestamp}:</strong>{' '}
          {result.success ? 'Success' : 'Error'}
        </Typography>
        <Box
          component="pre"
          sx={{
            fontSize: '0.75rem',
            mt: 1,
            maxHeight: 200,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {JSON.stringify(result.data, null, 2)}
        </Box>
      </Alert>
    );
  };

  const debugActions = [
    {
      category: 'Service Recovery',
      actions: [
        {
          name: 'testRecovery',
          title: 'Test Service Recovery',
          description:
            'Manually trigger service recovery for a disabled monitoring check',
          endpoint: '/api/test-recovery',
          data: () => ({ checkId }),
          color: 'primary',
        },
      ],
    },
    {
      category: 'Monitoring Operations',
      actions: [
        {
          name: 'executeCheck',
          title: 'Execute Single Check',
          description: 'Manually execute a specific monitoring check',
          endpoint: '/api/monitoring/execute',
          data: () => ({ checkId, organizationId }),
          color: 'secondary',
        },
        {
          name: 'executeAllChecks',
          title: 'Execute All Checks',
          description: 'Execute all monitoring checks for organization',
          endpoint: '/api/monitoring/execute',
          data: () => ({ executeAll: true, organizationId }),
          color: 'secondary',
        },
        {
          name: 'runCron',
          title: 'Run Monitoring Cron',
          description: 'Trigger the monitoring cron job manually',
          endpoint: '/api/monitoring/cron',
          method: 'GET',
          color: 'info',
        },
      ],
    },
    {
      category: 'Data Queries',
      actions: [
        {
          name: 'getServices',
          title: 'Get Services',
          description: 'Fetch all services for status page',
          endpoint: `/api/services?status_page_id=${statusPageId}`,
          method: 'GET',
          color: 'success',
        },
        {
          name: 'getMonitoring',
          title: 'Get Monitoring Checks',
          description: 'Fetch all monitoring checks for organization',
          endpoint: `/api/monitoring?organization_id=${organizationId}`,
          method: 'GET',
          color: 'success',
        },
        {
          name: 'getStatusUpdates',
          title: 'Get Status Updates',
          description: 'Fetch recent status updates for status page',
          endpoint: `/api/status-updates?status_page_id=${statusPageId}&limit=10`,
          method: 'GET',
          color: 'success',
        },
      ],
    },
    {
      category: 'Service Management',
      actions: [
        {
          name: 'recoverAllServices',
          title: 'Recover All Services',
          description: 'Set all services to operational status',
          endpoint: '/api/debug-recover-all-services',
          data: () => ({ statusPageId }),
          color: 'warning',
        },
      ],
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography
        variant="h4"
        gutterBottom
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <BugIcon /> Debug & Testing Tools
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Collection of debugging and testing utilities for troubleshooting the
        Alert24 system.
      </Typography>

      {/* Configuration Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Configuration
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Organization ID"
                value={organizationId}
                onChange={e => setOrganizationId(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Check ID (Test broken check)"
                value={checkId}
                onChange={e => setCheckId(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Status Page ID"
                value={statusPageId}
                onChange={e => setStatusPageId(e.target.value)}
                size="small"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Debug Actions */}
      {debugActions.map(category => (
        <Accordion key={category.category} defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">{category.category}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {category.actions.map(action => (
                <Grid item xs={12} sm={6} md={4} key={action.name}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {action.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        {action.description}
                      </Typography>
                      <Button
                        variant="contained"
                        color={action.color}
                        fullWidth
                        startIcon={
                          loading[action.name] ? (
                            <CircularProgress size={16} />
                          ) : (
                            <PlayIcon />
                          )
                        }
                        disabled={loading[action.name]}
                        onClick={() =>
                          executeAction(
                            action.name,
                            action.endpoint,
                            action.data ? action.data() : {},
                            action.method || 'POST'
                          )
                        }
                      >
                        {loading[action.name] ? 'Running...' : 'Execute'}
                      </Button>
                      {renderResult(action.name)}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Quick Status Section */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Quick Status Overview
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  3
                </Typography>
                <Typography variant="body2">Services</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="secondary">
                  5
                </Typography>
                <Typography variant="body2">Monitoring Checks</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  1
                </Typography>
                <Typography variant="body2">Status Pages</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="info.main">
                  1
                </Typography>
                <Typography variant="body2">Organizations</Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Instructions
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>Service Recovery:</strong> Use when you've disabled a
            monitoring check and want to recover associated services.
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>Monitoring Operations:</strong> Execute monitoring checks
            manually for testing.
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>Data Queries:</strong> Fetch current system state for
            debugging.
          </Typography>
          <Typography variant="body2">
            <strong>Service Management:</strong> Bulk operations for service
            status management.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
