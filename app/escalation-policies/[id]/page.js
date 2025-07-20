'use client';

export const runtime = 'edge';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Chip,
  Paper,
  Avatar,
  Divider,
  Stack,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  StepConnector,
} from '@mui/material';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import ScheduleIcon from '@mui/icons-material/Schedule';
import NotificationsIcon from '@mui/icons-material/Notifications';
import EmailIcon from '@mui/icons-material/Email';
import SmsIcon from '@mui/icons-material/Sms';
import PhoneIcon from '@mui/icons-material/Phone';
import ChatIcon from '@mui/icons-material/Chat';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import { styled } from '@mui/material/styles';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useOrganization } from '@/contexts/OrganizationContext';

const StyledStepConnector = styled(StepConnector)(({ theme }) => ({
  '& .MuiStepConnector-line': {
    borderLeft: `3px solid ${theme.palette.primary.light}`,
    borderTopWidth: 0,
    marginLeft: 20,
  },
}));

const getNotificationIcon = (channel) => {
  switch (channel) {
    case 'email':
      return <EmailIcon fontSize="small" />;
    case 'sms':
      return <SmsIcon fontSize="small" />;
    case 'voice':
      return <PhoneIcon fontSize="small" />;
    case 'slack':
      return <ChatIcon fontSize="small" />;
    default:
      return <NotificationsIcon fontSize="small" />;
  }
};

const getNotificationColor = (channel) => {
  switch (channel) {
    case 'email':
      return 'primary';
    case 'sms':
      return 'warning';
    case 'voice':
      return 'error';
    case 'slack':
      return 'secondary';
    default:
      return 'default';
  }
};

const getTargetIcon = (target) => {
  if (target.type === 'user') {
    return <PersonIcon fontSize="small" />;
  } else if (target.type === 'team') {
    return <GroupIcon fontSize="small" />;
  } else if (target.type === 'schedule') {
    return <ScheduleIcon fontSize="small" />;
  }
  return <PersonIcon fontSize="small" />;
};

