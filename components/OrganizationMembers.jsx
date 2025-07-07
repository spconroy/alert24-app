import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Card,
  CardContent,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  PersonAdd as InviteIcon,
  Email as EmailIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Schedule as PendingIcon,
} from '@mui/icons-material';

export default function OrganizationMembers({ orgId }) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Invitation modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'responder',
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  useEffect(() => {
    if (!orgId) return;
    fetchData();
  }, [orgId]);

  const fetchData = async () => {
    if (!orgId) return;

    setLoading(true);
    try {
      // Fetch members and invitations in parallel
      const [membersRes, invitationsRes] = await Promise.all([
        fetch(`/api/organizations/${orgId}`),
        fetch(`/api/organizations/${orgId}/invitations`),
      ]);

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.members || []);
      }

      if (invitationsRes.ok) {
        const invitationsData = await invitationsRes.json();
        setInvitations(invitationsData.invitations || []);
      }
    } catch (err) {
      setError('Failed to load organization data.');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteSubmit = async () => {
    if (!inviteForm.email) {
      setInviteError('Email is required');
      return;
    }

    setInviteLoading(true);
    setInviteError('');

    try {
      const response = await fetch(`/api/organizations/${orgId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      setInviteSuccess(`Invitation sent to ${inviteForm.email}`);
      setInviteForm({ email: '', role: 'responder' });

      // Refresh data
      fetchData();

      // Close modal after brief delay
      setTimeout(() => {
        setInviteModalOpen(false);
        setInviteSuccess('');
      }, 2000);
    } catch (err) {
      setInviteError(err.message);
    } finally {
      setInviteLoading(false);
    }
  };

  const formatDate = dateString => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!orgId) return null;
  if (loading) return <CircularProgress />;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box mt={3}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Typography variant="h6">Team Members ({members.length})</Typography>
        <Box display="flex" gap={1}>
          <Button startIcon={<RefreshIcon />} onClick={fetchData} size="small">
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<InviteIcon />}
            onClick={() => setInviteModalOpen(true)}
          >
            Invite Member
          </Button>
        </Box>
      </Box>

      {/* Active Members */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Active Members
          </Typography>
          {members.length === 0 ? (
            <Typography color="text.secondary">No members found.</Typography>
          ) : (
            <List dense>
              {members.map(member => (
                <ListItem key={member.id} divider>
                  <ListItemText
                    primary={member.name || member.email}
                    secondary={member.email}
                  />
                  <Box display="flex" gap={1}>
                    <Chip
                      label={member.role}
                      color={
                        member.role === 'owner'
                          ? 'primary'
                          : member.role === 'admin'
                            ? 'secondary'
                            : 'default'
                      }
                      size="small"
                    />
                    {!member.is_active && (
                      <Chip label="Inactive" color="warning" size="small" />
                    )}
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Pending Invitations ({invitations.length})
            </Typography>
            <List dense>
              {invitations.map(invitation => (
                <ListItem key={invitation.id} divider>
                  <PendingIcon sx={{ mr: 2, color: 'warning.main' }} />
                  <ListItemText
                    primary={invitation.email}
                    secondary={`Invited ${formatDate(invitation.invited_at)} • Expires ${formatDate(invitation.invitation_expires_at)}`}
                  />
                  <Box display="flex" gap={1} alignItems="center">
                    <Chip
                      label={invitation.role}
                      size="small"
                      color="default"
                      variant="outlined"
                    />
                    <Tooltip title="Copy invitation link">
                      <IconButton
                        size="small"
                        onClick={() => {
                          const link = `${window.location.origin}/accept-invitation?token=${invitation.invitation_token}`;
                          navigator.clipboard.writeText(link);
                          // You could add a toast notification here
                        }}
                      >
                        <EmailIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Invite Member Modal */}
      <Dialog
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Invite Team Member</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={3} mt={1}>
            {inviteError && <Alert severity="error">{inviteError}</Alert>}

            {inviteSuccess && <Alert severity="success">{inviteSuccess}</Alert>}

            <TextField
              label="Email Address"
              type="email"
              value={inviteForm.email}
              onChange={e =>
                setInviteForm(prev => ({ ...prev, email: e.target.value }))
              }
              fullWidth
              required
              placeholder="colleague@company.com"
              disabled={inviteLoading}
            />

            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={inviteForm.role}
                label="Role"
                onChange={e =>
                  setInviteForm(prev => ({ ...prev, role: e.target.value }))
                }
                disabled={inviteLoading}
              >
                <MenuItem value="stakeholder">Stakeholder</MenuItem>
                <MenuItem value="responder">Responder</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>

            <Box p={2} bgcolor="grey.50" borderRadius={1}>
              <Typography variant="subtitle2" gutterBottom>
                Role Permissions:
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ whiteSpace: 'pre-line' }}
              >
                {inviteForm.role === 'admin'
                  ? '• Manage incidents, monitoring, and team members\n• Configure escalation policies and schedules\n• Access all organization settings\n• Cannot modify organization name or delete organization\n• Cannot modify owners'
                  : inviteForm.role === 'responder'
                    ? '• View all organization data\n• Manage incidents and update service statuses\n• Post status updates and messages\n• Participate in on-call schedules\n• Cannot manage users or organization settings'
                    : '• View non-public status pages\n• Read-only access to incidents and services\n• Cannot make changes to any data\n• Ideal for external stakeholders and observers'}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setInviteModalOpen(false)}
            disabled={inviteLoading}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleInviteSubmit}
            disabled={inviteLoading}
            startIcon={
              inviteLoading ? <CircularProgress size={20} /> : <EmailIcon />
            }
          >
            {inviteLoading ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
