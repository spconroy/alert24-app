'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import {
  AccessTime,
  Warning,
  CheckCircle,
  Error,
  Info,
  Announcement,
} from '@mui/icons-material';
import { useOrganization } from '@/contexts/OrganizationContext';
import { formatDistanceToNow } from 'date-fns';

const getSeverityColor = (severity) => {
  switch (severity) {
    case 'critical': return '#f44336';
    case 'high': return '#ff9800';
    case 'medium': return '#ffeb3b';
    case 'low': return '#4caf50';
    case 'maintenance': return '#2196f3';
    default: return '#757575';
  }
};

const getStatusIcon = (type, status, severity) => {
  if (type === 'incident_update') {
    switch (status) {
      case 'resolved': return <CheckCircle sx={{ color: '#4caf50' }} />;
      case 'investigating': return <Warning sx={{ color: getSeverityColor(severity) }} />;
      case 'identified': return <Error sx={{ color: getSeverityColor(severity) }} />;
      case 'monitoring': return <Info sx={{ color: '#2196f3' }} />;
      default: return <Warning sx={{ color: getSeverityColor(severity) }} />;
    }
  } else if (type === 'status_update') {
    return <Announcement sx={{ color: '#2196f3' }} />;
  }
  return <Info sx={{ color: '#757575' }} />;
};

const getStatusChipColor = (type, status, severity) => {
  if (type === 'incident_update') {
    switch (status) {
      case 'resolved': return 'success';
      case 'investigating': 
      case 'identified': 
        return severity === 'critical' || severity === 'high' ? 'error' : 'warning';
      case 'monitoring': return 'info';
      default: return 'default';
    }
  }
  return 'info';
};

export default function RecentUpdatesFeed({ maxItems = 10 }) {
  const { selectedOrganization } = useOrganization();
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUpdates = async () => {
    if (!selectedOrganization?.id) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/recent-updates?organization_id=${selectedOrganization.id}&limit=${maxItems}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch recent updates');
      }

      const data = await response.json();
      setUpdates(data.updates || []);
    } catch (err) {
      console.error('Error fetching recent updates:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, [selectedOrganization?.id, maxItems]);

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Updates
          </Typography>
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Updates
          </Typography>
          <Alert severity="error" sx={{ mb: 2 }}>
            Error loading updates: {error}
          </Alert>
          <Button variant="outlined" onClick={fetchUpdates}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (updates.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Updates
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            No recent updates to display
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Recent Updates
          </Typography>
          <Button
            size="small"
            onClick={fetchUpdates}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        <List sx={{ p: 0 }}>
          {updates.map((update, index) => (
            <ListItem
              key={update.id}
              sx={{
                px: 0,
                borderBottom: index < updates.length - 1 ? '1px solid #e0e0e0' : 'none',
              }}
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: 'transparent' }}>
                  {getStatusIcon(update.type, update.status, update.severity)}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box>
                    <Typography variant="subtitle2" component="div">
                      {update.title}
                    </Typography>
                    <Box display="flex" gap={1} mt={0.5}>
                      <Chip
                        label={update.status}
                        size="small"
                        color={getStatusChipColor(update.type, update.status, update.severity)}
                        variant="outlined"
                      />
                      {update.type === 'incident_update' && update.severity && (
                        <Chip
                          label={update.severity}
                          size="small"
                          sx={{
                            backgroundColor: getSeverityColor(update.severity),
                            color: 'white',
                            fontSize: '0.7rem',
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                }
                secondary={
                  <Box mt={1}>
                    <Typography variant="body2" color="text.secondary">
                      {update.message}
                    </Typography>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                      <Typography variant="caption" color="text.secondary">
                        {update.posted_by_user?.name || 'System'} • {' '}
                        {formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}
                      </Typography>
                      {update.type === 'incident_update' && (
                        <Typography variant="caption" color="primary">
                          View Incident
                        </Typography>
                      )}
                    </Box>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}