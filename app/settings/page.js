'use client';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CreateOrganizationForm from '../../components/CreateOrganizationForm';
import OrganizationMembers from '../../components/OrganizationMembers';
import Button from '@mui/material/Button';
import React, { useState, useEffect } from 'react';
import Alert from '@mui/material/Alert';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSession } from 'next-auth/react';

export default function SettingsPage() {
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const { selectedOrganization, organizations } = useOrganization();
  const { data: session } = useSession();

  // Auto-show create org form if user has no organizations
  useEffect(() => {
    if (organizations.length === 0 && !showCreateOrg) {
      setShowCreateOrg(true);
    }
  }, [organizations, showCreateOrg]);

  if (!session) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <Typography>Please sign in to access settings.</Typography>
      </Box>
    );
  }

  return (
    <Box maxWidth={700} mx="auto" mt={6} p={3}>
      <Typography variant="h4" gutterBottom>
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
            onSuccess={() => {
              setShowCreateOrg(false);
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
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
