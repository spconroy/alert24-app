import React from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function AuthStatus() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <Typography>Loading...</Typography>;
  }

  if (!session) {
    return (
      <Button variant="contained" color="primary" onClick={() => signIn('google')}>
        Sign in with Google
      </Button>
    );
  }

  return (
    <Box display="flex" alignItems="center" gap={2}>
      <Avatar src={session.user?.image} alt={session.user?.name} />
      <Typography>{session.user?.name || session.user?.email}</Typography>
      <Button variant="outlined" color="secondary" onClick={() => signOut()}>
        Sign out
      </Button>
    </Box>
  );
} 