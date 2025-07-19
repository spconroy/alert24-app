'use client';

import { useOrganization } from '@/contexts/OrganizationContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import { Container, Typography, Box, Alert } from '@mui/material';
import { useState, useEffect } from 'react';

export default function AnalyticsPage() {
  const { selectedOrganization } = useOrganization();
  const [error, setError] = useState(null);

  // Add error boundary effect
  useEffect(() => {
    const handleError = event => {
      console.error('Analytics page error:', event.error);
      setError(
        'An error occurred loading the analytics dashboard. Please refresh the page.'
      );
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (!selectedOrganization) {
    return (
      <ProtectedRoute>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Alert severity="warning">
            Select an organization to view analytics
          </Alert>
        </Container>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Analytics Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Monitor your infrastructure performance, uptime trends, and
              incident metrics
            </Typography>
          </Box>
        </Container>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Analytics Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor your infrastructure performance, uptime trends, and incident
            metrics for <strong>{selectedOrganization.name}</strong>
          </Typography>
        </Box>

        <AnalyticsDashboard organizationId={selectedOrganization.id} />
      </Container>
    </ProtectedRoute>
  );
}
