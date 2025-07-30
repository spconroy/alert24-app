'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Fab,
} from '@mui/material';
import Link from 'next/link';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import WarningIcon from '@mui/icons-material/Warning';
import MonitorIcon from '@mui/icons-material/Monitor';
import BusinessIcon from '@mui/icons-material/Business';
import FlagIcon from '@mui/icons-material/Flag';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import SearchIcon from '@mui/icons-material/Search';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filters, setFilters] = useState({
    organization_id: '',
    status: '',
    severity: '',
    assigned_to: '',
    search: '',
  });
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 25,
    offset: 0,
    hasMore: false,
  });
  const [sorting, setSorting] = useState({
    field: 'created_at',
    direction: 'desc',
  });
  const [groupBy, setGroupBy] = useState('none');

  const { session, selectedOrganization } = useOrganization();

  useEffect(() => {
    if (session && selectedOrganization?.id) {
      fetchIncidents();
      fetchOrganizations();
    }
  }, [session, selectedOrganization, filters, pagination.offset]);

  // Auto-refresh every 30 seconds to update paging status
  useEffect(() => {
    if (session && selectedOrganization?.id) {
      const interval = setInterval(() => {
        // Only refresh if there are active incidents with high/critical severity
        const hasActiveHighSeverityIncidents = incidents.some(inc => 
          ['new', 'open'].includes(inc.status) && 
          ['critical', 'high'].includes(inc.severity)
        );
        
        if (hasActiveHighSeverityIncidents) {
          fetchIncidents();
        }
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
    }
  }, [session, selectedOrganization, incidents]);

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

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      setError(null);

      // Require organization to be selected
      if (!selectedOrganization?.id) {
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();

      // Add organization_id (required)
      params.append('organization_id', selectedOrganization.id);

      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value && key !== 'search') {
          params.append(key, value);
        }
      });

      // Add pagination
      params.append('limit', pagination.limit.toString());
      params.append('offset', pagination.offset.toString());

      const response = await fetch(`/api/incidents?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch incidents');
      }

      const data = await response.json();
      setIncidents(data.incidents || []);
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || 0,
        hasMore: data.pagination?.hasMore || false,
      }));
    } catch (err) {
      console.error('Error fetching incidents:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
    }));
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const clearFilters = () => {
    setFilters({
      organization_id: '',
      status: '',
      severity: '',
      assigned_to: '',
      search: '',
    });
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const getIncidentSeverityColor = severity => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'primary';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  const getIncidentStatusColor = status => {
    switch (status) {
      case 'open':
        return 'error';
      case 'investigating':
        return 'warning';
      case 'monitoring':
        return 'info';
      case 'resolved':
        return 'success';
      default:
        return 'default';
    }
  };

  const getPagingStatus = (incident) => {
    // Check if incident should be paging based on severity and status
    const isPagingEligible = ['critical', 'high'].includes(incident.severity) && 
                            ['new', 'open'].includes(incident.status) &&
                            incident.assigned_to;
    
    if (!isPagingEligible) return null;

    // Calculate time since incident creation
    const createdAt = new Date(incident.created_at);
    const now = new Date();
    const minutesSinceCreation = Math.floor((now - createdAt) / (1000 * 60));

    // Paging intervals: 0 (immediate), 15, 30, 60 minutes
    const pagingIntervals = [0, 15, 30, 60];
    
    // Determine which page number we're on and time to next page
    let currentPageNumber = 1;
    let timeToNextPage = 15 - minutesSinceCreation;
    let escalationLevel = 1;
    
    if (minutesSinceCreation >= 60) {
      // After 60 minutes, continue paging every 60 minutes
      currentPageNumber = 4 + Math.floor((minutesSinceCreation - 60) / 60);
      timeToNextPage = 60 - ((minutesSinceCreation - 60) % 60);
      escalationLevel = 4; // Max escalation
    } else if (minutesSinceCreation >= 30) {
      currentPageNumber = 3;
      timeToNextPage = 60 - minutesSinceCreation;
      escalationLevel = 3;
    } else if (minutesSinceCreation >= 15) {
      currentPageNumber = 2;
      timeToNextPage = 30 - minutesSinceCreation;
      escalationLevel = 2;
    }

    // Calculate time since last page
    let timeSinceLastPage = minutesSinceCreation;
    if (minutesSinceCreation >= 60) {
      timeSinceLastPage = (minutesSinceCreation - 60) % 60;
    } else if (minutesSinceCreation >= 30) {
      timeSinceLastPage = minutesSinceCreation - 30;
    } else if (minutesSinceCreation >= 15) {
      timeSinceLastPage = minutesSinceCreation - 15;
    }

    return {
      status: timeSinceLastPage < 5 ? 'paging-active' : 'paging',
      message: `Page #${currentPageNumber}${escalationLevel > 1 ? ` (L${escalationLevel})` : ''}`,
      level: escalationLevel,
      pageNumber: currentPageNumber,
      timeRemaining: timeToNextPage,
      timeSinceLastPage: timeSinceLastPage,
      totalMinutes: minutesSinceCreation
    };
  };

  const handleLoadMore = () => {
    setPagination(prev => ({
      ...prev,
      offset: prev.offset + prev.limit,
    }));
  };

  const handleResolveIncident = async (incidentId) => {
    console.log('Starting incident resolution for:', incidentId);
    
    try {
      const response = await fetch(`/api/incidents/${incidentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        }),
      });

      console.log('Resolve incident response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to resolve incident:', errorData);
        setError(errorData.error || 'Failed to resolve incident');
        return;
      }

      const data = await response.json();
      console.log('Incident resolved successfully:', data);

      // Update the local state to reflect the change
      setIncidents(prev => 
        prev.map(inc => 
          inc.id === incidentId 
            ? { ...inc, status: 'resolved', resolved_at: new Date().toISOString() }
            : inc
        )
      );

      // Show success message
      setSuccess(`Incident #${incidentId.slice(-4)} resolved successfully`);
      setTimeout(() => setSuccess(null), 5000); // Auto-hide after 5 seconds
      
    } catch (err) {
      console.error('Error resolving incident:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
      });
      setError('Failed to resolve incident. Please try again.');
    }
  };

  const handleSort = (field) => {
    setSorting(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const sortIncidents = (incidents) => {
    return [...incidents].sort((a, b) => {
      // Always prioritize open incidents over resolved ones
      if (a.status === 'resolved' && b.status !== 'resolved') return 1;
      if (a.status !== 'resolved' && b.status === 'resolved') return -1;
      
      let aValue = a[sorting.field];
      let bValue = b[sorting.field];
      
      // Handle special sorting cases
      if (sorting.field === 'severity') {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        aValue = severityOrder[aValue] || 0;
        bValue = severityOrder[bValue] || 0;
      } else if (sorting.field === 'status') {
        const statusOrder = { 
          open: 6, 
          new: 5, 
          investigating: 4, 
          identified: 3, 
          monitoring: 2, 
          resolved: 1, 
          postmortem: 0 
        };
        aValue = statusOrder[aValue] || 0;
        bValue = statusOrder[bValue] || 0;
      } else if (sorting.field === 'created_at') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (sorting.field === 'incident_number') {
        aValue = parseInt(aValue) || 0;
        bValue = parseInt(bValue) || 0;
      }
      
      if (sorting.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  const groupIncidents = (incidents) => {
    if (groupBy === 'none') {
      return { 'All Incidents': incidents };
    }
    
    const grouped = {};
    
    incidents.forEach(incident => {
      let groupKey;
      
      if (groupBy === 'status') {
        groupKey = incident.status.charAt(0).toUpperCase() + incident.status.slice(1);
      } else if (groupBy === 'date') {
        const date = new Date(incident.created_at);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
          groupKey = 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
          groupKey = 'Yesterday';
        } else {
          groupKey = date.toLocaleDateString();
        }
      } else if (groupBy === 'severity') {
        groupKey = incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1);
      }
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(incident);
    });
    
    return grouped;
  };

  return (
    <ProtectedRoute>
      {/* Subtle Header Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          py: 3,
          px: 3,
          mb: 3,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{
                fontWeight: 600,
                color: 'text.primary',
                mb: 0.5,
              }}
            >
              🚨 Incident Tracker
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Monitor and manage service disruptions across your systems in
              real-time
            </Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Tooltip title="Refresh" arrow>
              <IconButton
                onClick={fetchIncidents}
                color="primary"
                sx={{
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: '0 2px 8px rgba(25, 118, 210, 0.3)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {/* Only show create button when there are incidents */}
            {incidents.length > 0 && (
              <Button
                component={Link}
                href="/incidents/new"
                variant="contained"
                startIcon={<AddIcon />}
                sx={{
                  fontWeight: 600,
                  px: 3,
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                Create Incident
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      <Box sx={{ px: 6, pb: 3 }}>
        {/* Compact Filters Section */}
        <Card
          sx={{
            mb: 3,
            borderRadius: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          <CardContent sx={{ py: 2, px: 3 }}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <FilterListIcon fontSize="small" color="primary" />
              <Typography variant="h6" fontWeight="500" color="text.primary">
                Filters
              </Typography>

              {/* Active filter count indicator */}
              {Object.values(filters).filter(v => v).length > 0 && (
                <Chip
                  label={`${Object.values(filters).filter(v => v).length} filter${Object.values(filters).filter(v => v).length > 1 ? 's' : ''} active`}
                  size="small"
                  color="primary"
                  sx={{
                    backgroundColor: 'primary.main',
                    color: 'white',
                    fontWeight: 600,
                    '& .MuiChip-deleteIcon': {
                      color: 'rgba(255,255,255,0.7)',
                      '&:hover': {
                        color: 'white',
                      },
                    },
                  }}
                  onDelete={clearFilters}
                />
              )}
              
              {/* Active Filters Display */}
              {Object.entries(filters).filter(([key, value]) => value).length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {Object.entries(filters).filter(([key, value]) => value).map(([key, value]) => {
                    let displayValue = value;
                    if (key === 'organization_id') {
                      const org = organizations.find(o => o.id === value);
                      displayValue = org?.name || 'Unknown';
                    }
                    return (
                      <Chip
                        key={key}
                        label={`${key.replace('_', ' ')}: ${displayValue}`}
                        size="small"
                        variant="outlined"
                        onDelete={() => handleFilterChange(key, '')}
                        sx={{
                          textTransform: 'capitalize',
                          fontSize: '0.75rem',
                          height: '24px',
                        }}
                      />
                    );
                  })}
                </Box>
              )}

              <Box sx={{ ml: 'auto' }}>
                <Button
                  variant="text"
                  size="small"
                  onClick={clearFilters}
                  disabled={Object.values(filters).every(v => !v)}
                  sx={{
                    fontSize: '0.75rem',
                    minWidth: 'auto',
                    px: 1,
                  }}
                >
                  Clear All
                </Button>
              </Box>
            </Box>

            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    label="Status"
                    onChange={e => handleFilterChange('status', e.target.value)}
                  >
                    <MenuItem value="">All Statuses</MenuItem>
                    <MenuItem value="new">New</MenuItem>
                    <MenuItem value="acknowledged">Acknowledged</MenuItem>
                    <MenuItem value="open">Open</MenuItem>
                    <MenuItem value="investigating">Investigating</MenuItem>
                    <MenuItem value="identified">Identified</MenuItem>
                    <MenuItem value="monitoring">Monitoring</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                    <MenuItem value="postmortem">Postmortem</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Severity</InputLabel>
                  <Select
                    value={filters.severity}
                    label="Severity"
                    onChange={e =>
                      handleFilterChange('severity', e.target.value)
                    }
                  >
                    <MenuItem value="">All Severities</MenuItem>
                    <MenuItem value="critical">Critical</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Group By</InputLabel>
                  <Select
                    value={groupBy}
                    label="Group By"
                    onChange={e => setGroupBy(e.target.value)}
                  >
                    <MenuItem value="none">No Grouping</MenuItem>
                    <MenuItem value="status">Status</MenuItem>
                    <MenuItem value="date">Date</MenuItem>
                    <MenuItem value="severity">Severity</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search"
                  value={filters.search}
                  onChange={e => handleFilterChange('search', e.target.value)}
                  placeholder="Search incidents..."
                  InputProps={{
                    startAdornment: (
                      <SearchIcon
                        fontSize="small"
                        sx={{ mr: 0.5, color: 'action.active' }}
                      />
                    ),
                  }}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Success Alert */}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Enhanced Incidents Section */}
        <Card
          sx={{
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            border: '1px solid rgba(0,0,0,0.08)',
            overflow: 'hidden',
            background: 'linear-gradient(145deg, #ffffff 0%, #fafbfc 100%)',
            position: 'relative',
          }}
        >
          {/* Enhanced Header */}
          {incidents.length > 0 && !loading && (
            <Box
              sx={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                borderBottom: '2px solid #e2e8f0',
                px: 3,
                py: 2.5,
              }}
            >
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: 'white',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <WarningIcon color="primary" />
                  </Box>
                  <Box>
                    <Typography
                      variant="h5"
                      fontWeight="700"
                      color="text.primary"
                    >
                      {(() => {
                        const activeIncidents = incidents.filter(i => i.status !== 'resolved' && i.status !== 'postmortem');
                        const resolvedIncidents = incidents.filter(i => i.status === 'resolved' || i.status === 'postmortem');
                        
                        if (activeIncidents.length === 0 && resolvedIncidents.length > 0) {
                          return `${resolvedIncidents.length} Resolved Incident${resolvedIncidents.length !== 1 ? 's' : ''}`;
                        } else if (activeIncidents.length > 0 && resolvedIncidents.length === 0) {
                          return `${activeIncidents.length} Active Incident${activeIncidents.length !== 1 ? 's' : ''}`;
                        } else if (activeIncidents.length > 0 && resolvedIncidents.length > 0) {
                          return `${activeIncidents.length} Active, ${resolvedIncidents.length} Resolved`;
                        } else {
                          return 'All Incidents';
                        }
                      })()}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    >
                      {pagination.total > 0 ? (
                        <>
                          Showing {pagination.offset + 1}-{Math.min(pagination.offset + incidents.length, pagination.total)} of {pagination.total} incident{pagination.total !== 1 ? 's' : ''}
                        </>
                      ) : (
                        `${incidents.length} incident${incidents.length !== 1 ? 's' : ''} found`
                      )}
                    </Typography>
                  </Box>
                </Box>

                {/* Quick Status Stats */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {['new', 'acknowledged', 'open', 'investigating', 'identified', 'monitoring', 'resolved', 'postmortem'].map(
                    status => {
                      const count = incidents.filter(
                        i => i.status === status
                      ).length;
                      const colors = {
                        new: 'error',
                        acknowledged: 'warning',
                        open: 'error',
                        investigating: 'warning',
                        identified: 'info',
                        monitoring: 'info',
                        resolved: 'success',
                        postmortem: 'default',
                      };
                      return count > 0 ? (
                        <Chip
                          key={status}
                          label={`${count} ${status}`}
                          size="small"
                          color={colors[status]}
                          variant="outlined"
                          sx={{
                            backgroundColor: 'white',
                            fontWeight: 600,
                            textTransform: 'capitalize',
                            borderWidth: 2,
                          }}
                        />
                      ) : null;
                    }
                  )}
                </Box>
              </Box>
            </Box>
          )}

          <CardContent sx={{ p: 0 }}>
            {loading && incidents.length === 0 ? (
              <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                minHeight="200px"
              >
                <CircularProgress />
              </Box>
            ) : incidents.length === 0 ? (
              <Box textAlign="center" py={8} px={4}>
                {/* Visual Icon */}
                <Box sx={{ mb: 3 }}>
                  <WarningIcon
                    sx={{
                      fontSize: 80,
                      color: 'text.disabled',
                      opacity: 0.5,
                    }}
                  />
                </Box>

                {Object.values(filters).some(v => v) ? (
                  // Filtered state
                  <>
                    <Typography
                      variant="h6"
                      color="text.secondary"
                      gutterBottom
                    >
                      No incidents match your filters
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mb={3}>
                      Try adjusting your filters or create a new incident.
                    </Typography>
                    <Box
                      sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}
                    >
                      <Button variant="outlined" onClick={clearFilters}>
                        Clear Filters
                      </Button>
                      <Button
                        component={Link}
                        href="/incidents/new"
                        variant="contained"
                        startIcon={<AddIcon />}
                        color="error"
                      >
                        Create Incident
                      </Button>
                    </Box>
                  </>
                ) : (
                  // Empty state
                  <>
                    <Typography
                      variant="h5"
                      gutterBottom
                      sx={{ fontWeight: 600 }}
                    >
                      No incidents yet
                    </Typography>
                    <Typography
                      variant="body1"
                      color="text.secondary"
                      sx={{ mb: 2, maxWidth: 500, mx: 'auto' }}
                    >
                      Incidents help you track outages, degraded services, or
                      operational alerts. They provide a central place to
                      coordinate response efforts and communicate status
                      updates.
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}
                    >
                      Get started by creating your first incident, or integrate
                      with your monitoring tools to automatically detect issues.
                    </Typography>

                    <Box
                      sx={{
                        display: 'flex',
                        gap: 2,
                        justifyContent: 'center',
                        mb: 3,
                      }}
                    >
                      <Button
                        component={Link}
                        href="/incidents/new"
                        variant="contained"
                        size="large"
                        startIcon={<AddIcon />}
                        color="error"
                      >
                        Create Incident
                      </Button>
                      <Button
                        component={Link}
                        href="/monitoring"
                        variant="outlined"
                        size="large"
                        startIcon={<MonitorIcon />}
                      >
                        Setup Monitoring
                      </Button>
                    </Box>

                    <Box
                      sx={{
                        mt: 4,
                        p: 2,
                        backgroundColor: 'grey.50',
                        borderRadius: 2,
                        maxWidth: 600,
                        mx: 'auto',
                      }}
                    >
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 1, fontWeight: 600 }}
                      >
                        💡 Common incident types:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        • Service outages or downtime • Performance degradation
                        • Security incidents • Planned maintenance
                      </Typography>
                    </Box>
                  </>
                )}
              </Box>
            ) : (
              <TableContainer sx={{ backgroundColor: 'transparent' }}>
                <Table sx={{ minWidth: 650 }}>
                  <TableHead>
                    <TableRow
                      sx={{
                        backgroundColor: 'rgba(99, 102, 241, 0.04)',
                        '& .MuiTableCell-head': {
                          fontWeight: 700,
                          fontSize: '0.875rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          color: 'text.primary',
                          borderBottom: '2px solid rgba(99, 102, 241, 0.1)',
                          py: 2,
                        },
                      }}
                    >
                      <TableCell
                        sx={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('incident_number')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          🆔
                          {sorting.field === 'incident_number' && (
                            sorting.direction === 'asc' ? 
                            <ArrowUpwardIcon fontSize="small" /> : 
                            <ArrowDownwardIcon fontSize="small" />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('title')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          📋 Title
                          {sorting.field === 'title' && (
                            sorting.direction === 'asc' ? 
                            <ArrowUpwardIcon fontSize="small" /> : 
                            <ArrowDownwardIcon fontSize="small" />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>🏢 Organization</TableCell>
                      <TableCell
                        sx={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('status')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          🚩 Status
                          {sorting.field === 'status' && (
                            sorting.direction === 'asc' ? 
                            <ArrowUpwardIcon fontSize="small" /> : 
                            <ArrowDownwardIcon fontSize="small" />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('severity')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          ⚠️ Severity
                          {sorting.field === 'severity' && (
                            sorting.direction === 'asc' ? 
                            <ArrowUpwardIcon fontSize="small" /> : 
                            <ArrowDownwardIcon fontSize="small" />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>👤 Assigned To</TableCell>
                      <TableCell
                        sx={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSort('created_at')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          📅 Created
                          {sorting.field === 'created_at' && (
                            sorting.direction === 'asc' ? 
                            <ArrowUpwardIcon fontSize="small" /> : 
                            <ArrowDownwardIcon fontSize="small" />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(groupIncidents(sortIncidents(incidents))).map(([groupName, groupIncidents]) => (
                      <React.Fragment key={groupName}>
                        {groupBy !== 'none' && (
                          <TableRow>
                            <TableCell 
                              colSpan={8} 
                              sx={{ 
                                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                                fontWeight: 700,
                                fontSize: '0.875rem',
                                py: 1.5,
                                borderBottom: '2px solid rgba(99, 102, 241, 0.2)',
                              }}
                            >
                              {groupName} ({groupIncidents.length})
                            </TableCell>
                          </TableRow>
                        )}
                        {groupIncidents.map((incident, index) => (
                          <TableRow
                            key={incident.id}
                            hover
                            component={Link}
                            href={`/incidents/${incident.id}`}
                            sx={{
                              backgroundColor:
                                index % 2 === 0
                                  ? 'rgba(248, 250, 252, 0.3)'
                                  : 'white',
                              cursor: 'pointer',
                              textDecoration: 'none',
                              color: 'inherit',
                              '&:hover': {
                                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                                transform: 'translateX(4px)',
                                boxShadow: '4px 0 12px rgba(99, 102, 241, 0.15)',
                                transition: 'all 0.2s ease',
                              },
                              '& .MuiTableCell-root': {
                                borderBottom: '1px solid rgba(224, 224, 224, 0.5)',
                                py: 2,
                              },
                            }}
                          >
                            <TableCell>
                              <Typography variant="body2" fontWeight="600" color="primary">
                                {incident.incident_number || `#${incident.id?.slice(-4)}`}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box>
                                <Typography variant="subtitle2" fontWeight="medium">
                                  {incident.title}
                                </Typography>
                                {incident.description && (
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    noWrap
                                  >
                                    {incident.description.length > 50
                                      ? `${incident.description.substring(0, 50)}...`
                                      : incident.description}
                                  </Typography>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {incident.organization_name}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={incident.status}
                                color={getIncidentStatusColor(incident.status)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={incident.severity}
                                color={getIncidentSeverityColor(incident.severity)}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Box>
                                <Typography variant="body2">
                                  {incident.assigned_to_name || 'Unassigned'}
                                </Typography>
                                {(() => {
                                  const pagingStatus = getPagingStatus(incident);
                                  if (!pagingStatus) return null;
                                  
                                  return (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                      <Tooltip 
                                        title={
                                          <>
                                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                              {pagingStatus.message}
                                            </Typography>
                                            <Typography variant="caption" display="block">
                                              {pagingStatus.timeSinceLastPage < 5 ? 
                                                `Paging now! (sent ${pagingStatus.timeSinceLastPage}m ago)` : 
                                                `Last page sent ${pagingStatus.timeSinceLastPage}m ago`}
                                            </Typography>
                                            <Typography variant="caption" display="block">
                                              Next page in {pagingStatus.timeRemaining} minute{pagingStatus.timeRemaining !== 1 ? 's' : ''}
                                            </Typography>
                                            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                                              Total time: {pagingStatus.totalMinutes}m since incident created
                                            </Typography>
                                          </>
                                        }
                                      >
                                        <Chip
                                          icon={<NotificationsActiveIcon />}
                                          label={pagingStatus.message}
                                          size="small"
                                          color={pagingStatus.status === 'paging-active' ? 'error' : 'warning'}
                                          sx={{
                                            height: '20px',
                                            fontSize: '0.7rem',
                                            '& .MuiChip-icon': {
                                              fontSize: '0.9rem',
                                              animation: pagingStatus.status === 'paging-active' ? 'pulse 0.8s infinite' : 'pulse 2s infinite',
                                            },
                                            '@keyframes pulse': {
                                              '0%': { opacity: 1 },
                                              '50%': { opacity: 0.3 },
                                              '100%': { opacity: 1 },
                                            },
                                          }}
                                        />
                                      </Tooltip>
                                      <Tooltip title={`Next page in ${pagingStatus.timeRemaining} minute${pagingStatus.timeRemaining !== 1 ? 's' : ''}`}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                          <AccessTimeIcon sx={{ fontSize: '0.9rem', color: 'text.secondary' }} />
                                          <Typography variant="caption" color="text.secondary">
                                            {pagingStatus.timeRemaining}m
                                          </Typography>
                                        </Box>
                                      </Tooltip>
                                    </Box>
                                  );
                                })()}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {new Date(incident.created_at).toLocaleDateString()}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Box 
                                sx={{ 
                                  display: 'flex', 
                                  gap: 0.5, 
                                  justifyContent: 'flex-end',
                                  opacity: 0,
                                  transition: 'opacity 0.2s ease',
                                  '.MuiTableRow-hover:hover &': {
                                    opacity: 1,
                                  },
                                }}
                                onClick={(e) => e.preventDefault()}
                              >
                                <Tooltip title="View Details">
                                  <IconButton
                                    size="small"
                                    component={Link}
                                    href={`/incidents/${incident.id}`}
                                    sx={{
                                      backgroundColor: 'primary.main',
                                      color: 'white',
                                      '&:hover': {
                                        backgroundColor: 'primary.dark',
                                      },
                                    }}
                                  >
                                    <VisibilityIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                {incident.status !== 'resolved' && (
                                  <Tooltip title="Mark Resolved">
                                    <IconButton
                                      size="small"
                                      sx={{
                                        backgroundColor: 'success.main',
                                        color: 'white',
                                        '&:hover': {
                                          backgroundColor: 'success.dark',
                                        },
                                      }}
                                      onClick={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        await handleResolveIncident(incident.id);
                                      }}
                                    >
                                      <CheckCircleIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                <Tooltip title="More Actions">
                                  <IconButton
                                    size="small"
                                    sx={{
                                      backgroundColor: 'grey.600',
                                      color: 'white',
                                      '&:hover': {
                                        backgroundColor: 'grey.800',
                                      },
                                    }}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      // TODO: Add more actions menu
                                    }}
                                  >
                                    <MoreVertIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Enhanced Load More */}
            {pagination.hasMore && (
              <Box
                textAlign="center"
                p={3}
                sx={{
                  backgroundColor: 'rgba(248, 250, 252, 0.5)',
                  borderTop: '1px solid rgba(224, 224, 224, 0.5)',
                }}
              >
                <Button
                  variant="outlined"
                  onClick={handleLoadMore}
                  disabled={loading}
                  size="large"
                  sx={{
                    borderRadius: 3,
                    fontWeight: 600,
                    px: 4,
                    py: 1.5,
                    borderWidth: 2,
                    '&:hover': {
                      borderWidth: 2,
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  {loading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={20} />
                      Loading...
                    </Box>
                  ) : (
                    'Load More Incidents'
                  )}
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Enhanced Floating Action Button for Mobile */}
        <Fab
          color="error"
          aria-label="add"
          component={Link}
          href="/incidents/new"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            display: { xs: 'flex', md: 'none' },
            width: 64,
            height: 64,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.4)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
              transform: 'scale(1.1) translateY(-2px)',
              boxShadow: '0 12px 40px rgba(102, 126, 234, 0.5)',
            },
            '&:active': {
              transform: 'scale(1.05) translateY(-1px)',
            },
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <AddIcon sx={{ fontSize: 28 }} />
        </Fab>
      </Box>
    </ProtectedRoute>
  );
}
