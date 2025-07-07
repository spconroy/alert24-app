'use client';
import AuthStatus from '../components/AuthStatus';
import SignupForm from '../components/SignupForm';
import IncidentDashboard from '../components/IncidentDashboard';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
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
        <Typography variant="body1" color="text.secondary" gutterBottom textAlign="center" maxWidth="500px">
          {showSignup
            ? 'Create your account to start managing incidents, monitoring services, and coordinating your team response.'
            : 'Your comprehensive incident management and monitoring platform. Sign in to manage incidents, monitor services, and coordinate team responses.'}
        </Typography>
        {showSignup ? <SignupForm onSuccess={() => setShowSignup(false)} /> : <AuthStatus />}
        <Button variant="text" color="primary" onClick={() => setShowSignup(s => !s)}>
          {showSignup ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </Button>
      </Box>
    );
  }

  // If signed in, show the incident management dashboard
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <IncidentDashboard />
    </Container>
  );
}