export default function EscalationPolicyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { session, selectedOrganization } = useOrganization();

  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (params.id && selectedOrganization?.id) {
      fetchPolicy();
    }
  }, [params.id, selectedOrganization]);

  const fetchPolicy = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/escalation-policies?organization_id=${selectedOrganization.id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch escalation policies');
      }

      const data = await response.json();
      const foundPolicy = data.escalation_policies?.find(p => p.id === params.id);
      
      if (!foundPolicy) {
        throw new Error('Escalation policy not found');
      }

      setPolicy(foundPolicy);
    } catch (err) {
      console.error('Error fetching policy:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this escalation policy? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(true);
      const response = await fetch(`/api/escalation-policies?id=${params.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete escalation policy');
      }

      router.push('/escalation-policies');
    } catch (err) {
      console.error('Error deleting policy:', err);
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // Show loading while fetching policy
  if (loading) {
    return (
      <ProtectedRoute>
        <Box sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" gap={2} mb={4}>
            <Button
              component={Link}
              href="/escalation-policies"
              startIcon={<ArrowBackIcon />}
              variant="outlined"
            >
              Back to Escalation Policies
            </Button>
            <Typography variant="h4" component="h1">
              Escalation Policy Details
            </Typography>
          </Box>

          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight="400px"
          >
            <CircularProgress />
          </Box>
        </Box>
      </ProtectedRoute>
    );
  }

  // Show organization selection prompt if no organization is selected
  if (!selectedOrganization?.id) {
    return (
      <ProtectedRoute>
        <Box sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" gap={2} mb={4}>
            <Button
              component={Link}
              href="/escalation-policies"
              startIcon={<ArrowBackIcon />}
              variant="outlined"
            >
              Back to Escalation Policies
            </Button>
            <Typography variant="h4" component="h1">
              Escalation Policy Details
            </Typography>
          </Box>

          <Alert severity="warning">
            Please select an organization from the navigation bar to view escalation policy details.
          </Alert>
        </Box>
      </ProtectedRoute>
    );
  }

  // Show error state
  if (error || !policy) {
    return (
      <ProtectedRoute>
        <Box sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" gap={2} mb={4}>
            <Button
              component={Link}
              href="/escalation-policies"
              startIcon={<ArrowBackIcon />}
              variant="outlined"
            >
              Back to Escalation Policies
            </Button>
            <Typography variant="h4" component="h1">
              Escalation Policy Details
            </Typography>
          </Box>

          <Alert severity="error">
            {error || 'Escalation policy not found'}
          </Alert>
        </Box>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Button
              component={Link}
              href="/escalation-policies"
              startIcon={<ArrowBackIcon />}
              variant="outlined"
              sx={{ mb: 2 }}
            >
              Back to Escalation Policies
            </Button>
            
            <Box display="flex" alignItems="center" gap={2} mb={1}>
              <Typography variant="h4" component="h1">
                {policy.name}
              </Typography>
              <Chip 
                label={policy.is_active ? 'Active' : 'Inactive'} 
                color={policy.is_active ? 'success' : 'default'}
                size="small"
              />
            </Box>
            
            <Typography variant="body1" color="text.secondary">
              {policy.description || 'View and manage this escalation policy'}
            </Typography>
          </Box>
          
          <Box display="flex" gap={2}>
            <Button
              component={Link}
              href={`/escalation-policies/${policy.id}/edit`}
              variant="contained"
              startIcon={<EditIcon />}
            >
              Edit
            </Button>
            <Button
              onClick={handleDelete}
              variant="outlined"
              color="error"
              startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </Box>
        </Box>

        <Grid container spacing={4}>
          {/* Quick Stats */}
          <Grid item xs={12}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: 'primary.50', borderLeft: 4, borderColor: 'primary.main' }}>
                  <CardContent sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="h3" color="primary.main" fontWeight="bold">
                      {policy.escalation_steps?.length || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight="medium">
                      Escalation Steps
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: 'success.50', borderLeft: 4, borderColor: 'success.main' }}>
                  <CardContent sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="h3" color="success.main" fontWeight="bold">
                      {policy.escalation_steps?.reduce((total, step) => total + (step.targets?.length || 0), 0) || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight="medium">
                      Total Targets
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: 'warning.50', borderLeft: 4, borderColor: 'warning.main' }}>
                  <CardContent sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="h3" color="warning.main" fontWeight="bold">
                      {policy.escalation_timeout_minutes}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight="medium">
                      Timeout (mins)
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: 'info.50', borderLeft: 4, borderColor: 'info.main' }}>
                  <CardContent sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="h3" color="info.main" fontWeight="bold">
                      {formatDateTime(policy.created_at).split(',')[0]}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight="medium">
                      Created Date
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>

          {/* Escalation Flow */}
          <Grid item xs={12}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 4 }}>
                <Box display="flex" alignItems="center" gap={2} mb={3}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <AccountTreeIcon />
                  </Avatar>
                  <Typography variant="h5" fontWeight="bold">
                    Escalation Flow
                  </Typography>
                </Box>
                
                {policy.escalation_steps && policy.escalation_steps.length > 0 ? (
                  <Stepper orientation="vertical" connector={<StyledStepConnector />}>
                    {policy.escalation_steps
                      .sort((a, b) => a.level - b.level)
                      .map((step, index) => (
                        <Step key={step.id || index} active={true}>
                          <StepLabel
                            StepIconComponent={() => (
                              <Avatar 
                                sx={{ 
                                  bgcolor: step.delay_minutes === 0 ? 'success.main' : 'primary.main',
                                  width: 48,
                                  height: 48,
                                  fontSize: '1.2rem',
                                  fontWeight: 'bold'
                                }}
                              >
                                {step.level}
                              </Avatar>
                            )}
                          >
                            <Box>
                              <Typography variant="h6" fontWeight="bold">
                                Step {step.level}
                              </Typography>
                              <Box display="flex" alignItems="center" gap={1} mt={1}>
                                {step.delay_minutes === 0 ? (
                                  <>
                                    <PlayCircleIcon fontSize="small" color="success" />
                                    <Chip label="Immediate" color="success" size="small" />
                                  </>
                                ) : (
                                  <>
                                    <AccessTimeIcon fontSize="small" />
                                    <Chip 
                                      label={`After ${step.delay_minutes} minutes`} 
                                      color="primary" 
                                      size="small" 
                                    />
                                  </>
                                )}
                              </Box>
                            </Box>
                          </StepLabel>
                          
                          <StepContent>
                            <Grid container spacing={3} sx={{ mt: 1 }}>
                              {/* Notification Channels */}
                              <Grid item xs={12} md={6}>
                                <Paper variant="outlined" sx={{ p: 3, bgcolor: 'grey.50' }}>
                                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                    📬 Notification Channels
                                  </Typography>
                                  <Box display="flex" gap={1} flexWrap="wrap">
                                    {step.notification_channels?.map((channel, idx) => (
                                      <Chip
                                        key={idx}
                                        icon={getNotificationIcon(channel)}
                                        label={channel.toUpperCase()}
                                        color={getNotificationColor(channel)}
                                        sx={{ fontWeight: 'bold' }}
                                      />
                                    ))}
                                    {(!step.notification_channels || step.notification_channels.length === 0) && (
                                      <Typography variant="body2" color="text.secondary" fontStyle="italic">
                                        No channels configured
                                      </Typography>
                                    )}
                                  </Box>
                                </Paper>
                              </Grid>
                              
                              {/* Targets */}
                              <Grid item xs={12} md={6}>
                                <Paper variant="outlined" sx={{ p: 3, bgcolor: 'grey.50' }}>
                                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                    🎯 Notification Targets
                                  </Typography>
                                  <Stack spacing={1}>
                                    {step.targets?.map((target, idx) => (
                                      <Box key={idx} display="flex" alignItems="center" gap={2}>
                                        <Avatar 
                                          sx={{ 
                                            width: 32, 
                                            height: 32,
                                            bgcolor: target.type === 'user' ? 'primary.main' : 
                                                    target.type === 'team' ? 'secondary.main' : 'default'
                                          }}
                                        >
                                          {getTargetIcon(target)}
                                        </Avatar>
                                        <Box flex={1}>
                                          <Typography variant="body2" fontWeight="medium">
                                            {target.name || target.email || target.id}
                                          </Typography>
                                          <Chip 
                                            label={target.type} 
                                            size="small" 
                                            color={target.type === 'user' ? 'primary' : target.type === 'team' ? 'secondary' : 'default'}
                                          />
                                        </Box>
                                      </Box>
                                    ))}
                                    {(!step.targets || step.targets.length === 0) && (
                                      <Typography variant="body2" color="text.secondary" fontStyle="italic">
                                        No targets configured
                                      </Typography>
                                    )}
                                  </Stack>
                                </Paper>
                              </Grid>
                            </Grid>
                          </StepContent>
                        </Step>
                      ))}
                  </Stepper>
                ) : (
                  <Alert 
                    severity="warning" 
                    sx={{ 
                      borderRadius: 2, 
                      '& .MuiAlert-message': { fontSize: '1.1rem' } 
                    }}
                  >
                    <Typography variant="h6" gutterBottom>
                      No Escalation Steps Configured
                    </Typography>
                    <Typography variant="body1">
                      This policy doesn't have any escalation steps. Click "Edit Policy" to add steps.
                    </Typography>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </ProtectedRoute>
  );
}