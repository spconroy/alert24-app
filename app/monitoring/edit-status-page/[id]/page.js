'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Container,
  Breadcrumbs,
  Link,
} from '@mui/material';
import { useRouter, useParams } from 'next/navigation';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditStatusPageCheckForm from '@/components/EditStatusPageCheckForm';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function EditStatusPageCheckPage() {
  const router = useRouter();
  const params = useParams();
  const { selectedOrganization } = useOrganization();
  const [check, setCheck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkId = params?.id;

  useEffect(() => {
    if (checkId && selectedOrganization?.id) {
      fetchCheck();
    }
  }, [checkId, selectedOrganization]);

  const fetchCheck = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/monitoring/${checkId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch monitoring check');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch monitoring check');
      }

      const checkData = data.monitoring_check;
      
      // Verify this is a status page check
      if (checkData.check_type !== 'status_page') {
        throw new Error('This check is not a status page check. Please use the regular monitoring edit form.');
      }

      // Verify ownership
      if (checkData.organization_id !== selectedOrganization.id) {
        throw new Error('You do not have permission to edit this check.');
      }

      setCheck(checkData);
    } catch (err) {
      console.error('Error fetching check:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = (updatedCheck) => {
    console.log('Status page check updated successfully:', updatedCheck);
    router.push('/monitoring');
  };

  const handleCancel = () => {
    router.back();
  };

  if (!selectedOrganization?.id) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">
          Please select an organization to edit monitoring checks.
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Box>
          <Link 
            component="button" 
            variant="body2" 
            onClick={() => router.back()}
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <ArrowBackIcon fontSize="small" />
            Go Back
          </Link>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
        <Link 
          component="button" 
          variant="body2" 
          onClick={() => router.push('/monitoring')}
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <ArrowBackIcon fontSize="small" />
          Monitoring
        </Link>
        <Typography color="text.primary">
          Edit Status Page Check
        </Typography>
      </Breadcrumbs>

      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Edit Status Page Check
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Update configuration for "{check?.name || 'Unknown Check'}"
        </Typography>
      </Box>

      {/* Edit Form */}
      <Card>
        <CardContent sx={{ p: 4 }}>
          <EditStatusPageCheckForm
            check={check}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </CardContent>
      </Card>
    </Container>
  );
}