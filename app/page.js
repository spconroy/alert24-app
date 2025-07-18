'use client';
import React from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
} from '@mui/material';
import { useSession } from '@/contexts/OrganizationContext';
import Link from 'next/link';

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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <Typography variant="body1" sx={{ mb: 4 }}>
        Welcome back, {session?.user?.name}!
      </Typography>

      <Box
        display="grid"
        gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))"
        gap={3}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Incidents
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage and track incidents
            </Typography>
            <Button component={Link} href="/incidents" sx={{ mt: 2 }}>
              View Incidents
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Monitoring
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Set up and manage monitoring checks
            </Typography>
            <Button component={Link} href="/monitoring" sx={{ mt: 2 }}>
              View Monitoring
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Status Pages
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create and manage public status pages
            </Typography>
            <Button component={Link} href="/status-pages" sx={{ mt: 2 }}>
              View Status Pages
            </Button>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}
