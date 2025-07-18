'use client';
import React from 'react';
import { useSession } from '@/contexts/OrganizationContext';
import IncidentDashboard from '@/components/IncidentDashboard';
import { Container, Typography, Box, Button } from '@mui/material';

export default function HomePage() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <Container>
        <Typography variant="h4">Loading...</Typography>
      </Container>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box textAlign="center" sx={{ mb: 4 }}>
          <Typography variant="h2" gutterBottom>
            Welcome to Alert24
          </Typography>
          <Typography variant="h5" color="text.secondary" gutterBottom>
            Real-time monitoring and alerting platform
          </Typography>
          <Button
            variant="contained"
            size="large"
            href="/auth/signin"
            sx={{ mt: 2 }}
          >
            Get Started
          </Button>
        </Box>
      </Container>
    );
  }

  // If signed in, show the comprehensive incident management dashboard
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <IncidentDashboard />
    </Container>
  );
}
