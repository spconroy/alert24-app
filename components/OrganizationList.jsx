import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Box,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

export default function OrganizationList({ onSelectOrg, onCreateNew }) {
  const { data: session } = useSession();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/organizations');
      if (!response.ok) throw new Error('Failed to fetch organizations');
      
      const data = await response.json();
      setOrganizations(data.organizations || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Your Organizations
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onCreateNew}
        >
          Create Organization
        </Button>
      </Box>

      {organizations.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h6" color="textSecondary" align="center" gutterBottom>
              No organizations yet
            </Typography>
            <Typography color="textSecondary" align="center">
              Create your first organization to get started
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {organizations.map((org) => (
            <Grid item xs={12} sm={6} md={4} key={org.id}>
              <Card 
                sx={{ cursor: 'pointer', '&:hover': { boxShadow: 3 } }}
                onClick={() => onSelectOrg(org)}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {org.name}
                  </Typography>
                  <Typography color="textSecondary" gutterBottom>
                    {org.slug}
                  </Typography>
                  {org.domain && (
                    <Chip 
                      label={org.domain} 
                      size="small" 
                      color="primary" 
                      variant="outlined"
                      sx={{ mb: 1 }}
                    />
                  )}
                  <Typography variant="body2" color="textSecondary">
                    Created {new Date(org.created_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
} 