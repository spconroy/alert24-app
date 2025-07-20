'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Alert,
  Tooltip,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Security as SecurityIcon,
  Domain as DomainIcon,
  Group as GroupIcon,
  Verified as VerifiedIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function AuthorizedDomainsManager() {
  const { selectedOrganization, session } = useOrganization();

  // State management
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    domain: '',
    description: '',
    autoRole: 'member',
    maxAutoEnrollments: '',
    requireVerification: true,
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch domains when component mounts or organization changes
  useEffect(() => {
    if (selectedOrganization?.id) {
      fetchDomains();
    }
  }, [selectedOrganization]);

  const fetchDomains = async () => {
    if (!selectedOrganization?.id) return;

    try {
      setLoading(true);
      setError('');

      const response = await fetch(
        `/api/authorized-domains?organizationId=${selectedOrganization.id}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || 'Failed to fetch authorized domains'
        );
      }

      const data = await response.json();
      setDomains(data.domains || []);
    } catch (err) {
      console.error('Error fetching domains:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDomain = () => {
    setEditingDomain(null);
    setFormData({
      domain: '',
      description: '',
      autoRole: 'member',
      maxAutoEnrollments: '',
      requireVerification: true,
      isActive: true,
    });
    setDialogOpen(true);
  };

  const handleEditDomain = domain => {
    setEditingDomain(domain);
    setFormData({
      domain: domain.domain,
      description: domain.description || '',
      autoRole: domain.auto_role,
      maxAutoEnrollments: domain.max_auto_enrollments || '',
      requireVerification: domain.require_verification,
      isActive: domain.is_active,
    });
    setDialogOpen(true);
  };

  const handleDeleteClick = domain => {
    setDomainToDelete(domain);
    setDeleteDialogOpen(true);
  };

  const handleFormSubmit = async () => {
    if (!formData.domain) {
      setError('Domain is required');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      const url = editingDomain
        ? `/api/authorized-domains/${editingDomain.id}`
        : '/api/authorized-domains';

      const method = editingDomain ? 'PUT' : 'POST';

      const payload = {
        organizationId: selectedOrganization.id,
        domain: formData.domain,
        description: formData.description,
        autoRole: formData.autoRole,
        maxAutoEnrollments: formData.maxAutoEnrollments
          ? parseInt(formData.maxAutoEnrollments)
          : null,
        requireVerification: formData.requireVerification,
        isActive: formData.isActive,
      };

      console.log('Sending authorized domain payload:', payload);
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(
          errorData.error ||
            `Failed to ${editingDomain ? 'update' : 'create'} domain`
        );
      }

      setSuccess(
        `Domain ${editingDomain ? 'updated' : 'created'} successfully`
      );
      setDialogOpen(false);
      fetchDomains();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving domain:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!domainToDelete) return;

    try {
      setSubmitting(true);
      setError('');

      const response = await fetch(
        `/api/authorized-domains/${domainToDelete.id}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete domain');
      }

      setSuccess('Domain deleted successfully');
      setDeleteDialogOpen(false);
      setDomainToDelete(null);
      fetchDomains();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting domain:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatEnrollmentCount = (current, max) => {
    if (max === null || max === undefined) {
      return `${current} (unlimited)`;
    }
    return `${current} / ${max}`;
  };

  if (!selectedOrganization) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary">
            Please select an organization to manage authorized domains.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <SecurityIcon color="primary" />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Authorized Domains
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Whitelist email domains to automatically enroll users from your
          organization
        </Typography>

        {/* Info box */}
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>How it works:</strong> When users sign in with Google using
            an email from an authorized domain, they&apos;ll automatically be
            added to this organization with the specified role. This is perfect
            for enterprise customers who want streamlined onboarding for their
            team members.
          </Typography>
        </Alert>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Main content */}
      <Card>
        <CardContent>
          {/* Actions bar */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 3,
            }}
          >
            <Typography variant="h6">
              Authorized Domains for {selectedOrganization.name}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddDomain}
              disabled={loading}
            >
              Add Domain
            </Button>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Domains table */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : domains.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <DomainIcon
                sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }}
              />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Authorized Domains
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Add your first authorized domain to enable automatic user
                enrollment.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddDomain}
              >
                Add Your First Domain
              </Button>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Domain</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Auto Role</TableCell>
                    <TableCell>Enrollments</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created By</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {domains.map(domain => (
                    <TableRow key={domain.id}>
                      <TableCell>
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          <DomainIcon fontSize="small" color="primary" />
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: 'monospace', fontWeight: 500 }}
                          >
                            {domain.domain}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {domain.description || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={domain.auto_role}
                          color={
                            domain.auto_role === 'admin' ? 'error' : 
                            domain.auto_role === 'responder' ? 'warning' : 'primary'
                          }
                          size="small"
                          icon={<GroupIcon />}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatEnrollmentCount(
                            domain.current_enrollments,
                            domain.max_auto_enrollments
                          )}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.5,
                          }}
                        >
                          <Chip
                            label={domain.is_active ? 'Active' : 'Inactive'}
                            color={domain.is_active ? 'success' : 'default'}
                            size="small"
                          />
                          {domain.require_verification && (
                            <Chip
                              label="Verification Required"
                              color="info"
                              size="small"
                              icon={<VerifiedIcon />}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {domain.created_by_user?.name}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Edit Domain">
                            <IconButton
                              size="small"
                              onClick={() => handleEditDomain(domain)}
                              color="primary"
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Domain">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteClick(domain)}
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
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingDomain ? 'Edit Authorized Domain' : 'Add Authorized Domain'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Domain"
              placeholder="company.com"
              value={formData.domain}
              onChange={e =>
                setFormData({ ...formData, domain: e.target.value })
              }
              margin="normal"
              helperText="Enter the email domain to authorize (e.g., company.com)"
            />

            <TextField
              fullWidth
              label="Description"
              placeholder="Optional description for this domain"
              value={formData.description}
              onChange={e =>
                setFormData({ ...formData, description: e.target.value })
              }
              margin="normal"
              multiline
              rows={2}
            />

            <FormControl fullWidth margin="normal">
              <InputLabel>Auto-assigned Role</InputLabel>
              <Select
                value={formData.autoRole}
                onChange={e =>
                  setFormData({ ...formData, autoRole: e.target.value })
                }
                label="Auto-assigned Role"
              >
                <MenuItem value="member">Member</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Max Auto-enrollments"
              placeholder="Leave empty for unlimited"
              type="number"
              value={formData.maxAutoEnrollments}
              onChange={e =>
                setFormData({ ...formData, maxAutoEnrollments: e.target.value })
              }
              margin="normal"
              helperText="Maximum number of users that can be auto-enrolled (optional)"
            />

            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.requireVerification}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        requireVerification: e.target.checked,
                      })
                    }
                  />
                }
                label="Require Email Verification"
              />
            </Box>

            <Box sx={{ mt: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={e =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                  />
                }
                label="Active"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleFormSubmit}
            variant="contained"
            disabled={submitting || !formData.domain}
          >
            {submitting ? (
              <CircularProgress size={20} />
            ) : editingDomain ? (
              'Update'
            ) : (
              'Add'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
      >
        <DialogTitle>Delete Authorized Domain</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the authorized domain{' '}
            <strong>{domainToDelete?.domain}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone. Users from this domain will no longer
            be automatically enrolled in your organization.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
