import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';

const statusColors = {
  operational: 'success',
  degraded: 'warning', 
  down: 'error',
  maintenance: 'info'
};

const statusLabels = {
  operational: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
  maintenance: 'Maintenance'
};

const ServiceList = forwardRef(function ServiceList({ statusPageId }, ref) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchServices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/services?status_page_id=${statusPageId}`);
      console.log('Services API response:', res.status, res.statusText);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Services API error:', errorData);
        throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      console.log('Services data:', data);
      setServices(data.services || []);
    } catch (err) {
      console.error('Fetch services error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({ 
    fetchServices,
    getServices: () => services 
  }));

  useEffect(() => {
    if (statusPageId) fetchServices();
  }, [statusPageId]);

  return (
    <Box>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && services.length === 0 && (
        <Typography color="text.secondary">
          No services yet. Click the "Add Service" button above to get started.
        </Typography>
      )}
      {!loading && !error && services.length > 0 && (
        <List>
          {services.map((service) => (
            <ListItem key={service.id} divider>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body1">{service.name}</Typography>
                    <Chip 
                      label={statusLabels[service.status]} 
                      color={statusColors[service.status]}
                      size="small"
                    />
                  </Box>
                }
                secondary={service.description}
              />
              {/* TODO: Add edit/delete buttons */}
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
});

export default ServiceList; 