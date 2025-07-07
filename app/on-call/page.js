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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider
} from '@mui/material';
import Link from 'next/link';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useSession } from 'next-auth/react';

export default function OnCallPage() {
  const [schedules, setSchedules] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { data: session } = useSession();

  useEffect(() => {
    if (session) {
      fetchSchedules();
      fetchOrganizations();
    }
  }, [session, selectedOrgId]);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
      }
    } catch (err) {
      console.error('Error fetching organizations:', err);
    }
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedOrgId && selectedOrgId !== 'all') {
        params.append('organization_id', selectedOrgId);
      }
      
      // Get schedules for the next 7 days
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      params.append('start_date', now.toISOString());
      params.append('end_date', nextWeek.toISOString());

      const response = await fetch(`/api/on-call-schedules?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch on-call schedules');
      }

      const data = await response.json();
      setSchedules(data.on_call_schedules || []);

    } catch (err) {
      console.error('Error fetching schedules:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatTimeRemaining = (endTime) => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return 'Ended';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h remaining`;
    return `${hours}h remaining`;
  };

  // Separate current and upcoming schedules
  const now = new Date();
  const currentSchedules = schedules.filter(s => 
    new Date(s.start_time) <= now && new Date(s.end_time) >= now && s.is_active
  );
  const upcomingSchedules = schedules.filter(s => 
    new Date(s.start_time) > now && s.is_active
  ).slice(0, 10);

  if (!session) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Please sign in to view on-call schedules.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            On-Call Schedules
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage team on-call rotations and schedules
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchSchedules} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            component={Link}
            href="/on-call/new"
            variant="contained"
            startIcon={<AddIcon />}
            color="primary"
          >
            Add Schedule
          </Button>
        </Box>
      </Box>

      {/* Organization Filter */}
      {organizations.length > 1 && (
        <Box sx={{ mb: 3 }}>
          <FormControl sx={{ minWidth: 250 }}>
            <InputLabel id="org-filter-label">Organization</InputLabel>
            <Select
              labelId="org-filter-label"
              value={selectedOrgId}
              label="Organization"
              onChange={(e) => setSelectedOrgId(e.target.value)}
            >
              <MenuItem value="all">All Organizations</MenuItem>
              {organizations.map((org) => (
                <MenuItem key={org.id} value={org.id}>
                  {org.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* Currently On-Call */}
          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <PersonIcon color="primary" />
                  <Typography variant="h6">Currently On-Call</Typography>
                  <Chip 
                    label={currentSchedules.length} 
                    color="primary" 
                    size="small" 
                  />
                </Box>
                <Divider sx={{ mb: 2 }} />
                
                {currentSchedules.length === 0 ? (
                  <Box textAlign="center" py={4}>
                    <Typography color="text.secondary">
                      No one is currently on-call
                    </Typography>
                  </Box>
                ) : (
                  <List>
                    {currentSchedules.map((schedule, index) => (
                      <ListItem key={schedule.id} divider={index < currentSchedules.length - 1}>
                        <ListItemAvatar>
                          <Avatar>
                            {schedule.user_name?.charAt(0) || 'U'}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={schedule.user_name}
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {schedule.organization_name}
                              </Typography>
                              <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                                <AccessTimeIcon fontSize="small" color="action" />
                                <Typography variant="body2" color="text.secondary">
                                  {formatTimeRemaining(schedule.end_time)}
                                </Typography>
                              </Box>
                            </Box>
                          }
                        />
                        <Chip
                          label="Active"
                          color="success"
                          size="small"
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Upcoming Schedules */}
          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <AccessTimeIcon color="primary" />
                  <Typography variant="h6">Upcoming Schedules</Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                
                {upcomingSchedules.length === 0 ? (
                  <Box textAlign="center" py={4}>
                    <Typography color="text.secondary">
                      No upcoming schedules
                    </Typography>
                  </Box>
                ) : (
                  <List>
                    {upcomingSchedules.map((schedule, index) => (
                      <ListItem key={schedule.id} divider={index < upcomingSchedules.length - 1}>
                        <ListItemAvatar>
                          <Avatar>
                            {schedule.user_name?.charAt(0) || 'U'}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={schedule.user_name}
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {schedule.organization_name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Starts: {formatDateTime(schedule.start_time)}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Ends: {formatDateTime(schedule.end_time)}
                              </Typography>
                            </Box>
                          }
                        />
                        <Chip
                          label="Upcoming"
                          color="info"
                          size="small"
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Stats */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Schedule Statistics
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="primary">
                        {currentSchedules.length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Currently On-Call
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="info.main">
                        {upcomingSchedules.length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Upcoming This Week
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="success.main">
                        {schedules.filter(s => s.is_active).length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Active Schedules
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="warning.main">
                        {new Set(schedules.map(s => s.user_id)).size}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Team Members Involved
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Empty State */}
      {!loading && schedules.length === 0 && (
        <Box textAlign="center" py={6}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No on-call schedules found
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Create your first on-call schedule to manage team rotations.
          </Typography>
          <Button
            component={Link}
            href="/on-call/new"
            variant="contained"
            startIcon={<AddIcon />}
            color="primary"
          >
            Add Schedule
          </Button>
        </Box>
      )}
    </Box>
  );
} 