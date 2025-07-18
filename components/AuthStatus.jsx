'use client';

import { useState } from 'react';
import { Box, Button, Avatar, Typography, Menu, MenuItem } from '@mui/material';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function AuthStatus() {
  const { session } = useOrganization();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenuOpen = event => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = () => {
    handleMenuClose();
    window.location.href = '/api/auth/signout';
  };

  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2">Loading...</Typography>
      </Box>
    );
  }

  if (!session?.user) {
    return (
      <Button
        variant="outlined"
        onClick={() => window.location.href = '/api/auth/signin?callbackUrl=' + encodeURIComponent(window.location.origin)}
        sx={{ textTransform: 'none' }}
      >
        Sign In with Google
      </Button>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Button
        onClick={handleMenuOpen}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          textTransform: 'none',
          color: 'inherit',
        }}
      >
        <Avatar
          src={session.user.image}
          alt={session.user.name}
          sx={{ width: 32, height: 32 }}
        />
        <Typography variant="body2">{session.user.name}</Typography>
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => (window.location.href = '/profile')}>
          Profile
        </MenuItem>
        <MenuItem onClick={handleSignOut}>Sign Out</MenuItem>
      </Menu>
    </Box>
  );
}
