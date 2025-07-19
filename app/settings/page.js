'use client';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CreateOrganizationForm from '../../components/CreateOrganizationForm';
import OrganizationMembers from '../../components/OrganizationMembers';
import Button from '@mui/material/Button';
import React, { useState, useEffect } from 'react';
import Alert from '@mui/material/Alert';
import { useOrganization } from '@/contexts/OrganizationContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import AuthorizedDomainsManager from '@/components/AuthorizedDomainsManager';

export default function SettingsPage() {
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const {
    selectedOrganization,
    organizations,
    loading,
    refreshOrganizations,
    selectOrganization,
    session,
  } = useOrganization();

  // Auto-show create org form if user has no organizations (but only after loading is complete)
  useEffect(() => {
    if (!loading && organizations.length === 0 && !showCreateOrg) {
      setShowCreateOrg(true);
    }
  }, [organizations, loading, showCreateOrg]);

  return (
    <ProtectedRoute>
      {/* Show loading state while organizations are being fetched */}
      {loading ? (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
        >
          <Typography>Loading organizations...</Typography>
        </Box>
      ) : (
        <Box sx={{ p: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Settings
          </Typography>

          {/* Organization Management Section */}
          <Box mt={4}>
            <Typography variant="h5" gutterBottom>
              Organizations
            </Typography>

            {/* Show create form if no organizations or explicitly requested */}
            {showCreateOrg ? (
              <CreateOrganizationForm
                onSuccess={async newOrganization => {
                  setShowCreateOrg(false);
                  // Refresh the organization list to include the new org
                  await refreshOrganizations();
                  // Auto-select the newly created organization with owner role
                  if (newOrganization) {
                    selectOrganization({
                      ...newOrganization,
                      role: 'owner', // User who creates org is always the owner
                    });
                  }
                }}
                onBack={() => setShowCreateOrg(false)}
              />
            ) : (
              <>
                {/* Create New Organization Button */}
                <Button
                  variant="outlined"
                  color="primary"
                  sx={{ mb: 3 }}
                  onClick={() => setShowCreateOrg(true)}
                >
                  Create New Organization
                </Button>

                {/* Show current organization info or prompt to select */}
                {!selectedOrganization ? (
                  <Alert severity="info" sx={{ mb: 3 }}>
                    Please select an organization from the navbar to manage its
                    settings and members.
                  </Alert>
                ) : (
                  <>
                    <Alert severity="success" sx={{ mb: 3 }}>
                      Currently managing:{' '}
                      <strong>{selectedOrganization.name}</strong>
                      <br />
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Use the organization selector in the navbar to switch
                        between organizations.
                      </Typography>
                    </Alert>

                    {/* Organization Members Section */}
                    <OrganizationMembers orgId={selectedOrganization.id} />

                    {/* Authorized Domains Section - Only for admins and owners */}
                    {['admin', 'owner'].includes(selectedOrganization.role) && (
                      <Box sx={{ mt: 6 }}>
                        <AuthorizedDomainsManager />
                      </Box>
                    )}
                  </>
                )}
              </>
            )}
          </Box>
        </Box>
      )}
    </ProtectedRoute>
  );
}
