'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemIcon
} from '@mui/material';
import {
  Webhook as WebhookIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Security as SecurityIcon,
  Code as CodeIcon
} from '@mui/icons-material';

const WebhookManager = () => {
  const [webhooks, setWebhooks] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Dialog states
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [testDialog, setTestDialog] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: '',
    events: ['*'],
    auth_type: '',
    auth_config: {},
    headers: {},
    payload_template: null,
    field_mapping: null,
    secret: '',
    is_active: true
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);

  const authTypes = [
    { value: '', label: 'None' },
    { value: 'bearer', label: 'Bearer Token' },
    { value: 'basic', label: 'Basic Auth' },
    { value: 'api_key', label: 'API Key' },
    { value: 'custom', label: 'Custom Headers' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [webhooksResponse, eventsResponse] = await Promise.all([
        fetch('/api/webhooks'),
        fetch('/api/webhooks/events')
      ]);

      if (!webhooksResponse.ok) {
        throw new Error('Failed to load webhooks');
      }

      const webhooksData = await webhooksResponse.json();
      setWebhooks(webhooksData.webhooks || []);

      // Mock events data for now (would come from API)
      setEvents([
        { value: '*', label: 'All Events', category: 'system' },
        { value: 'incident.created', label: 'Incident Created', category: 'incidents' },
        { value: 'incident.updated', label: 'Incident Updated', category: 'incidents' },
        { value: 'incident.resolved', label: 'Incident Resolved', category: 'incidents' },
        { value: 'service.down', label: 'Service Down', category: 'monitoring' },
        { value: 'service.up', label: 'Service Up', category: 'monitoring' },
        { value: 'service.degraded', label: 'Service Degraded', category: 'monitoring' },
        { value: 'monitoring.alert', label: 'Monitoring Alert', category: 'monitoring' }
      ]);

    } catch (err) {
      console.error('Failed to load webhook data:', err);
      setError(err.message || 'Failed to load webhook data');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      description: '',
      events: ['*'],
      auth_type: '',
      auth_config: {},
      headers: {},
      payload_template: null,
      field_mapping: null,
      secret: '',
      is_active: true
    });
  };

  const handleCreate = () => {
    resetForm();
    setCreateDialog(true);
  };

  const handleEdit = (webhook) => {
    setSelectedWebhook(webhook);
    setFormData({
      name: webhook.name || '',
      url: webhook.url || '',
      description: webhook.description || '',
      events: webhook.events || ['*'],
      auth_type: webhook.auth_type || '',
      auth_config: webhook.auth_config || {},
      headers: webhook.headers || {},
      payload_template: webhook.payload_template,
      field_mapping: webhook.field_mapping,
      secret: webhook.secret || '',
      is_active: webhook.is_active !== false
    });
    setEditDialog(true);
  };

  const handleSubmit = async (isEdit = false) => {
    try {
      setSubmitting(true);
      setError(null);

      const url = isEdit ? `/api/webhooks?id=${selectedWebhook.id}` : '/api/webhooks';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${isEdit ? 'update' : 'create'} webhook`);
      }

      setSuccess(data.message);
      setCreateDialog(false);
      setEditDialog(false);
      resetForm();
      await loadData();

    } catch (err) {
      console.error('Failed to save webhook:', err);
      setError(err.message || 'Failed to save webhook');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (webhookId) => {
    if (!confirm('Are you sure you want to delete this webhook?')) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`/api/webhooks?id=${webhookId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete webhook');
      }

      setSuccess('Webhook deleted successfully');
      await loadData();

    } catch (err) {
      console.error('Failed to delete webhook:', err);
      setError(err.message || 'Failed to delete webhook');
    }
  };

  const handleTest = async (webhook) => {
    try {
      setTesting(true);
      setError(null);

      const response = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhookId: webhook.id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to test webhook');
      }

      if (data.success) {
        setSuccess(`Test webhook sent successfully! Response: ${data.result.status || 'No status'}`);
      } else {
        setError(`Test webhook failed: ${data.result.error || 'Unknown error'}`);
      }

      setTestDialog(false);
      await loadData(); // Refresh to see updated stats

    } catch (err) {
      console.error('Failed to test webhook:', err);
      setError(err.message || 'Failed to test webhook');
    } finally {
      setTesting(false);
    }
  };

  const getStatusChip = (webhook) => {
    if (!webhook.is_active) {
      return <Chip label="Disabled" color="default" size="small" />;
    }

    if (webhook.failure_count && webhook.failure_count > 0) {
      return <Chip label={`${webhook.failure_count} failures`} color="error" size="small" />;
    }

    if (webhook.last_success_at) {
      return <Chip label="Working" color="success" size="small" />;
    }

    return <Chip label="Untested" color="warning" size="small" />;
  };

  const renderAuthConfig = () => {
    switch (formData.auth_type) {
      case 'bearer':
        return (
          <TextField
            fullWidth
            label="Bearer Token"
            value={formData.auth_config.token || ''}
            onChange={(e) => setFormData({
              ...formData,
              auth_config: { ...formData.auth_config, token: e.target.value }
            })}
            margin="normal"
            type="password"
          />
        );

      case 'basic':
        return (
          <>
            <TextField
              fullWidth
              label="Username"
              value={formData.auth_config.username || ''}
              onChange={(e) => setFormData({
                ...formData,
                auth_config: { ...formData.auth_config, username: e.target.value }
              })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Password"
              value={formData.auth_config.password || ''}
              onChange={(e) => setFormData({
                ...formData,
                auth_config: { ...formData.auth_config, password: e.target.value }
              })}
              margin="normal"
              type="password"
            />
          </>
        );

      case 'api_key':
        return (
          <>
            <TextField
              fullWidth
              label="Header Name"
              value={formData.auth_config.key || ''}
              onChange={(e) => setFormData({
                ...formData,
                auth_config: { ...formData.auth_config, key: e.target.value }
              })}
              margin="normal"
              placeholder="X-API-Key"
            />
            <TextField
              fullWidth
              label="API Key"
              value={formData.auth_config.value || ''}
              onChange={(e) => setFormData({
                ...formData,
                auth_config: { ...formData.auth_config, value: e.target.value }
              })}
              margin="normal"
              type="password"
            />
          </>
        );

      default:
        return null;
    }
  };

  const WebhookForm = ({ isEdit = false }) => (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            required
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="URL"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            margin="normal"
            required
            placeholder="https://your-app.com/webhook"
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            margin="normal"
            multiline
            rows={2}
          />
        </Grid>
      </Grid>

      <Accordion sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <SecurityIcon sx={{ mr: 1 }} />
          <Typography>Authentication</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormControl fullWidth margin="normal">
            <InputLabel>Authentication Type</InputLabel>
            <Select
              value={formData.auth_type}
              onChange={(e) => setFormData({ ...formData, auth_type: e.target.value, auth_config: {} })}
            >
              {authTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {renderAuthConfig()}
          
          <TextField
            fullWidth
            label="HMAC Secret (optional)"
            value={formData.secret}
            onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
            margin="normal"
            type="password"
            helperText="Used to sign webhook payloads for verification"
          />
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <ScheduleIcon sx={{ mr: 1 }} />
          <Typography>Events</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary" paragraph>
            Select which events should trigger this webhook:
          </Typography>
          
          <List dense>
            {events.map((event) => (
              <ListItem key={event.value} button onClick={() => {
                const isSelected = formData.events.includes(event.value);
                if (event.value === '*') {
                  setFormData({ ...formData, events: isSelected ? [] : ['*'] });
                } else {
                  const newEvents = isSelected
                    ? formData.events.filter(e => e !== event.value && e !== '*')
                    : [...formData.events.filter(e => e !== '*'), event.value];
                  setFormData({ ...formData, events: newEvents });
                }
              }}>
                <ListItemIcon>
                  <Checkbox
                    checked={formData.events.includes(event.value)}
                    tabIndex={-1}
                    disableRipple
                  />
                </ListItemIcon>
                <ListItemText
                  primary={event.label}
                  secondary={event.category}
                />
              </ListItem>
            ))}
          </List>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <CodeIcon sx={{ mr: 1 }} />
          <Typography>Advanced Configuration</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TextField
            fullWidth
            label="Custom Headers (JSON)"
            value={JSON.stringify(formData.headers, null, 2)}
            onChange={(e) => {
              try {
                const headers = JSON.parse(e.target.value);
                setFormData({ ...formData, headers });
              } catch (error) {
                // Keep the text as-is if invalid JSON
              }
            }}
            margin="normal"
            multiline
            rows={3}
            placeholder='{"X-Custom-Header": "value"}'
          />
        </AccordionDetails>
      </Accordion>

      <FormControlLabel
        control={
          <Switch
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
          />
        }
        label="Active"
        sx={{ mt: 2 }}
      />
    </Box>
  );

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <WebhookIcon color="primary" />
            <Typography variant="h6">
              Webhooks
            </Typography>
          </Box>
          
          <Button
            startIcon={<AddIcon />}
            onClick={handleCreate}
            variant="contained"
          >
            Add Webhook
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" paragraph>
          Webhooks allow real-time communication with external systems when incidents and alerts occur.
        </Typography>

        {loading && (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress />
          </Box>
        )}

        {!loading && webhooks.length > 0 && (
          <List>
            {webhooks.map((webhook) => (
              <Paper key={webhook.id} sx={{ mb: 1 }}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="subtitle1">
                          {webhook.name}
                        </Typography>
                        {getStatusChip(webhook)}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {webhook.url}
                        </Typography>
                        <Typography variant="caption" display="block">
                          Events: {webhook.events?.join(', ') || 'All'}
                        </Typography>
                        {webhook.last_success_at && (
                          <Typography variant="caption" display="block">
                            Last success: {new Date(webhook.last_success_at).toLocaleString()}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  
                  <ListItemSecondaryAction>
                    <IconButton
                      onClick={() => handleTest(webhook)}
                      disabled={testing}
                    >
                      <SendIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleEdit(webhook)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleDelete(webhook.id)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              </Paper>
            ))}
          </List>
        )}

        {!loading && webhooks.length === 0 && (
          <Box textAlign="center" p={4}>
            <WebhookIcon color="disabled" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No webhooks configured yet
            </Typography>
          </Box>
        )}
      </CardContent>

      {/* Create Webhook Dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Webhook</DialogTitle>
        <DialogContent>
          <WebhookForm />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => handleSubmit(false)} 
            variant="contained"
            disabled={submitting || !formData.name || !formData.url}
          >
            {submitting ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Webhook Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Webhook</DialogTitle>
        <DialogContent>
          <WebhookForm isEdit />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => handleSubmit(true)} 
            variant="contained"
            disabled={submitting || !formData.name || !formData.url}
          >
            {submitting ? <CircularProgress size={20} /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default WebhookManager;