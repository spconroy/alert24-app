import React, { useState, useRef } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ServiceList from './ServiceList';
import CreateServiceForm from './CreateServiceForm';
import EditStatusPageForm from './EditStatusPageForm';
import StatusPageOverallStatus from './StatusPageOverallStatus';

export default function StatusPageServices({
  statusPage,
  onStatusPageUpdated,
}) {
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [editFormOpen, setEditFormOpen] = useState(false);
  const serviceListRef = useRef();

  const handleServiceCreated = async newService => {
    console.log('Service created, refreshing list:', newService);

    // Check if this was the first service added
    if (serviceListRef.current) {
      const currentServices = serviceListRef.current.getServices?.() || [];
      console.log(
        'Current services count before refresh:',
        currentServices.length
      );

      // If we had 0 services before and now adding the first one, do a full page reload
      if (currentServices.length === 0) {
        console.log(
          '🔄 First service added, doing full page reload in 500ms...'
        );
        // Small delay to ensure the service creation API call completes
        setTimeout(() => {
          window.location.reload();
        }, 500);
        return;
      } else {
        console.log(
          '📋 Additional service added, just refreshing service list...'
        );
      }
    }

    // Otherwise just refresh the service list
    serviceListRef.current?.fetchServices();
  };

  const handleStatusPageUpdated = updatedStatusPage => {
    // Call the parent callback if provided
    if (onStatusPageUpdated) {
      onStatusPageUpdated(updatedStatusPage);
    }
  };

  if (!statusPage) {
    return (
      <Typography color="text.secondary">
        Select a status page to manage its services.
      </Typography>
    );
  }

  return (
    <Box>
      {/* Status Page Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          mb={2}
        >
          <Box>
            <Typography variant="h5" gutterBottom>
              {statusPage.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Slug: {statusPage.slug}
            </Typography>
            {statusPage.description && (
              <Typography variant="body1" color="text.secondary" gutterBottom>
                {statusPage.description}
              </Typography>
            )}
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip
              label={statusPage.is_public ? 'Public' : 'Private'}
              color={statusPage.is_public ? 'success' : 'default'}
              size="small"
            />
            {statusPage.is_public && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<OpenInNewIcon />}
                onClick={() =>
                  window.open(`/status/${statusPage.slug}`, '_blank')
                }
                sx={{ minWidth: 'auto' }}
              >
                View Public Page
              </Button>
            )}
            <IconButton
              onClick={() => setEditFormOpen(true)}
              size="small"
              color="primary"
            >
              <EditIcon />
            </IconButton>
          </Box>
        </Box>
      </Paper>

      {/* Overall Status */}
      <Box sx={{ mb: 3 }}>
        <StatusPageOverallStatus statusPageId={statusPage.id} />
      </Box>

      {/* Services Section */}
      <Paper sx={{ p: 3 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6">Services</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateFormOpen(true)}
          >
            Add Service
          </Button>
        </Box>

        <Divider sx={{ mb: 2 }} />

        <ServiceList statusPageId={statusPage.id} ref={serviceListRef} />
      </Paper>

      {/* Create Service Dialog */}
      <CreateServiceForm
        open={createFormOpen}
        onClose={() => setCreateFormOpen(false)}
        statusPageId={statusPage.id}
        onServiceCreated={handleServiceCreated}
      />

      {/* Edit Status Page Dialog */}
      <EditStatusPageForm
        open={editFormOpen}
        onClose={() => setEditFormOpen(false)}
        statusPage={statusPage}
        onStatusPageUpdated={handleStatusPageUpdated}
      />
    </Box>
  );
}
