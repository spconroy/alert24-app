'use client';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import OrganizationList from '../../components/OrganizationList';
import CreateOrganizationForm from '../../components/CreateOrganizationForm';
import Button from '@mui/material/Button';
import React, { useState } from 'react';

export default function SettingsPage() {
  const [showCreateOrg, setShowCreateOrg] = useState(false);

  return (
    <Box maxWidth={700} mx="auto" mt={6} p={3}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <Box mt={4}>
        <Typography variant="h5" gutterBottom>
          Organizations
        </Typography>
        {showCreateOrg ? (
          <CreateOrganizationForm onSuccess={() => { setShowCreateOrg(false); window.location.reload(); }} onBack={() => setShowCreateOrg(false)} />
        ) : (
          <OrganizationList onCreateNew={() => setShowCreateOrg(true)} />
        )}
      </Box>
    </Box>
  );
} 