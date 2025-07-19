import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteOrganizationModal from './DeleteOrganizationModal';

export default function OrganizationList({
  onSelectOrg,
  onCreateNew,
  onOrgsLoaded,
  selectedOrg,
}) {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState(null);

  const fetchOrganizations = () => {
    setLoading(true);
    fetch('/api/organizations')
      .then(res => res.json())
      .then(data => {
        const organizations = data.organizations || [];
        setOrgs(organizations);
        setLoading(false);
        // Notify parent about loaded organizations
        if (onOrgsLoaded) {
          onOrgsLoaded(organizations);
        }
      })
      .catch(() => {
        setError('Failed to load organizations.');
        setLoading(false);
        // Notify parent that orgs failed to load
        if (onOrgsLoaded) {
          onOrgsLoaded([]);
        }
      });
  };

  useEffect(() => {
    fetchOrganizations();
  }, [onOrgsLoaded]);

  const handleDeleteClick = (org, event) => {
    event.stopPropagation(); // Prevent org selection when clicking delete
    setOrgToDelete(org);
    setDeleteModalOpen(true);
  };

  const handleSelectChange = event => {
    const orgId = event.target.value;
    const selectedOrganization = orgs.find(org => org.id === orgId);
    if (selectedOrganization && onSelectOrg) {
      onSelectOrg(selectedOrganization);
    }
  };

  const handleOrganizationDeleted = deletedOrg => {
    // Remove from list and refresh
    setOrgs(prev => prev.filter(org => org.id !== deletedOrg.id));
    // Refresh the full list to be safe
    fetchOrganizations();
  };

  if (loading) return <CircularProgress />;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box width="100%" maxWidth={500}>
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <FormControl fullWidth>
          <InputLabel>Select Organization</InputLabel>
          <Select
            value={selectedOrg?.id || ''}
            onChange={handleSelectChange}
            label="Select Organization"
            disabled={orgs.length === 0}
          >
            {orgs.map(org => (
              <MenuItem key={org.id} value={org.id}>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  width="100%"
                >
                  <Box>
                    <Typography variant="body1">{org.name}</Typography>
                    {org.role && (
                      <Typography variant="caption" color="text.secondary">
                        Role: {org.role}
                      </Typography>
                    )}
                  </Box>
                  {org.role === 'owner' && (
                    <IconButton
                      size="small"
                      color="error"
                      onClick={e => handleDeleteClick(org, e)}
                      title="Delete Organization"
                      sx={{ ml: 1 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {onCreateNew && (
          <Button
            variant="contained"
            color="primary"
            onClick={onCreateNew}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Create New
          </Button>
        )}
      </Box>

      {orgs.length === 0 && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          No organizations found. Create one to get started.
        </Typography>
      )}

      {/* Delete Organization Modal */}
      <DeleteOrganizationModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        organization={orgToDelete}
        onOrganizationDeleted={handleOrganizationDeleted}
      />
    </Box>
  );
}
