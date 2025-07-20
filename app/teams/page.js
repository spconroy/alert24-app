'use client';

import { useState, useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
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
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';

export default function TeamsPage() {
  const { selectedOrganization: currentOrganization } = useOrganization();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#0066CC',
  });

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchTeams();
    }
  }, [currentOrganization]);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log(
        '🔍 Fetching teams for organization:',
        currentOrganization?.id
      );

      if (!currentOrganization?.id) {
        throw new Error('No organization selected');
      }

      const response = await fetch(
        `/api/teams?organizationId=${currentOrganization.id}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.details || errorData.error || `HTTP ${response.status}`;
        throw new Error(`Failed to fetch teams: ${errorMessage}`);
      }

      const data = await response.json();
      console.log('✅ Teams fetched successfully:', data?.length || 0);
      setTeams(data);
    } catch (err) {
      console.error('❌ Error fetching teams:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = () => {
    setEditingTeam(null);
    setFormData({ name: '', description: '', color: '#0066CC' });
    setDialogOpen(true);
  };

  const handleEditTeam = team => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description || '',
      color: team.color || '#0066CC',
    });
    setDialogOpen(true);
  };

  const handleSaveTeam = async () => {
    try {
      const teamData = {
        ...formData,
        organizationId: currentOrganization.id,
      };

      const url = editingTeam ? `/api/teams/${editingTeam.id}` : '/api/teams';
      const method = editingTeam ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamData),
      });

      if (!response.ok) throw new Error('Failed to save team');

      setDialogOpen(false);
      fetchTeams();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteTeam = async teamId => {
    if (!confirm('Are you sure you want to delete this team?')) return;

    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete team');
      fetchTeams();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!currentOrganization) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Please select an organization to manage teams.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1">
          Teams
        </Typography>
        {!loading && teams.length > 0 && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateTeam}
          >
            Create Team
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Typography>Loading teams...</Typography>
      ) : teams.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <PeopleIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No teams created yet
            </Typography>
            <Typography color="text.secondary" paragraph>
              Create teams to organize your organization members and manage
              escalation policies.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateTeam}
            >
              Create Your First Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          }}
        >
          {teams.map(team => (
            <Card key={team.id}>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 2,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: team.color || '#0066CC',
                      }}
                    />
                    <Typography variant="h6">{team.name}</Typography>
                  </Box>
                  <Box>
                    <IconButton
                      size="small"
                      onClick={() => handleEditTeam(team)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteTeam(team.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Box>

                {team.description && (
                  <Typography color="text.secondary" sx={{ mb: 2 }}>
                    {team.description}
                  </Typography>
                )}

                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Chip
                    icon={<PeopleIcon />}
                    label={`${team.members?.length || 0} members`}
                    size="small"
                  />
                  <Button
                    size="small"
                    startIcon={<PersonAddIcon />}
                    onClick={() => {
                      /* TODO: Open member management dialog */
                    }}
                  >
                    Manage Members
                  </Button>
                </Box>

                {team.members && team.members.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      Members:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {team.members.slice(0, 3).map(member => (
                        <Chip
                          key={member.user_id}
                          avatar={
                            <Avatar sx={{ width: 24, height: 24 }}>
                              {member.users?.name?.charAt(0)}
                            </Avatar>
                          }
                          label={member.users?.name}
                          size="small"
                        />
                      ))}
                      {team.members.length > 3 && (
                        <Chip
                          label={`+${team.members.length - 3} more`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Create/Edit Team Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingTeam ? 'Edit Team' : 'Create New Team'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Team Name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={e =>
                setFormData({ ...formData, description: e.target.value })
              }
              fullWidth
              multiline
              rows={3}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TextField
                label="Color"
                type="color"
                value={formData.color}
                onChange={e =>
                  setFormData({ ...formData, color: e.target.value })
                }
                sx={{ width: 100 }}
              />
              <Typography variant="body2" color="text.secondary">
                Choose a color to identify this team
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveTeam}
            variant="contained"
            disabled={!formData.name.trim()}
          >
            {editingTeam ? 'Save Changes' : 'Create Team'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
