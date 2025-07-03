import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';

export default function OrganizationList({ onSelectOrg, onCreateNew }) {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch('/api/organizations')
      .then(res => res.json())
      .then(data => {
        setOrgs(data.organizations || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load organizations.');
        setLoading(false);
      });
  }, []);

  if (loading) return <CircularProgress />;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box width="100%" maxWidth={500}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Your Organizations</Typography>
        {onCreateNew && (
          <Button variant="contained" color="primary" onClick={onCreateNew}>
            Create New
          </Button>
        )}
      </Box>
      {orgs.length === 0 ? (
        <Typography>No organizations found.</Typography>
      ) : (
        <List>
          {orgs.map(org => (
            <ListItem button key={org.id} onClick={() => onSelectOrg && onSelectOrg(org)}>
              <ListItemText
                primary={org.name}
                secondary={org.role ? `Role: ${org.role}` : null}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
} 