'use client';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import React, { useState, useRef } from 'react';
import StatusPageList from '../../components/StatusPageList';
import CreateStatusPageForm from '../../components/CreateStatusPageForm';
import StatusPageServices from '../../components/StatusPageServices';
import Alert from '@mui/material/Alert';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSession } from 'next-auth/react';

export default function StatusPagesPage() {
  const [selectedStatusPage, setSelectedStatusPage] = useState(null);
  const [showCreateStatusPage, setShowCreateStatusPage] = useState(false);
  const statusPageListRef = useRef();
  const { selectedOrganization } = useOrganization();
  const { data: session } = useSession();

  const handleStatusPageUpdated = updatedStatusPage => {
    // Update the selected status page with the new data
    setSelectedStatusPage(updatedStatusPage);
    // Also refresh the status page list to show updated info
    statusPageListRef.current?.fetchStatusPages();
  };

  if (!session) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <Typography>Please sign in to access status pages.</Typography>
      </Box>
    );
  }

  return (
    <Box maxWidth={900} mx="auto" mt={6} p={3}>
      <Typography variant="h4" component="h1" gutterBottom>
        Status Pages
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Create and manage public status pages for your services
      </Typography>

      {/* Show organization selection prompt if no organization selected */}
      {!selectedOrganization ? (
        <Alert severity="info" sx={{ my: 3 }}>
          Please select an organization from the navbar to manage its status
          pages.
        </Alert>
      ) : (
        <Box mt={4}>
          {/* Organization Info */}
          <Alert severity="success" sx={{ mb: 3 }}>
            Managing status pages for:{' '}
            <strong>{selectedOrganization.name}</strong>
            <br />
            <Typography variant="body2" sx={{ mt: 1 }}>
              Use the organization selector in the navbar to switch between
              organizations.
            </Typography>
          </Alert>

          {/* Status Page Management */}
          {!selectedStatusPage ? (
            <>
              {/* Create Status Page Button */}
              <Box mb={3}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => setShowCreateStatusPage(true)}
                  size="large"
                >
                  Create Status Page
                </Button>
              </Box>

              {/* Status Pages List */}
              <StatusPageList
                ref={statusPageListRef}
                orgId={selectedOrganization.id}
                onSelectStatusPage={setSelectedStatusPage}
              />

              {/* Create Status Page Form */}
              {showCreateStatusPage && (
                <Box mt={4}>
                  <CreateStatusPageForm
                    orgId={selectedOrganization.id}
                    onSuccess={() => {
                      setShowCreateStatusPage(false);
                      statusPageListRef.current?.fetchStatusPages();
                    }}
                    onCancel={() => setShowCreateStatusPage(false)}
                  />
                </Box>
              )}
            </>
          ) : (
            /* Status Page Detail View */
            <Box>
              <Button
                variant="outlined"
                sx={{ mb: 3 }}
                onClick={() => setSelectedStatusPage(null)}
              >
                ← Back to Status Pages
              </Button>
              <StatusPageServices
                statusPage={selectedStatusPage}
                onStatusPageUpdated={handleStatusPageUpdated}
              />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
