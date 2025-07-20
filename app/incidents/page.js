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
import ProtectedRoute from '@/components/ProtectedRoute';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  const { session, selectedOrganization } = useOrganization();

  useEffect(() => {
    if (session && selectedOrganization?.id) {
      fetchIncidents();
      fetchOrganizations();
    }
  }, [session, selectedOrganization, filters, pagination.offset]);

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
        return 'info';
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

  const handleLoadMore = () => {
    setPagination(prev => ({
      ...prev,
      offset: prev.offset + prev.limit,
    }));
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
        {/* Enhanced Filters Section */}
        <Card
          sx={{
            mb: 4,
            borderRadius: 3,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.05)',
            background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
            overflow: 'hidden',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '4px',
              background:
                'linear-gradient(90deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
            },
          }}
        >
          <CardContent sx={{ pt: 3, pb: 3 }}>
            <Box display="flex" alignItems="center" gap={2} mb={3}>
              <Box
                sx={{
                  p: 1,
                  borderRadius: 2,
                  backgroundColor: 'primary.main',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FilterListIcon />
              </Box>
              <Typography variant="h5" fontWeight="600" color="text.primary">
                Filters & Search
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

              <Box sx={{ ml: 'auto' }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={clearFilters}
                  disabled={Object.values(filters).every(v => !v)}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 500,
                    borderColor: Object.values(filters).some(v => v)
                      ? 'primary.main'
                      : 'divider',
                    color: Object.values(filters).some(v => v)
                      ? 'primary.main'
                      : 'text.disabled',
                    '&:hover': {
                      backgroundColor: Object.values(filters).some(v => v)
                        ? 'primary.50'
                        : 'transparent',
                    },
                  }}
                >
                  Clear All
                </Button>
              </Box>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    Organization
                  </InputLabel>
                  <Select
                    value={filters.organization_id}
                    label="Organization"
                    onChange={e =>
                      handleFilterChange('organization_id', e.target.value)
                    }
                    renderValue={selected => {
                      if (!selected) return 'All Organizations';
                      const org = organizations.find(o => o.id === selected);
                      return (
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          <BusinessIcon fontSize="small" color="action" />
                          {org?.name || 'Unknown'}
                        </Box>
                      );
                    }}
                  >
                    <MenuItem value="">
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <BusinessIcon fontSize="small" color="action" />
                        All Organizations
                      </Box>
                    </MenuItem>
                    {organizations.map(org => (
                      <MenuItem key={org.id} value={org.id}>
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          <BusinessIcon fontSize="small" color="action" />
                          {org.name}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    label="Status"
                    onChange={e => handleFilterChange('status', e.target.value)}
                    renderValue={selected => {
                      if (!selected) return 'All Statuses';
                      const statusColors = {
                        open: 'error.main',
                        investigating: 'warning.main',
                        monitoring: 'info.main',
                        resolved: 'success.main',
                      };
                      return (
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor:
                                statusColors[selected] || 'action.disabled',
                            }}
                          />
                          {selected.charAt(0).toUpperCase() + selected.slice(1)}
                        </Box>
                      );
                    }}
                  >
                    <MenuItem value="">
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <FlagIcon fontSize="small" color="action" />
                        All Statuses
                      </Box>
                    </MenuItem>
                    <MenuItem value="open">
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: 'error.main',
                          }}
                        />
                        Open
                      </Box>
                    </MenuItem>
                    <MenuItem value="investigating">
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: 'warning.main',
                          }}
                        />
                        Investigating
                      </Box>
                    </MenuItem>
                    <MenuItem value="monitoring">
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: 'info.main',
                          }}
                        />
                        Monitoring
                      </Box>
                    </MenuItem>
                    <MenuItem value="resolved">
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: 'success.main',
                          }}
                        />
                        Resolved
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Severity</InputLabel>
                  <Select
                    value={filters.severity}
                    label="Severity"
                    onChange={e =>
                      handleFilterChange('severity', e.target.value)
                    }
                    renderValue={selected => {
                      if (!selected) return 'All Severities';
                      const severityColors = {
                        critical: 'error',
                        high: 'warning',
                        medium: 'info',
                        low: 'success',
                      };
                      return (
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          <PriorityHighIcon
                            fontSize="small"
                            color={severityColors[selected] || 'action'}
                          />
                          {selected.charAt(0).toUpperCase() + selected.slice(1)}
                        </Box>
                      );
                    }}
                  >
                    <MenuItem value="">
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <PriorityHighIcon fontSize="small" color="action" />
                        All Severities
                      </Box>
                    </MenuItem>
                    <MenuItem value="critical">
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <PriorityHighIcon fontSize="small" color="error" />
                        Critical
                      </Box>
                    </MenuItem>
                    <MenuItem value="high">
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <PriorityHighIcon fontSize="small" color="warning" />
                        High
                      </Box>
                    </MenuItem>
                    <MenuItem value="medium">
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <PriorityHighIcon fontSize="small" color="info" />
                        Medium
                      </Box>
                    </MenuItem>
                    <MenuItem value="low">
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <PriorityHighIcon fontSize="small" color="success" />
                        Low
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search incidents..."
                  value={filters.search}
                  onChange={e => handleFilterChange('search', e.target.value)}
                  placeholder="Search by title, description, or ID"
                  InputProps={{
                    startAdornment: (
                      <SearchIcon
                        fontSize="small"
                        sx={{ mr: 1, color: 'action.active' }}
                      />
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'grey.50',
                      '&:hover': {
                        backgroundColor: 'background.paper',
                      },
                      '&.Mui-focused': {
                        backgroundColor: 'background.paper',
                      },
                    },
                  }}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
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
                      Active Incidents
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    >
                      {incidents.length} incident
                      {incidents.length !== 1 ? 's' : ''} found
                    </Typography>
                  </Box>
                </Box>

                {/* Quick Status Stats */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {['open', 'investigating', 'monitoring', 'resolved'].map(
                    status => {
                      const count = incidents.filter(
                        i => i.status === status
                      ).length;
                      const colors = {
                        open: 'error',
                        investigating: 'warning',
                        monitoring: 'info',
                        resolved: 'success',
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
                      <TableCell>📋 Title</TableCell>
                      <TableCell>🏢 Organization</TableCell>
                      <TableCell>🚩 Status</TableCell>
                      <TableCell>⚠️ Severity</TableCell>
                      <TableCell>👤 Assigned To</TableCell>
                      <TableCell>📅 Created</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {incidents.map((incident, index) => (
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
                          <Typography variant="body2">
                            {incident.assigned_to_name || 'Unassigned'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {new Date(incident.created_at).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
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
