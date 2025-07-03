'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Avatar,
  Divider,
  CircularProgress,
  Alert,
  Button
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Build as BuildIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';

export default function StatusUpdatesFeed({ statusPageId }) {
  const [statusUpdates, setStatusUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [showOlderUpdates, setShowOlderUpdates] = useState(false);
  const [hasOlderUpdates, setHasOlderUpdates] = useState(false);

  useEffect(() => {
    if (statusPageId) {
      fetchStatusUpdates();
    }
  }, [statusPageId]);

  const fetchStatusUpdates = async (includeOlder = false) => {
    try {
      if (includeOlder) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      
      // Calculate 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      let url = `/api/status-updates?status_page_id=${statusPageId}&limit=50`;
      if (!includeOlder) {
        url += `&since=${thirtyDaysAgo.toISOString()}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch status updates');
      }
      const data = await response.json();
      const updates = data.statusUpdates || [];
      
      if (!includeOlder) {
        // For initial load, separate recent and older updates
        const recentUpdates = updates.filter(update => 
          new Date(update.created_at) >= thirtyDaysAgo
        );
        const olderUpdates = updates.filter(update => 
          new Date(update.created_at) < thirtyDaysAgo
        );
        
        setStatusUpdates(recentUpdates);
        setHasOlderUpdates(olderUpdates.length > 0);
      } else {
        // For "show more", replace with all updates
        setStatusUpdates(updates);
        setShowOlderUpdates(true);
      }
    } catch (err) {
      console.error('Error fetching status updates:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleShowMoreClick = () => {
    fetchStatusUpdates(true);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'operational':
      case 'resolved':
        return <CheckCircleIcon sx={{ color: 'success.main' }} />;
      case 'degraded':
      case 'monitoring':
        return <WarningIcon sx={{ color: 'warning.main' }} />;
      case 'down':
        return <ErrorIcon sx={{ color: 'error.main' }} />;
      case 'maintenance':
        return <BuildIcon sx={{ color: 'info.main' }} />;
      case 'investigating':
        return <SearchIcon sx={{ color: 'warning.main' }} />;
      case 'identified':
        return <VisibilityIcon sx={{ color: 'warning.main' }} />;
      default:
        return <InfoIcon sx={{ color: 'info.main' }} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'operational':
      case 'resolved':
        return 'success';
      case 'degraded':
      case 'monitoring':
      case 'investigating':
      case 'identified':
        return 'warning';
      case 'down':
        return 'error';
      case 'maintenance':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'operational':
        return 'Operational';
      case 'degraded':
        return 'Degraded';
      case 'down':
        return 'Outage';
      case 'maintenance':
        return 'Maintenance';
      case 'investigating':
        return 'Investigating';
      case 'identified':
        return 'Identified';
      case 'monitoring':
        return 'Monitoring';
      case 'resolved':
        return 'Resolved';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const getUpdateTypeColor = (updateType) => {
    switch (updateType) {
      case 'incident':
        return 'error';
      case 'maintenance':
        return 'info';
      case 'general':
        return 'default';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.abs(now - date) / 36e5;

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Error loading status updates: {error}
      </Alert>
    );
  }

  if (statusUpdates.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="body1" color="text.secondary">
          No status updates available.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" component="h3">
          {showOlderUpdates ? 'All Updates' : 'Recent Updates (Last 30 Days)'}
        </Typography>
        {statusUpdates.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            {statusUpdates.length} update{statusUpdates.length !== 1 ? 's' : ''}
            {hasOlderUpdates && !showOlderUpdates && ' • older updates available'}
          </Typography>
        )}
      </Box>
      
      <Box sx={{ position: 'relative' }}>
        {/* Timeline line */}
        <Box
          sx={{
            position: 'absolute',
            left: 20,
            top: 0,
            bottom: 0,
            width: 2,
            bgcolor: 'divider',
            zIndex: 0
          }}
        />
        
        {statusUpdates.map((update, index) => (
          <Box key={update.id} sx={{ position: 'relative', mb: 3 }}>
            {/* Timeline dot */}
            <Avatar
              sx={{
                position: 'absolute',
                left: 8,
                top: 16,
                width: 24,
                height: 24,
                bgcolor: 'background.paper',
                border: 2,
                borderColor: 'divider',
                zIndex: 1
              }}
            >
              {getStatusIcon(update.status)}
            </Avatar>
            
            {/* Update card */}
            <Card sx={{ ml: 6, elevation: 1 }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box flex={1}>
                    <Typography variant="h6" component="h4" gutterBottom>
                      {update.title}
                    </Typography>
                    <Box display="flex" gap={1} mb={1}>
                      <Chip
                        label={getStatusText(update.status)}
                        color={getStatusColor(update.status)}
                        size="small"
                      />
                      <Chip
                        label={update.update_type.charAt(0).toUpperCase() + update.update_type.slice(1)}
                        color={getUpdateTypeColor(update.update_type)}
                        variant="outlined"
                        size="small"
                      />
                      {update.service_name && (
                        <Chip
                          label={update.service_name}
                          variant="outlined"
                          size="small"
                        />
                      )}
                    </Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(update.created_at)}
                  </Typography>
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {update.message}
                </Typography>
                
                <Typography variant="caption" color="text.secondary">
                  Posted {new Date(update.created_at).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>

             {hasOlderUpdates && !showOlderUpdates && (
         <Box display="flex" justifyContent="center" py={3}>
           <Button
             variant="outlined"
             onClick={handleShowMoreClick}
             disabled={loadingMore}
             startIcon={loadingMore ? <CircularProgress size={16} /> : <ExpandMoreIcon />}
             sx={{ px: 3, py: 1 }}
           >
             {loadingMore ? 'Loading older updates...' : 'Show All Updates'}
           </Button>
         </Box>
       )}
    </Box>
  );
} 