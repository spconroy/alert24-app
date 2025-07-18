'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineDot,
  TimelineConnector,
  TimelineContent,
  TimelineOppositeContent,
  Chip,
  Avatar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Paper,
} from '@mui/material';
import NoSSR from './NoSSR';
import {
  Add as AddIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Build as BuildIcon,
} from '@mui/icons-material';

export default function IncidentTimeline({
  incidentId,
  incident,
  onIncidentUpdate,
}) {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addUpdateDialogOpen, setAddUpdateDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state for new update
  const [newUpdate, setNewUpdate] = useState({
    message: '',
    status: incident?.status || 'investigating',
    update_type: 'update',
    visible_to_subscribers: true,
  });

  useEffect(() => {
    if (incidentId) {
      fetchUpdates();
    }
  }, [incidentId]);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/incidents/${incidentId}/updates`);
      if (response.ok) {
        const data = await response.json();
        setUpdates(data.updates || []);
      } else {
        throw new Error('Failed to fetch incident updates');
      }
    } catch (err) {
      console.error('Error fetching updates:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUpdate = async () => {
    if (!newUpdate.message.trim()) {
      setError('Update message is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`/api/incidents/${incidentId}/updates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUpdate),
      });

      if (response.ok) {
        const data = await response.json();
        setUpdates(prev => [...prev, data.update]);
        setNewUpdate({
          message: '',
          status: incident?.status || 'investigating',
          update_type: 'update',
          visible_to_subscribers: true,
        });
        setAddUpdateDialogOpen(false);

        // Notify parent component if status changed
        if (newUpdate.status !== incident?.status && onIncidentUpdate) {
          onIncidentUpdate();
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add update');
      }
    } catch (err) {
      console.error('Error adding update:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = status => {
    switch (status) {
      case 'investigating':
        return <InfoIcon color="info" />;
      case 'identified':
        return <WarningIcon color="warning" />;
      case 'monitoring':
        return <CheckCircleIcon color="primary" />;
      case 'resolved':
        return <CheckCircleIcon color="success" />;
      case 'postmortem':
        return <BuildIcon color="secondary" />;
      default:
        return <InfoIcon color="default" />;
    }
  };

  const getStatusColor = status => {
    switch (status) {
      case 'investigating':
        return 'info';
      case 'identified':
        return 'warning';
      case 'monitoring':
        return 'primary';
      case 'resolved':
        return 'success';
      case 'postmortem':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getUpdateTypeColor = updateType => {
    switch (updateType) {
      case 'status_change':
        return 'primary';
      case 'resolution':
        return 'success';
      case 'escalation':
        return 'warning';
      case 'postmortem':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const formatDate = dateString => {
    return new Date(dateString).toLocaleString();
  };

  const formatRelativeTime = dateString => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.abs(now - date) / 36e5;

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h6" component="h3">
          Incident Timeline
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddUpdateDialogOpen(true)}
          size="small"
        >
          Add Update
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {updates.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No updates yet. Add the first update to start tracking incident
            progress.
          </Typography>
        </Paper>
      ) : (
        <Timeline position="left">
          {updates.map((update, index) => (
            <TimelineItem key={update.id}>
              <TimelineOppositeContent
                sx={{ m: 'auto 0', maxWidth: '100px', fontSize: '0.75rem' }}
                color="text.secondary"
              >
                <NoSSR fallback="...">
                  {formatRelativeTime(update.created_at)}
                </NoSSR>
              </TimelineOppositeContent>
              <TimelineSeparator>
                <TimelineDot color={getStatusColor(update.status)}>
                  {getStatusIcon(update.status)}
                </TimelineDot>
                {index < updates.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              <TimelineContent sx={{ py: '12px', px: 2 }}>
                <Card sx={{ mb: 1 }}>
                  <CardContent sx={{ pb: '16px !important' }}>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      mb={1}
                    >
                      <Box>
                        <Chip
                          label={
                            update.status.charAt(0).toUpperCase() +
                            update.status.slice(1)
                          }
                          color={getStatusColor(update.status)}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <Chip
                          label={
                            update.update_type?.charAt(0).toUpperCase() +
                              update.update_type?.slice(1) || 'Update'
                          }
                          color={getUpdateTypeColor(update.update_type)}
                          variant="outlined"
                          size="small"
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        <NoSSR fallback="Loading...">
                          {formatDate(update.created_at)}
                        </NoSSR>
                      </Typography>
                    </Box>

                    <Typography variant="body1" sx={{ mb: 2 }}>
                      {update.message}
                    </Typography>

                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar sx={{ width: 24, height: 24 }}>
                        <PersonIcon fontSize="small" />
                      </Avatar>
                      <Typography variant="caption" color="text.secondary">
                        {update.posted_by_user?.name || 'Unknown User'}
                      </Typography>
                      {!update.visible_to_subscribers && (
                        <Chip
                          label="Internal"
                          size="small"
                          variant="outlined"
                          color="secondary"
                        />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      )}

      {/* Add Update Dialog */}
      <Dialog
        open={addUpdateDialogOpen}
        onClose={() => setAddUpdateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add Incident Update</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              label="Update Message"
              multiline
              rows={4}
              fullWidth
              value={newUpdate.message}
              onChange={e =>
                setNewUpdate(prev => ({ ...prev, message: e.target.value }))
              }
              sx={{ mb: 3 }}
              required
            />

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={newUpdate.status}
                label="Status"
                onChange={e =>
                  setNewUpdate(prev => ({ ...prev, status: e.target.value }))
                }
              >
                <MenuItem value="investigating">Investigating</MenuItem>
                <MenuItem value="identified">Identified</MenuItem>
                <MenuItem value="monitoring">Monitoring</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
                <MenuItem value="postmortem">Post-mortem</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Update Type</InputLabel>
              <Select
                value={newUpdate.update_type}
                label="Update Type"
                onChange={e =>
                  setNewUpdate(prev => ({
                    ...prev,
                    update_type: e.target.value,
                  }))
                }
              >
                <MenuItem value="update">General Update</MenuItem>
                <MenuItem value="status_change">Status Change</MenuItem>
                <MenuItem value="resolution">Resolution</MenuItem>
                <MenuItem value="escalation">Escalation</MenuItem>
                <MenuItem value="postmortem">Post-mortem</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Visibility</InputLabel>
              <Select
                value={newUpdate.visible_to_subscribers}
                label="Visibility"
                onChange={e =>
                  setNewUpdate(prev => ({
                    ...prev,
                    visible_to_subscribers: e.target.value,
                  }))
                }
              >
                <MenuItem value={true}>
                  Public (visible to subscribers)
                </MenuItem>
                <MenuItem value={false}>Internal only</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddUpdateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddUpdate}
            variant="contained"
            disabled={submitting || !newUpdate.message.trim()}
            startIcon={
              submitting ? <CircularProgress size={16} /> : <AddIcon />
            }
          >
            {submitting ? 'Adding...' : 'Add Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
