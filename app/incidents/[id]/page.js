'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Grid,
  Alert,
  CircularProgress,
  Divider,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useSession } from 'next-auth/react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const incidentId = params.id;

  const [incident, setIncident] = useState(null);
  const [incidentUpdates, setIncidentUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [statusUpdateDialogOpen, setStatusUpdateDialogOpen] = useState(false);
  
  // Form state for incident update
  const [updateForm, setUpdateForm] = useState({
    message: '',
    update_type: 'update'
  });

  // Form state for status change
  const [statusForm, setStatusForm] = useState({
    status: '',
    resolution_notes: ''
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (incidentId && session) {
      fetchIncident();
      fetchIncidentUpdates();
    }
  }, [incidentId, session]);

  const fetchIncident = async () => {
    try {
      const response = await fetch(`/api/incidents/${incidentId}`);
      if (response.ok) {
        const data = await response.json();
        setIncident(data.incident);
        setStatusForm(prev => ({
          ...prev,
          status: data.incident.status
        }));
      } else if (response.status === 404) {
        setError('Incident not found');
      } else {
        setError('Failed to load incident');
      }
    } catch (err) {
      console.error('Error fetching incident:', err);
      setError('Failed to load incident');
    }
  };

  const fetchIncidentUpdates = async () => {
    try {
      const response = await fetch(`/api/incidents/${incidentId}/updates`);
      if (response.ok) {
        const data = await response.json();
        setIncidentUpdates(data.updates || []);
      }
    } catch (err) {
      console.error('Error fetching incident updates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUpdate = async () => {
    if (!updateForm.message.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/incidents/${incidentId}/updates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateForm),
      });

      if (response.ok) {
        setUpdateForm({ message: '', update_type: 'update' });
        setUpdateDialogOpen(false);
        await fetchIncidentUpdates();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add update');
      }
    } catch (err) {
      console.error('Error adding update:', err);
      setError('Failed to add update');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (statusForm.status === incident?.status) {
      setStatusUpdateDialogOpen(false);
      return;
    }

    setSubmitting(true);
    try {
      const updateData = {
        status: statusForm.status,
        ...(statusForm.status === 'resolved' && statusForm.resolution_notes && {
          resolution_notes: statusForm.resolution_notes
        })
      };

      const response = await fetch(`/api/incidents/${incidentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        setStatusUpdateDialogOpen(false);
        await fetchIncident();
        await fetchIncidentUpdates();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update status');
      }
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'error';
      case 'investigating': return 'warning';
      case 'monitoring': return 'info';
      case 'resolved': return 'success';
      default: return 'default';
    }
  };

  const getUpdateIcon = (updateType) => {
    switch (updateType) {
      case 'status_change': return <CheckCircleIcon />;
      case 'escalation': return <NotificationsIcon />;
      case 'assignment': return <PersonIcon />;
      default: return <InfoIcon />;
    }
  };

  const formatDuration = (startDate, endDate = null) => {
    const start = dayjs(startDate);
    const end = endDate ? dayjs(endDate) : dayjs();
    const diffMinutes = end.diff(start, 'minute');
    
    if (diffMinutes < 60) {
      return `${diffMinutes}m`;
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    } else {
      const days = Math.floor(diffMinutes / 1440);
      const hours = Math.floor((diffMinutes % 1440) / 60);
      return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button
          component={Link}
          href="/incidents"
          startIcon={<ArrowBackIcon />}
          variant="outlined"
        >
          Back to Incidents
        </Button>
      </Box>
    );
  }

  if (!incident) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Incident not found
        </Alert>
        <Button
          component={Link}
          href="/incidents"
          startIcon={<ArrowBackIcon />}
          variant="outlined"
        >
          Back to Incidents
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={4}>
        <Button
          component={Link}
          href="/incidents"
          startIcon={<ArrowBackIcon />}
          variant="outlined"
        >
          Back to Incidents
        </Button>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
          Incident #{incident.incident_number}
        </Typography>
        <Button
          startIcon={<EditIcon />}
          variant="outlined"
          component={Link}
          href={`/incidents/${incidentId}/edit`}
        >
          Edit
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Main Incident Details */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Typography variant="h5" gutterBottom>
                  {incident.title}
                </Typography>
                <Box display="flex" gap={1}>
                  <Chip 
                    label={incident.severity.toUpperCase()} 
                    color={getSeverityColor(incident.severity)}
                    size="small"
                  />
                  <Chip 
                    label={incident.status.toUpperCase()} 
                    color={getStatusColor(incident.status)}
                    size="small"
                  />
                </Box>
              </Box>

              <Typography variant="body1" paragraph>
                {incident.description}
              </Typography>

              {incident.impact_description && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Impact Description
                  </Typography>
                  <Typography variant="body2">
                    {incident.impact_description}
                  </Typography>
                </Box>
              )}

              {incident.resolution_notes && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Resolution Notes
                  </Typography>
                  <Typography variant="body2">
                    {incident.resolution_notes}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6">Incident Timeline</Typography>
                <Button
                  startIcon={<AddIcon />}
                  variant="outlined"
                  onClick={() => setUpdateDialogOpen(true)}
                >
                  Add Update
                </Button>
              </Box>

              <Timeline>
                {incidentUpdates.map((update, index) => (
                  <TimelineItem key={update.id}>
                    <TimelineSeparator>
                      <TimelineDot color={update.update_type === 'status_change' ? 'primary' : 'grey'}>
                        {getUpdateIcon(update.update_type)}
                      </TimelineDot>
                      {index < incidentUpdates.length - 1 && <TimelineConnector />}
                    </TimelineSeparator>
                    <TimelineContent>
                      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
                        <Typography variant="body1" gutterBottom>
                          {update.message}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {dayjs(update.created_at).format('MMM D, YYYY h:mm A')} • {update.created_by_name || 'System'}
                          {update.update_type && (
                            <Chip 
                              label={update.update_type.replace('_', ' ')} 
                              size="small" 
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Typography>
                      </Paper>
                    </TimelineContent>
                  </TimelineItem>
                ))}
                
                {/* Incident Created */}
                <TimelineItem>
                  <TimelineSeparator>
                    <TimelineDot color="primary">
                      <ErrorIcon />
                    </TimelineDot>
                  </TimelineSeparator>
                  <TimelineContent>
                    <Paper elevation={1} sx={{ p: 2 }}>
                      <Typography variant="body1" gutterBottom>
                        Incident created
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(incident.created_at).format('MMM D, YYYY h:mm A')} • {incident.created_by_name || 'System'}
                      </Typography>
                    </Paper>
                  </TimelineContent>
                </TimelineItem>
              </Timeline>
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* Quick Actions */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box display="flex" flexDirection="column" gap={1}>
                <Button 
                  variant="outlined" 
                  fullWidth 
                  onClick={() => setStatusUpdateDialogOpen(true)}
                >
                  Update Status
                </Button>
                <Button 
                  variant="outlined" 
                  fullWidth 
                  onClick={() => setUpdateDialogOpen(true)}
                >
                  Add Update
                </Button>
                {incident.status !== 'resolved' && (
                  <Button 
                    variant="contained" 
                    color="success" 
                    fullWidth
                    onClick={() => {
                      setStatusForm({ status: 'resolved', resolution_notes: '' });
                      setStatusUpdateDialogOpen(true);
                    }}
                  >
                    Resolve Incident
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Incident Details */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Details
              </Typography>
              <List dense>
                <ListItem disablePadding>
                  <ListItemIcon>
                    <AccessTimeIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Duration"
                    secondary={formatDuration(incident.created_at, incident.resolved_at)}
                  />
                </ListItem>
                <ListItem disablePadding>
                  <ListItemIcon>
                    <PersonIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Created By"
                    secondary={incident.created_by_name || 'System'}
                  />
                </ListItem>
                {incident.assigned_to_name && (
                  <ListItem disablePadding>
                    <ListItemIcon>
                      <PersonIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="Assigned To"
                      secondary={incident.assigned_to_name}
                    />
                  </ListItem>
                )}
                <ListItem disablePadding>
                  <ListItemText
                    primary="Created"
                    secondary={dayjs(incident.created_at).format('MMM D, YYYY h:mm A')}
                  />
                </ListItem>
                {incident.resolved_at && (
                  <ListItem disablePadding>
                    <ListItemText
                      primary="Resolved"
                      secondary={dayjs(incident.resolved_at).format('MMM D, YYYY h:mm A')}
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>

          {/* Affected Services */}
          {incident.affected_services && incident.affected_services.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Affected Services
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {incident.affected_services.map((service, index) => (
                    <Chip 
                      key={index} 
                      label={service} 
                      variant="outlined" 
                      size="small"
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Add Update Dialog */}
      <Dialog 
        open={updateDialogOpen} 
        onClose={() => setUpdateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add Incident Update</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Update Type</InputLabel>
                <Select
                  value={updateForm.update_type}
                  label="Update Type"
                  onChange={(e) => setUpdateForm(prev => ({ ...prev, update_type: e.target.value }))}
                >
                  <MenuItem value="update">General Update</MenuItem>
                  <MenuItem value="investigation">Investigation</MenuItem>
                  <MenuItem value="workaround">Workaround</MenuItem>
                  <MenuItem value="fix_applied">Fix Applied</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Update Message"
                value={updateForm.message}
                onChange={(e) => setUpdateForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Describe the current status, actions taken, or next steps..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpdateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleAddUpdate}
            disabled={submitting || !updateForm.message.trim()}
            startIcon={submitting ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            Add Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog 
        open={statusUpdateDialogOpen} 
        onClose={() => setStatusUpdateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Update Incident Status</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusForm.status}
                  label="Status"
                  onChange={(e) => setStatusForm(prev => ({ ...prev, status: e.target.value }))}
                >
                  <MenuItem value="open">Open</MenuItem>
                  <MenuItem value="investigating">Investigating</MenuItem>
                  <MenuItem value="monitoring">Monitoring</MenuItem>
                  <MenuItem value="resolved">Resolved</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {statusForm.status === 'resolved' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Resolution Notes"
                  value={statusForm.resolution_notes}
                  onChange={(e) => setStatusForm(prev => ({ ...prev, resolution_notes: e.target.value }))}
                  placeholder="Describe how the incident was resolved..."
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusUpdateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleStatusUpdate}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={20} /> : <SaveIcon />}
            color={statusForm.status === 'resolved' ? 'success' : 'primary'}
          >
            Update Status
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 