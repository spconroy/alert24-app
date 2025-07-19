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
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
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
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={4}
        >
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Incidents
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage and track all incidents across your organizations
            </Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchIncidents} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {/* Only show create button when there are incidents */}
            {incidents.length > 0 && (
              <Button
                component={Link}
                href="/incidents/new"
                variant="outlined"
                startIcon={<AddIcon />}
                color="primary"
              >
                Create Incident
              </Button>
            )}
          </Box>
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <FilterListIcon color="action" />
              <Typography variant="h6">Filters</Typography>

              {/* Active filter count indicator */}
              {Object.values(filters).filter(v => v).length > 0 && (
                <Chip
                  label={`${Object.values(filters).filter(v => v).length} active`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}

              <Box sx={{ ml: 'auto' }}>
                <Button
                  variant="text"
                  size="small"
                  onClick={clearFilters}
                  disabled={Object.values(filters).every(v => !v)}
                  sx={{
                    color: Object.values(filters).some(v => v)
                      ? 'primary.main'
                      : 'text.disabled',
                  }}
                >
                  Clear All
                </Button>
              </Box>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
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

              <Grid item xs={12} md={2}>
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

              <Grid item xs={12} md={2}>
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

              <Grid item xs={12} md={5}>
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

        {/* Incidents Table */}
        <Card>
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
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Title</TableCell>
                      <TableCell>Organization</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Severity</TableCell>
                      <TableCell>Assigned To</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {incidents.map(incident => (
                      <TableRow key={incident.id} hover>
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
                        <TableCell align="right">
                          <Tooltip title="View Details">
                            <IconButton
                              component={Link}
                              href={`/incidents/${incident.id}`}
                              size="small"
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton
                              component={Link}
                              href={`/incidents/${incident.id}/edit`}
                              size="small"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Load More */}
            {pagination.hasMore && (
              <Box textAlign="center" p={2}>
                <Button
                  variant="outlined"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={20} /> : 'Load More'}
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Floating Action Button for Mobile */}
        <Fab
          color="error"
          aria-label="add"
          component={Link}
          href="/incidents/new"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            display: { xs: 'flex', md: 'none' },
          }}
        >
          <AddIcon />
        </Fab>
      </Box>
    </ProtectedRoute>
  );
}
