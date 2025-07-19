'use client';

import React, { useState } from 'react';
import { Box, Container, Alert } from '@mui/material';
import ProtectedRoute from '@/components/ProtectedRoute';
import OrganizationList from '@/components/OrganizationList';
import CreateOrganizationForm from '@/components/CreateOrganizationForm';

export default function OrganizationsPage() {
  const [view, setView] = useState('list'); // 'list' or 'create'
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [message, setMessage] = useState(null);

  const handleCreateNew = () => {
    setView('create');
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedOrg(null);
  };

  const handleOrganizationCreated = organization => {
    setMessage(`Organization "${organization.name}" created successfully!`);
    setView('list');
    // Refresh the list by triggering a re-render
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSelectOrganization = organization => {
    setSelectedOrg(organization);
    // For now, just show an alert. Later this could navigate to the org dashboard
    alert(`Selected: ${organization.name}`);
  };

  return (
    <ProtectedRoute>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {message && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {message}
          </Alert>
        )}

        {view === 'list' ? (
          <OrganizationList
            onSelectOrg={handleSelectOrganization}
            onCreateNew={handleCreateNew}
          />
        ) : (
          <CreateOrganizationForm
            onBack={handleBackToList}
            onSuccess={handleOrganizationCreated}
          />
        )}
      </Container>
    </ProtectedRoute>
  );
}
