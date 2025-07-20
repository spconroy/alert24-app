import React, { useEffect } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function ProtectedRoute({ children }) {
  const { session, status } = useOrganization();

  useEffect(() => {
    if (status === 'unauthenticated') {
      // Redirect to sign in page
      window.location.href = '/api/auth/signin';
    }
  }, [status]);

  if (status === 'loading') {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="50vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    return null; // Redirecting
  }

  return children;
}
