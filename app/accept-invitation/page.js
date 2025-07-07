'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import {
  Business as OrgIcon,
  Person as PersonIcon,
  CheckCircle as AcceptIcon,
  Schedule as ClockIcon,
} from '@mui/icons-material';

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      validateInvitation();
    } else {
      setError('No invitation token provided');
      setLoading(false);
    }
  }, [token]);

  const validateInvitation = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/accept-invitation?token=${token}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to validate invitation');
      }

      setInvitation(data.invitation);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const acceptInvitation = async () => {
    if (!session) {
      // Redirect to login with return URL
      const returnUrl = encodeURIComponent(window.location.href);
      router.push(`/api/auth/signin?callbackUrl=${returnUrl}`);
      return;
    }

    try {
      setAccepting(true);
      setError(null);

      const response = await fetch('/api/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept invitation');
      }

      setSuccess(true);

      // Redirect to dashboard after a brief delay
      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  };

  const formatDate = dateString => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <CircularProgress />
          <Typography variant="h6">Validating invitation...</Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
          <Button variant="contained" onClick={() => router.push('/')}>
            Go to Dashboard
          </Button>
        </Paper>
      </Container>
    );
  }

  if (success) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <AcceptIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom color="success.main">
            Welcome to the team!
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            You've successfully joined {invitation?.organizationName}. You'll be
            redirected to the dashboard shortly.
          </Typography>
          <Button variant="contained" onClick={() => router.push('/')}>
            Go to Dashboard Now
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        {/* Header */}
        <Box textAlign="center" mb={4}>
          <OrgIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            Organization Invitation
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You've been invited to join an organization on Alert24
          </Typography>
        </Box>

        {/* Invitation Details */}
        {invitation && (
          <Card variant="outlined" sx={{ mb: 4 }}>
            <CardContent>
              <Box display="flex" flexDirection="column" gap={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <OrgIcon color="primary" />
                  <Typography variant="h6">
                    {invitation.organizationName}
                  </Typography>
                </Box>

                <Box display="flex" alignItems="center" gap={1}>
                  <PersonIcon color="action" />
                  <Typography variant="body1">
                    Role:{' '}
                    <Chip
                      label={invitation.role}
                      size="small"
                      color={
                        invitation.role === 'admin' ? 'primary' : 'default'
                      }
                    />
                  </Typography>
                </Box>

                {invitation.invitedByName && (
                  <Typography variant="body2" color="text.secondary">
                    Invited by: {invitation.invitedByName}
                  </Typography>
                )}

                <Box display="flex" alignItems="center" gap={1}>
                  <ClockIcon color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Expires: {formatDate(invitation.expiresAt)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Authentication Status */}
        {status === 'loading' ? (
          <Box display="flex" justifyContent="center" mb={3}>
            <CircularProgress size={24} />
          </Box>
        ) : !session ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            You need to sign in to accept this invitation. We'll bring you back
            here after authentication.
          </Alert>
        ) : (
          <Alert severity="success" sx={{ mb: 3 }}>
            Signed in as {session.user.email}
          </Alert>
        )}

        {/* Actions */}
        <Box display="flex" gap={2} justifyContent="center">
          <Button
            variant="outlined"
            onClick={() => router.push('/')}
            disabled={accepting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={acceptInvitation}
            disabled={accepting}
            startIcon={
              accepting ? <CircularProgress size={20} /> : <AcceptIcon />
            }
          >
            {accepting ? 'Accepting...' : 'Accept Invitation'}
          </Button>
        </Box>

        {/* Role Description */}
        {invitation && (
          <Box mt={4} p={2} bgcolor="grey.50" borderRadius={1}>
            <Typography variant="subtitle2" gutterBottom>
              What can you do as a {invitation.role}?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {invitation.role === 'admin'
                ? 'As an admin, you can manage incidents, monitoring, team members, and most organization settings. You cannot modify the organization name or manage owners.'
                : invitation.role === 'responder'
                  ? 'As a responder, you can view all data, manage incidents, update service statuses, and participate in on-call schedules. You cannot manage users or organization settings.'
                  : invitation.role === 'stakeholder'
                    ? 'As a stakeholder, you have read-only access to view non-public status pages, incidents, and services. You cannot make any changes to data.'
                    : 'As a member, you can respond to incidents, update statuses, and participate in on-call schedules.'}
            </Typography>
          </Box>
        )}
      </Paper>
    </Container>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AcceptInvitationContent />
    </Suspense>
  );
}
