'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Error as ErrorIcon, Home as HomeIcon } from '@mui/icons-material';
import Link from 'next/link';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const getErrorDetails = error => {
    switch (error) {
      case 'Configuration':
        return {
          title: 'Server Configuration Error',
          description:
            'There is a problem with the authentication configuration. Please contact support.',
          severity: 'error',
        };
      case 'AccessDenied':
        return {
          title: 'Access Denied',
          description:
            'You do not have permission to sign in to this application.',
          severity: 'warning',
        };
      case 'Verification':
        return {
          title: 'Verification Failed',
          description:
            'The verification token has expired or has already been used.',
          severity: 'warning',
        };
      case 'OAuthSignin':
        return {
          title: 'OAuth Sign-in Error',
          description: 'Error occurred during the OAuth sign-in process.',
          severity: 'error',
        };
      case 'OAuthCallback':
        return {
          title: 'OAuth Callback Error',
          description: 'Error occurred during the OAuth callback.',
          severity: 'error',
        };
      case 'OAuthCreateAccount':
        return {
          title: 'Account Creation Error',
          description: 'Could not create OAuth account in the database.',
          severity: 'error',
        };
      case 'EmailCreateAccount':
        return {
          title: 'Email Account Error',
          description: 'Could not create email account in the database.',
          severity: 'error',
        };
      case 'Callback':
        return {
          title: 'Callback Error',
          description: 'Error occurred during the callback process.',
          severity: 'error',
        };
      case 'OAuthAccountNotLinked':
        return {
          title: 'Account Not Linked',
          description:
            'The OAuth account is not linked to any existing account.',
          severity: 'warning',
        };
      default:
        return {
          title: 'Authentication Error',
          description: 'An unexpected error occurred during authentication.',
          severity: 'error',
        };
    }
  };

  const errorDetails = getErrorDetails(error);

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        <Box sx={{ mb: 3 }}>
          <ErrorIcon color="error" sx={{ fontSize: 60 }} />
        </Box>

        <Typography variant="h4" gutterBottom>
          {errorDetails.title}
        </Typography>

        <Alert
          severity={errorDetails.severity}
          sx={{ mb: 4, textAlign: 'left' }}
        >
          <Typography variant="body1">{errorDetails.description}</Typography>
          {error && (
            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
              Error code: {error}
            </Typography>
          )}
        </Alert>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            component={Link}
            href="/auth/signin"
            variant="contained"
            color="primary"
          >
            Try Again
          </Button>
          <Button
            component={Link}
            href="/"
            variant="outlined"
            startIcon={<HomeIcon />}
          >
            Go Home
          </Button>
        </Box>

        <Box sx={{ mt: 4, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="h6" gutterBottom>
            Troubleshooting
          </Typography>
          <Typography variant="body2" sx={{ textAlign: 'left' }}>
            If you continue to experience issues:
            <br />• Check that your Google account has access
            <br />• Clear your browser cookies and try again
            <br />• Contact support if the problem persists
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
          <CircularProgress />
        </Container>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
