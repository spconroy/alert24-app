'use client';
import React from 'react';
import { Box, Typography, CircularProgress, Button } from '@mui/material';
import { useSession } from '@/contexts/OrganizationContext';

export default function AuthStatus() {
  const { data: session, status } = useSession();

  const handleSignIn = () => {
    window.location.href = '/api/auth/google/signin';
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      window.location.href = '/auth/signin';
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <CircularProgress size={16} sx={{ mr: 1 }} />
        <Typography variant="body2">Loading...</Typography>
      </Box>
    );
  }

  if (status === 'authenticated' && session) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2">
          Signed in as {session.user?.name || session.user?.email}
        </Typography>
        <Button size="small" onClick={handleSignOut}>
          Sign out
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Typography variant="body2" sx={{ mr: 1 }}>
        Not signed in
      </Typography>
      <Button size="small" onClick={handleSignIn}>
        Sign in
      </Button>
    </Box>
  );
}
