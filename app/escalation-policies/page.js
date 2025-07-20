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
  Fade,
  Slide,
  Badge,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function EscalationPoliciesPage() {
  const [escalationPolicies, setEscalationPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { session, selectedOrganization } = useOrganization();

  useEffect(() => {
    if (session && selectedOrganization?.id) {
      fetchEscalationPolicies();
    }
  }, [session, selectedOrganization]);

  const fetchEscalationPolicies = async () => {
    try {
      setLoading(true);
      setError(null);

      // Safety check: Don't proceed without organization
      if (!selectedOrganization?.id) {
        console.log(
          '⚠️ No organization selected, skipping escalation policies fetch'
        );
        setEscalationPolicies([]);
        return;
      }

      const params = new URLSearchParams();
      params.append('organization_id', selectedOrganization.id);

      console.log(
        `🔄 Fetching escalation policies for org: ${selectedOrganization.id}`
      );
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
      const response = await fetch(`/api/escalation-policies?id=${policyId}`, {
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Typography variant="h4" component="h1">
                Escalation Policies
              </Typography>
              {escalationPolicies.length > 0 && (
                <Badge badgeContent={escalationPolicies.length} color="primary">
                  <Chip
                    label={`${escalationPolicies.length} Active`}
                    color="success"
                    size="small"
                  />
                </Badge>
              )}
            </Box>
            <Typography variant="body1" color="text.secondary">
              Manage how incidents are escalated through your team
            </Typography>
            {/* Gamification: Setup progress */}
            {escalationPolicies.length === 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  🎯 Setup Progress: Step 2 of 5 complete • Add escalation
                  policies to ensure no incidents are missed
                </Typography>
              </Box>
            )}
          </Box>
          <Box display="flex" gap={2}>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchEscalationPolicies} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {/* Only show header create button when policies exist */}
            {escalationPolicies.length > 0 && (
              <Button
                component={Link}
                href="/escalation-policies/new"
                variant="contained"
                startIcon={<AddIcon />}
                color="primary"
              >
                Create Policy
              </Button>
            )}
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
          <Card
            sx={{
              backgroundColor: 'grey.50',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
            }}
          >
            <CardContent sx={{ textAlign: 'center', py: 6, px: 4 }}>
              <AccountTreeIcon
                sx={{ fontSize: 64, color: 'primary.main', mb: 2 }}
              />
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                No Escalation Policies Yet
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mb: 2, maxWidth: 600, mx: 'auto' }}
              >
                <strong>
                  Escalation policies help you route unresolved incidents to the
                  right people
                </strong>
                —automatically escalating based on time or severity. They ensure
                no critical issue goes unnoticed.
              </Typography>

              {/* Info box with example */}
              <Box
                sx={{
                  backgroundColor: 'info.50',
                  border: '1px solid',
                  borderColor: 'info.200',
                  borderRadius: 2,
                  p: 2,
                  mb: 3,
                  maxWidth: 500,
                  mx: 'auto',
                  textAlign: 'left',
                }}
              >
                <Typography variant="subtitle2" color="info.main" gutterBottom>
                  💡 Example Policy:
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  1. Notify on-call engineer immediately
                  <br />
                  2. Escalate to team lead after 15 minutes
                  <br />
                  3. Escalate to manager after 1 hour
                </Typography>
              </Box>

              {/* Action buttons */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 2,
                  flexWrap: 'wrap',
                }}
              >
                <Button
                  component={Link}
                  href="/escalation-policies/new"
                  variant="contained"
                  size="large"
                  startIcon={<AddIcon />}
                  sx={{ px: 4 }}
                >
                  Create Your First Policy
                </Button>
                <Button
                  component={Link}
                  href="/escalation-policies/new?template=recommended"
                  variant="outlined"
                  size="large"
                  startIcon={<AutoAwesomeIcon />}
                  sx={{ px: 3 }}
                >
                  Use Recommended Template
                </Button>
              </Box>

              {/* Help link */}
              <Box sx={{ mt: 3 }}>
                <Button
                  startIcon={<HelpOutlineIcon />}
                  size="small"
                  color="info"
                  sx={{ textTransform: 'none' }}
                >
                  What is an Escalation Policy?
                </Button>
              </Box>

              {/* Tip */}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 2, fontStyle: 'italic' }}
              >
                💡 Tip: You can assign multiple steps to an escalation policy to
                ensure incidents are never missed.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Box>
            {/* Help tip for existing policies */}
            <Alert
              severity="info"
              sx={{ mb: 3, display: { xs: 'none', md: 'flex' } }}
            >
              <Typography variant="body2">
                <strong>💡 Pro tip:</strong> You can create multiple escalation
                policies for different types of incidents (critical vs. low
                priority) and assign them to specific services or teams.
              </Typography>
            </Alert>

            <TableContainer
              component={Paper}
              sx={{
                overflowX: 'auto',
                '& .MuiTable-root': {
                  minWidth: { xs: 650, md: 'auto' },
                },
              }}
            >
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell
                      sx={{ display: { xs: 'none', sm: 'table-cell' } }}
                    >
                      Description
                    </TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Steps</TableCell>
                    <TableCell
                      sx={{ display: { xs: 'none', md: 'table-cell' } }}
                    >
                      Created
                    </TableCell>
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
                      <TableCell
                        sx={{ display: { xs: 'none', sm: 'table-cell' } }}
                      >
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
                      <TableCell
                        sx={{ display: { xs: 'none', md: 'table-cell' } }}
                      >
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
          </Box>
        )}

        {/* Floating Action Button for mobile - only when policies exist */}
        {escalationPolicies.length > 0 && (
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
        )}

        {/* Floating Help Sidebar - Large screens only */}
        <Fade in={true}>
          <Card
            sx={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              width: 320,
              display: { xs: 'none', lg: 'block' },
              boxShadow: 6,
              border: '1px solid',
              borderColor: 'primary.light',
            }}
          >
            <CardContent sx={{ p: 2 }}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
              >
                <HelpOutlineIcon color="primary" fontSize="small" />
                <Typography
                  variant="subtitle2"
                  color="primary"
                  sx={{ fontWeight: 600 }}
                >
                  Need help creating policies?
                </Typography>
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 2 }}
              >
                Escalation policies ensure incidents reach the right person at
                the right time.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  📖 View Examples
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  🎥 Watch Tutorial
                </Button>
                <Button
                  component={Link}
                  href="/escalation-policies/new?template=recommended"
                  size="small"
                  variant="contained"
                  fullWidth
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  ⚡ Quick Setup
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Fade>
      </Box>
    </ProtectedRoute>
  );
}
