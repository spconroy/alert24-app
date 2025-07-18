'use client';
import { useState } from 'react';
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
import { Google as GoogleIcon } from '@mui/icons-material';

export default function SignInPage() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const handleSignIn = async () => {
    setLoading(true);
    try {
      // Redirect to our custom Google OAuth endpoint
      window.location.href = '/api/auth/google/signin';
    } catch (error) {
      console.error('Sign in error:', error);
      setLoading(false);
    }
  };

  const getErrorMessage = error => {
    switch (error) {
      case 'OAuthSignin':
        return 'Error occurred during Google sign-in process.';
      case 'OAuthCallback':
        return 'Error occurred during the OAuth callback.';
      case 'OAuthCreateAccount':
        return 'Could not create your account. Please try again.';
      case 'AccessDenied':
        return 'Access denied. You may not have permission to sign in.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Sign In to Alert24
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Sign in with your Google account to continue
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {getErrorMessage(error)}
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={
              loading ? <CircularProgress size={20} /> : <GoogleIcon />
            }
            onClick={handleSignIn}
            disabled={loading}
            fullWidth
            sx={{ py: 1.5 }}
          >
            {loading ? 'Signing in...' : 'Continue with Google'}
          </Button>
        </Box>

        <Typography variant="caption" color="text.secondary">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </Typography>
      </Paper>
    </Container>
  );
}
