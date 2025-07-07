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
import { usePathname } from 'next/navigation';

export default function NavBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const navigationItems = [
    { label: 'Dashboard', href: '/', icon: '📊' },
    { label: 'Incidents', href: '/incidents', icon: '🚨' },
    { label: 'Monitoring', href: '/monitoring', icon: '📡' },
    { label: 'On-Call', href: '/on-call', icon: '👥' },
    { label: 'Organizations', href: '/organizations', icon: '🏢' },
    { label: 'Settings', href: '/settings', icon: '⚙️' },
    { label: 'Help', href: '/help', icon: '📚' }
  ];

  const isActivePath = (href) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
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
              opacity: 0.8
            }
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
                display: 'none' // Hide nav items on mobile for now
              }
            }}
          >
            {navigationItems.map((item) => (
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
                  fontSize: '0.875rem',
                  fontWeight: isActivePath(item.href) ? 600 : 400,
                  '&:hover': {
                    backgroundColor: isActivePath(item.href) 
                      ? 'primary.dark' 
                      : 'rgba(0, 0, 0, 0.04)'
                  }
                }}
              >
                <span style={{ marginRight: '6px' }}>{item.icon}</span>
                {item.label}
              </Button>
            ))}
          </Box>
        )}

        {/* User Info & Auth */}
        <Box display="flex" alignItems="center" gap={2}>
          {status === 'loading' ? null : session ? (
            <Box display="flex" alignItems="center" gap={2}>
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
                  whiteSpace: 'nowrap'
                }}
              >
                {session.user?.name || session.user?.email}
              </Typography>
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