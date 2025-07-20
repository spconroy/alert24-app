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
  Checkbox,
  LinearProgress,
  Tab,
  Tabs,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControlLabel,
} from '@mui/material';
import {
  PersonAdd as InviteIcon,
  Email as EmailIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Schedule as PendingIcon,
  Upload as UploadIcon,
  Settings as BulkIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';

export default function OrganizationMembers({ orgId }) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);

  // Invitation modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'responder',
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  // Bulk operations state
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState('invite'); // 'invite', 'role-change', 'remove'
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [bulkCsvData, setBulkCsvData] = useState('');
  const [bulkRole, setBulkRole] = useState('responder');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkSuccess, setBulkSuccess] = useState('');
  const [bulkProgress, setBulkProgress] = useState(0);
  const [csvPreview, setCsvPreview] = useState([]);

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

  // Parse CSV data for bulk invite
  const parseCsvData = (csvText) => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0]?.toLowerCase().split(',').map(h => h.trim());
    
    if (!headers || headers.length === 0) return [];
    
    const emailIndex = headers.findIndex(h => h.includes('email'));
    const roleIndex = headers.findIndex(h => h.includes('role'));
    const nameIndex = headers.findIndex(h => h.includes('name'));
    
    if (emailIndex === -1) return [];
    
    return lines.slice(1).map((line, index) => {
      const values = line.split(',').map(v => v.trim());
      return {
        id: `csv-${index}`,
        email: values[emailIndex] || '',
        role: values[roleIndex] || 'responder',
        name: values[nameIndex] || '',
        valid: /\S+@\S+\.\S+/.test(values[emailIndex] || '')
      };
    }).filter(row => row.email);
  };

  // Handle CSV input change
  const handleCsvChange = (event) => {
    const csvText = event.target.value;
    setBulkCsvData(csvText);
    
    if (csvText.trim()) {
      const parsed = parseCsvData(csvText);
      setCsvPreview(parsed);
    } else {
      setCsvPreview([]);
    }
  };

  // Bulk invite members
  const handleBulkInvite = async () => {
    if (csvPreview.length === 0) {
      setBulkError('No valid members to invite');
      return;
    }

    const validMembers = csvPreview.filter(m => m.valid);
    if (validMembers.length === 0) {
      setBulkError('No valid email addresses found');
      return;
    }

    setBulkLoading(true);
    setBulkError('');
    setBulkProgress(0);

    try {
      const results = [];
      
      for (let i = 0; i < validMembers.length; i++) {
        const member = validMembers[i];
        
        try {
          const response = await fetch(`/api/organizations/${orgId}/invitations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: member.email,
              role: member.role
            }),
          });

          const data = await response.json();
          results.push({ 
            email: member.email, 
            success: response.ok, 
            error: response.ok ? null : data.error 
          });
        } catch (err) {
          results.push({ 
            email: member.email, 
            success: false, 
            error: err.message 
          });
        }

        setBulkProgress(((i + 1) / validMembers.length) * 100);
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      setBulkSuccess(`Successfully invited ${successful} members${failed > 0 ? `, ${failed} failed` : ''}`);
      
      if (successful > 0) {
        fetchData(); // Refresh the member list
      }

      // Show detailed results if there were failures
      if (failed > 0) {
        const failedEmails = results.filter(r => !r.success).map(r => `${r.email}: ${r.error}`).join('\n');
        setBulkError(`Failed invitations:\n${failedEmails}`);
      }

    } catch (err) {
      setBulkError(`Bulk invite failed: ${err.message}`);
    } finally {
      setBulkLoading(false);
    }
  };

  // Bulk role change
  const handleBulkRoleChange = async () => {
    if (selectedMembers.length === 0) {
      setBulkError('No members selected');
      return;
    }

    setBulkLoading(true);
    setBulkError('');
    setBulkProgress(0);

    try {
      const results = [];
      
      // Process in batches of 10 for the API
      const batchSize = 10;
      for (let i = 0; i < selectedMembers.length; i += batchSize) {
        const batch = selectedMembers.slice(i, i + batchSize);
        
        try {
          const response = await fetch(`/api/organizations/${orgId}/members`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              memberIds: batch, 
              role: bulkRole 
            }),
          });

          const data = await response.json();
          if (response.ok && data.results) {
            results.push(...data.results);
          } else {
            batch.forEach(memberId => {
              results.push({ 
                memberId, 
                success: false, 
                error: data.error || 'Unknown error' 
              });
            });
          }
        } catch (err) {
          batch.forEach(memberId => {
            results.push({ 
              memberId, 
              success: false, 
              error: err.message 
            });
          });
        }

        setBulkProgress(((Math.min(i + batchSize, selectedMembers.length)) / selectedMembers.length) * 100);
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      setBulkSuccess(`Successfully updated ${successful} member roles${failed > 0 ? `, ${failed} failed` : ''}`);
      
      if (successful > 0) {
        fetchData(); // Refresh the member list
        setSelectedMembers([]); // Clear selection
      }

    } catch (err) {
      setBulkError(`Bulk role change failed: ${err.message}`);
    } finally {
      setBulkLoading(false);
    }
  };

  // Bulk remove members
  const handleBulkRemove = async () => {
    if (selectedMembers.length === 0) {
      setBulkError('No members selected');
      return;
    }

    setBulkLoading(true);
    setBulkError('');
    setBulkProgress(0);

    try {
      const results = [];
      
      // Process in batches of 10 for the API
      const batchSize = 10;
      for (let i = 0; i < selectedMembers.length; i += batchSize) {
        const batch = selectedMembers.slice(i, i + batchSize);
        
        try {
          const response = await fetch(`/api/organizations/${orgId}/members?memberIds=${batch.join(',')}`, {
            method: 'DELETE',
          });

          const data = await response.json();
          if (response.ok && data.results) {
            results.push(...data.results);
          } else {
            batch.forEach(memberId => {
              results.push({ 
                memberId, 
                success: false, 
                error: data.error || 'Failed to remove member'
              });
            });
          }
        } catch (err) {
          batch.forEach(memberId => {
            results.push({ 
              memberId, 
              success: false, 
              error: err.message 
            });
          });
        }

        setBulkProgress(((Math.min(i + batchSize, selectedMembers.length)) / selectedMembers.length) * 100);
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      setBulkSuccess(`Successfully removed ${successful} members${failed > 0 ? `, ${failed} failed` : ''}`);
      
      if (successful > 0) {
        fetchData(); // Refresh the member list
        setSelectedMembers([]); // Clear selection
      }

    } catch (err) {
      setBulkError(`Bulk remove failed: ${err.message}`);
    } finally {
      setBulkLoading(false);
    }
  };

  // Handle member selection for bulk operations
  const handleMemberSelection = (memberId, selected) => {
    if (selected) {
      setSelectedMembers(prev => [...prev, memberId]);
    } else {
      setSelectedMembers(prev => prev.filter(id => id !== memberId));
    }
  };

  // Select all members
  const handleSelectAll = (selected) => {
    if (selected) {
      setSelectedMembers(members.map(m => m.id));
    } else {
      setSelectedMembers([]);
    }
  };

  // Generate CSV template
  const downloadCsvTemplate = () => {
    const csvContent = "email,role,name\nexample@company.com,responder,John Doe\nexample2@company.com,admin,Jane Smith";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'member-invite-template.csv';
    link.click();
    window.URL.revokeObjectURL(url);
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
            variant="outlined"
            startIcon={<BulkIcon />}
            onClick={() => setBulkModalOpen(true)}
            size="small"
          >
            Bulk Operations
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

      <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
        <Tab label="Members" />
        <Tab label="Bulk Management" />
      </Tabs>

      {tabValue === 0 && (
        <>
          {/* Active Members */}
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle1">
                  Active Members
                </Typography>
                {selectedMembers.length > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {selectedMembers.length} selected
                  </Typography>
                )}
              </Box>
              {members.length === 0 ? (
                <Typography color="text.secondary">No members found.</Typography>
              ) : (
                <List dense>
                  <ListItem>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedMembers.length === members.length && members.length > 0}
                          indeterminate={selectedMembers.length > 0 && selectedMembers.length < members.length}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                      }
                      label="Select All"
                    />
                  </ListItem>
                  {members.map(member => (
                    <ListItem key={member.id} divider>
                      <Checkbox
                        checked={selectedMembers.includes(member.id)}
                        onChange={(e) => handleMemberSelection(member.id, e.target.checked)}
                        sx={{ mr: 1 }}
                      />
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
              {selectedMembers.length > 0 && (
                <Box mt={2} display="flex" gap={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setBulkMode('role-change');
                      setBulkModalOpen(true);
                    }}
                  >
                    Change Roles ({selectedMembers.length})
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={() => {
                      setBulkMode('remove');
                      setBulkModalOpen(true);
                    }}
                  >
                    Remove ({selectedMembers.length})
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tabValue === 1 && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Bulk Management Tools
            </Typography>
            <Box display="flex" flexDirection="column" gap={2}>
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => {
                  setBulkMode('invite');
                  setBulkModalOpen(true);
                }}
              >
                Bulk Invite Members (CSV)
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={downloadCsvTemplate}
              >
                Download CSV Template
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

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

      {/* Bulk Operations Modal */}
      <Dialog
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {bulkMode === 'invite' && 'Bulk Invite Members'}
          {bulkMode === 'role-change' && 'Bulk Role Change'}
          {bulkMode === 'remove' && 'Bulk Remove Members'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={3} mt={1}>
            {bulkError && (
              <Alert severity="error" sx={{ whiteSpace: 'pre-line' }}>
                {bulkError}
              </Alert>
            )}
            
            {bulkSuccess && <Alert severity="success">{bulkSuccess}</Alert>}

            {bulkLoading && (
              <Box>
                <LinearProgress variant="determinate" value={bulkProgress} />
                <Typography variant="body2" align="center" mt={1}>
                  {Math.round(bulkProgress)}% complete
                </Typography>
              </Box>
            )}

            {bulkMode === 'invite' && (
              <>
                <Alert severity="info">
                  Upload a CSV file with columns: email, role (optional), name (optional).
                  <br />
                  Use the "Download CSV Template" button to get started.
                </Alert>

                <TextField
                  label="CSV Data"
                  multiline
                  rows={8}
                  value={bulkCsvData}
                  onChange={handleCsvChange}
                  fullWidth
                  placeholder="email,role,name&#10;john@company.com,responder,John Doe&#10;jane@company.com,admin,Jane Smith"
                  disabled={bulkLoading}
                />

                {csvPreview.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Preview ({csvPreview.length} members):
                    </Typography>
                    <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Email</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {csvPreview.map((member, index) => (
                            <TableRow key={index}>
                              <TableCell>{member.email}</TableCell>
                              <TableCell>{member.role}</TableCell>
                              <TableCell>{member.name || '-'}</TableCell>
                              <TableCell>
                                <Chip
                                  label={member.valid ? 'Valid' : 'Invalid Email'}
                                  color={member.valid ? 'success' : 'error'}
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}
              </>
            )}

            {bulkMode === 'role-change' && (
              <>
                <Alert severity="info">
                  Change the role for {selectedMembers.length} selected members.
                </Alert>

                <FormControl fullWidth>
                  <InputLabel>New Role</InputLabel>
                  <Select
                    value={bulkRole}
                    label="New Role"
                    onChange={(e) => setBulkRole(e.target.value)}
                    disabled={bulkLoading}
                  >
                    <MenuItem value="stakeholder">Stakeholder</MenuItem>
                    <MenuItem value="responder">Responder</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                  </Select>
                </FormControl>

                <Box p={2} bgcolor="grey.50" borderRadius={1}>
                  <Typography variant="subtitle2" gutterBottom>
                    New Role Permissions:
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ whiteSpace: 'pre-line' }}
                  >
                    {bulkRole === 'admin'
                      ? '• Manage incidents, monitoring, and team members\n• Configure escalation policies and schedules\n• Access all organization settings\n• Cannot modify organization name or delete organization\n• Cannot modify owners'
                      : bulkRole === 'responder'
                        ? '• View all organization data\n• Manage incidents and update service statuses\n• Post status updates and messages\n• Participate in on-call schedules\n• Cannot manage users or organization settings'
                        : '• View non-public status pages\n• Read-only access to incidents and services\n• Cannot make changes to any data\n• Ideal for external stakeholders and observers'}
                  </Typography>
                </Box>
              </>
            )}

            {bulkMode === 'remove' && (
              <>
                <Alert severity="warning">
                  You are about to remove {selectedMembers.length} members from the organization.
                  This action cannot be undone.
                </Alert>

                <Typography variant="body2" color="text.secondary">
                  Members will lose access to:
                </Typography>
                <Typography variant="body2" color="text.secondary" component="ul" sx={{ pl: 2 }}>
                  <li>All organization data and services</li>
                  <li>Incident management capabilities</li>
                  <li>Team memberships and on-call schedules</li>
                  <li>Status page access and notifications</li>
                </Typography>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setBulkModalOpen(false)}
            disabled={bulkLoading}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={
              bulkMode === 'invite'
                ? handleBulkInvite
                : bulkMode === 'role-change'
                  ? handleBulkRoleChange
                  : handleBulkRemove
            }
            disabled={
              bulkLoading ||
              (bulkMode === 'invite' && csvPreview.filter(m => m.valid).length === 0) ||
              (bulkMode !== 'invite' && selectedMembers.length === 0)
            }
            color={bulkMode === 'remove' ? 'error' : 'primary'}
            startIcon={
              bulkLoading ? <CircularProgress size={20} /> : (
                bulkMode === 'invite' ? <EmailIcon /> :
                bulkMode === 'role-change' ? <BulkIcon /> : <DeleteIcon />
              )
            }
          >
            {bulkLoading
              ? 'Processing...'
              : bulkMode === 'invite'
                ? `Invite ${csvPreview.filter(m => m.valid).length} Members`
                : bulkMode === 'role-change'
                  ? `Update ${selectedMembers.length} Members`
                  : `Remove ${selectedMembers.length} Members`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
