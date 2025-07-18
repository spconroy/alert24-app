'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Fab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import EscalatorWarningIcon from '@mui/icons-material/EscalatorWarning';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function EscalationPoliciesPage() {
  const [escalationPolicies, setEscalationPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { session, selectedOrganization } = useOrganization();

  useEffect(() => {
    if (session && selectedOrganization) {
      fetchEscalationPolicies();
    }
  }, [session, selectedOrganization]);

  const fetchEscalationPolicies = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedOrganization?.id) {
        params.append('organization_id', selectedOrganization.id);
      }

      const response = await fetch(
        `/api/escalation-policies?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch escalation policies');
      }

      const data = await response.json();
      setEscalationPolicies(data.escalation_policies || []);
    } catch (err) {
      console.error('Error fetching escalation policies:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async policyId => {
    if (!confirm('Are you sure you want to delete this escalation policy?')) {
      return;
    }

    try {
      const response = await fetch(`/api/escalation-policies/${policyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete escalation policy');
      }

      // Refresh the list
      fetchEscalationPolicies();
    } catch (err) {
      console.error('Error deleting escalation policy:', err);
      setError(err.message);
    }
  };

  const formatDateTime = dateString => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = isActive => {
    return isActive ? 'success' : 'default';
  };

  const getStatusLabel = isActive => {
    return isActive ? 'Active' : 'Inactive';
  };

  if (!session) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="200px"
      >
        <CircularProgress />
      </Box>
    );
  }

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
              Escalation Policies
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage how incidents are escalated through your team
            </Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchEscalationPolicies} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              component={Link}
              href="/escalation-policies/new"
              variant="contained"
              startIcon={<AddIcon />}
              color="primary"
            >
              Create Policy
            </Button>
          </Box>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Content */}
        {loading ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight="400px"
          >
            <CircularProgress />
          </Box>
        ) : escalationPolicies.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <EscalatorWarningIcon
                sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }}
              />
              <Typography variant="h6" gutterBottom>
                No Escalation Policies Found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Create your first escalation policy to automatically escalate
                incidents when they're not resolved in time.
              </Typography>
              <Button
                component={Link}
                href="/escalation-policies/new"
                variant="contained"
                startIcon={<AddIcon />}
              >
                Create First Policy
              </Button>
            </CardContent>
          </Card>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Escalation Steps</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {escalationPolicies.map(policy => (
                  <TableRow key={policy.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="medium">
                        {policy.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {policy.description || 'No description'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(policy.is_active)}
                        color={getStatusColor(policy.is_active)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {policy.escalation_rules?.length || 0} step(s)
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDateTime(policy.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box display="flex" gap={1} justifyContent="flex-end">
                        <Tooltip title="View Details">
                          <IconButton
                            component={Link}
                            href={`/escalation-policies/${policy.id}`}
                            size="small"
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            component={Link}
                            href={`/escalation-policies/${policy.id}/edit`}
                            size="small"
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            onClick={() => handleDelete(policy.id)}
                            size="small"
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Floating Action Button for mobile */}
        <Fab
          color="primary"
          aria-label="add"
          component={Link}
          href="/escalation-policies/new"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            display: { xs: 'flex', sm: 'none' },
          }}
        >
          <AddIcon />
        </Fab>
      </Box>
    </ProtectedRoute>
  );
}
