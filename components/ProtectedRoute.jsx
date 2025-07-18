import React, { useEffect } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function ProtectedRoute({ children }) {
  const { session, sessionStatus } = useOrganization();

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      // Redirect to sign in page
      window.location.href = '/api/auth/signin';
    }
  }, [sessionStatus]);

  if (sessionStatus === 'loading') {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    return null; // Redirecting
  }

  return children;
} 