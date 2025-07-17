'use client';
import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function NavBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { selectedOrganization, organizations, loading, selectOrganization } =
    useOrganization();

  const navigationItems = [
    { label: 'Dashboard', href: '/', icon: '📊' },
    { label: 'Incidents', href: '/incidents', icon: '🚨' },
    { label: 'Monitoring', href: '/monitoring', icon: '📡' },
    { label: 'On-Call', href: '/on-call', icon: '👥' },
    { label: 'Status Pages', href: '/status-pages', icon: '📄' },
    { label: 'Settings', href: '/settings', icon: '⚙️' },
    { label: 'Help', href: '/help', icon: '📚' },
  ];

  const isActivePath = href => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar
        sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}
      >
        {/* Logo/Brand */}
        <Typography
          variant="h6"
          component={Link}
          href="/"
          sx={{
            textDecoration: 'none',
            color: 'inherit',
            cursor: 'pointer',
            fontWeight: 'bold',
            '&:hover': {
              opacity: 0.8,
            },
          }}
        >
          Alert24
        </Typography>

        {/* Navigation Items - Only show when authenticated */}
        {session && (
          <Box
            display="flex"
            alignItems="center"
            gap={1}
            sx={{
              flexGrow: 1,
              justifyContent: 'center',
              '@media (max-width: 768px)': {
                display: 'none', // Hide nav items on mobile for now
              },
            }}
          >
            {navigationItems.map(item => (
              <Button
                key={item.href}
                component={Link}
                href={item.href}
                variant={isActivePath(item.href) ? 'contained' : 'text'}
                color={isActivePath(item.href) ? 'primary' : 'inherit'}
                size="small"
                sx={{
                  minWidth: 'auto',
                  px: 2,
                  py: 1,
                  fontSize: '0.75rem',
                  fontWeight: isActivePath(item.href) ? 600 : 400,
                  '&:hover': {
                    backgroundColor: isActivePath(item.href)
                      ? 'primary.dark'
                      : 'rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                <span style={{ marginRight: '6px' }}>{item.icon}</span>
                {item.label}
              </Button>
            ))}
          </Box>
        )}

        {/* Organization Selector - Only show when authenticated and has orgs */}
        {session && organizations.length > 0 && (
          <Box sx={{ minWidth: 200 }}>
            <FormControl fullWidth size="small" variant="outlined">
              <InputLabel>Organization</InputLabel>
              <Select
                value={selectedOrganization?.id || ''}
                label="Organization"
                onChange={e => {
                  const org = organizations.find(o => o.id === e.target.value);
                  selectOrganization(org);
                }}
                disabled={loading}
                sx={{
                  backgroundColor: 'background.paper',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                }}
              >
                {organizations.map(org => (
                  <MenuItem key={org.id} value={org.id}>
                    🏢 {org.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        {/* User Info & Auth */}
        <Box display="flex" alignItems="center" gap={2}>
          {status === 'loading' ? null : session ? (
            <Box display="flex" alignItems="center" gap={2}>
              <Box
                display="flex"
                alignItems="center"
                gap={1}
                component={Link}
                href="/profile"
                sx={{
                  textDecoration: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 1,
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                <Avatar
                  src={session.user?.image}
                  alt={session.user?.name}
                  sx={{ width: 32, height: 32 }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    display: { xs: 'none', sm: 'block' },
                    maxWidth: '150px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {session.user?.name || session.user?.email}
                </Typography>
              </Box>
              <Button
                color="secondary"
                variant="outlined"
                size="small"
                onClick={() => signOut()}
              >
                Sign out
              </Button>
            </Box>
          ) : null}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
