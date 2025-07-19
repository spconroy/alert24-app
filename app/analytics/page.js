'use client';

import { useOrganization } from '@/contexts/OrganizationContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import { Container, Typography, Box } from '@mui/material';

export default function AnalyticsPage() {
  const { selectedOrganization } = useOrganization();

  if (!selectedOrganization) {
    return (
      <ProtectedRoute>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Typography variant="h4" color="text.secondary">
            Select an organization to view analytics
          </Typography>
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
            metrics
          </Typography>
        </Box>

        <AnalyticsDashboard organizationId={selectedOrganization.id} />
      </Container>
    </ProtectedRoute>
  );
}
