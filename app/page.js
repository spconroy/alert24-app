'use client';
import { useSession } from 'next-auth/react';
import AuthStatus from '../components/AuthStatus';
import IncidentDashboard from '../components/IncidentDashboard';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';

export default function Home() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
      >
        <Typography variant="h6">Loading...</Typography>
      </Box>
    );
  }

  const isSignedIn = !!session?.user;

  // Show Google OAuth login if not signed in
  if (!isSignedIn) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        gap={4}
      >
        <Typography variant="h3" component="h1" gutterBottom>
          Welcome to Alert24
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          gutterBottom
          textAlign="center"
          maxWidth="500px"
        >
          Your comprehensive incident management and monitoring platform. Sign
          in with Google to manage incidents, monitor services, and coordinate
          team responses.
        </Typography>
        <AuthStatus />
        <Typography
          variant="body2"
          color="text.secondary"
          textAlign="center"
          maxWidth="400px"
        >
          New to Alert24? No problem! Just sign in with your Google account and
          we&apos;ll create your account automatically.
        </Typography>
      </Box>
    );
  }

  // If signed in, show the incident management dashboard
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <IncidentDashboard />
    </Container>
  );
}
