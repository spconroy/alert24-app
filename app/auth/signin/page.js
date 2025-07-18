'use client';
import { useState, useEffect } from 'react';
import { signIn, getProviders } from 'next-auth/react';
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
  const [providers, setProviders] = useState(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  useEffect(() => {
    (async () => {
      try {
        const res = await getProviders();
        setProviders(res);
      } catch (error) {
        console.error('Error fetching providers:', error);
      }
    })();
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signIn('google', { callbackUrl });
    } catch (error) {
      console.error('Sign in error:', error);
      setLoading(false);
    }
  };

  const getErrorMessage = error => {
    switch (error) {
      case 'Configuration':
        return 'There is a problem with the server configuration. Please contact support.';
      case 'AccessDenied':
        return 'Access denied. You may not have permission to sign in.';
      case 'Verification':
        return 'The verification token has expired or already been used.';
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
            disabled={loading || !providers}
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
