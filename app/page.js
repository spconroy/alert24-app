'use client';
import AuthStatus from '../components/AuthStatus';
import SignupForm from '../components/SignupForm';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import React, { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function Home() {
  const [showSignup, setShowSignup] = useState(false);
  const { data: session, status } = useSession();

  const isSignedIn = !!session;

  // Show signup/login if not signed in
  if (!isSignedIn) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" gap={4}>
        <Typography variant="h3" component="h1" gutterBottom>
          Welcome to Alert24
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          {showSignup
            ? 'Create your account below.'
            : 'Please sign in to continue.'}
        </Typography>
        {showSignup ? <SignupForm onSuccess={() => setShowSignup(false)} /> : <AuthStatus />}
        <Button variant="text" color="primary" onClick={() => setShowSignup(s => !s)}>
          {showSignup ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
        </Button>
      </Box>
    );
  }

  // If signed in, just show a welcome message
  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" gap={4}>
      <Typography variant="h3" component="h1" gutterBottom>
        Welcome to Alert24
      </Typography>
      <Typography variant="h5" align="center" sx={{ mt: 2 }}>
        Welcome!
      </Typography>
    </Box>
  );
}
