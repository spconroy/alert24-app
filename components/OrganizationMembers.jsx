import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';

export default function OrganizationMembers({ orgId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    fetch(`/api/organizations/${orgId}`)
      .then(res => res.json())
      .then(data => {
        setMembers(data.members || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load members.');
        setLoading(false);
      });
  }, [orgId]);

  if (!orgId) return null;
  if (loading) return <CircularProgress />;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box mt={3}>
      <Typography variant="h6" gutterBottom>
        Organization Members
      </Typography>
      {members.length === 0 ? (
        <Typography>No members found.</Typography>
      ) : (
        <List>
          {members.map(member => (
            <ListItem key={member.id}>
              <ListItemText
                primary={member.name || member.email}
                secondary={member.email}
              />
              <Chip label={member.role} color={member.role === 'owner' ? 'primary' : 'default'} size="small" sx={{ ml: 2 }} />
              {!member.is_active && <Chip label="Inactive" color="warning" size="small" sx={{ ml: 1 }} />}
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
} 