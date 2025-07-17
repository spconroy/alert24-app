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

  const { session } = useOrganization();

  useEffect(() => {
    if (session) {
      fetchIncidents();
      fetchOrganizations();
    }
  }, [session, filters, pagination.offset]);

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

      const params = new URLSearchParams();

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
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <FilterListIcon color="action" />
              <Typography variant="h6">Filters</Typography>
              <Button variant="text" size="small" onClick={clearFilters}>
                Clear All
              </Button>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Organization</InputLabel>
                  <Select
                    value={filters.organization_id}
                    label="Organization"
                    onChange={e =>
                      handleFilterChange('organization_id', e.target.value)
                    }
                  >
                    <MenuItem value="">All Organizations</MenuItem>
                    {organizations.map(org => (
                      <MenuItem key={org.id} value={org.id}>
                        {org.name}
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
                  >
                    <MenuItem value="">All Status</MenuItem>
                    <MenuItem value="open">Open</MenuItem>
                    <MenuItem value="investigating">Investigating</MenuItem>
                    <MenuItem value="monitoring">Monitoring</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
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
                  >
                    <MenuItem value="">All Severities</MenuItem>
                    <MenuItem value="critical">Critical</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
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
              <Box textAlign="center" py={6}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No incidents found
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  {Object.values(filters).some(v => v)
                    ? 'Try adjusting your filters or create a new incident.'
                    : 'Create your first incident to get started.'}
                </Typography>
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
