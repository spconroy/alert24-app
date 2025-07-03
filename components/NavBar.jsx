'use client';
import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

export default function NavBar() {
  const { data: session, status } = useSession();

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography 
          variant="h6" 
          component={Link} 
          href="/"
          sx={{ 
            flexGrow: 1,
            textDecoration: 'none',
            color: 'inherit',
            cursor: 'pointer',
            '&:hover': {
              opacity: 0.8
            }
          }}
        >
          Alert24
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Button component={Link} href="/settings" color="primary" variant="text">
            Settings
          </Button>
          {status === 'loading' ? null : session ? (
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar src={session.user?.image} alt={session.user?.name} />
              <Typography>{session.user?.name || session.user?.email}</Typography>
              <Button color="secondary" variant="outlined" onClick={() => signOut()}>
                Sign out
              </Button>
            </Box>
          ) : null}
        </Box>
      </Toolbar>
    </AppBar>
  );
} 