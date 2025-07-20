'use client';
import React, { useState, useEffect } from 'react';
import { Snackbar, Alert, Button } from '@mui/material';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function OrganizationNotifications() {
  const { error, selectedOrganization, loading, retryFetch } = useOrganization();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [lastSelectedOrg, setLastSelectedOrg] = useState(null);

  // Show success notification when organization changes
  useEffect(() => {
    if (selectedOrganization && selectedOrganization !== lastSelectedOrg && !loading) {
      setShowSuccess(true);
      setLastSelectedOrg(selectedOrganization);
    }
  }, [selectedOrganization, loading, lastSelectedOrg]);

  // Show error notification when there's an error
  useEffect(() => {
    if (error) {
      setShowError(true);
    } else {
      setShowError(false);
    }
  }, [error]);

  const handleSuccessClose = () => {
    setShowSuccess(false);
  };

  const handleErrorClose = () => {
    setShowError(false);
  };

  const handleRetry = () => {
    retryFetch();
    setShowError(false);
  };

  return (
    <>
      {/* Success notification for organization switching */}
      <Snackbar
        open={showSuccess}
        autoHideDuration={3000}
        onClose={handleSuccessClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSuccessClose} severity="success" sx={{ width: '100%' }}>
          Switched to {selectedOrganization?.name}
        </Alert>
      </Snackbar>

      {/* Error notification for context loading issues */}
      <Snackbar
        open={showError}
        onClose={handleErrorClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        sx={{ zIndex: 9999 }}
      >
        <Alert
          onClose={handleErrorClose}
          severity="error"
          sx={{ width: '100%' }}
          action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              Retry
            </Button>
          }
        >
          Organization loading failed: {error}
        </Alert>
      </Snackbar>
    </>
  );
}