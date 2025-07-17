'use client';
import React, { useState, useEffect } from 'react';
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
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tooltip from '@mui/material/Tooltip';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function NavBar() {
  const pathname = usePathname();
  const {
    selectedOrganization,
    organizations,
    loading,
    selectOrganization,
    session,
  } = useOrganization();

  const [defaultOrganizationId, setDefaultOrganizationId] = useState(null);
  const [settingDefault, setSettingDefault] = useState(false);

  // Fetch default organization when session is available
  useEffect(() => {
    if (session) {
      fetchDefaultOrganization();
    }
  }, [session]);

  const fetchDefaultOrganization = async () => {
    try {
      const response = await fetch('/api/user/default-organization');
      if (response.ok) {
        const data = await response.json();
        if (data.hasDefault) {
          setDefaultOrganizationId(data.defaultOrganization.id);
        }
      }
    } catch (error) {
      console.error('Error fetching default organization:', error);
    }
  };

  const handleSetDefault = async (organizationId, isDefault) => {
    if (settingDefault) return; // Prevent multiple simultaneous requests

    setSettingDefault(true);
    try {
      if (isDefault) {
        // Set as default
        const response = await fetch('/api/user/default-organization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId }),
        });

        if (response.ok) {
          setDefaultOrganizationId(organizationId);
          // Switch to the newly set default organization
          const newDefaultOrg = organizations.find(
            org => org.id === organizationId
          );
          if (newDefaultOrg) {
            selectOrganization(newDefaultOrg);
          }
          // Refresh the page to fully load the new default organization
          window.location.reload();
        } else {
          console.error('Failed to set default organization');
        }
      } else {
        // Remove default
        const response = await fetch('/api/user/default-organization', {
          method: 'DELETE',
        });

        if (response.ok) {
          setDefaultOrganizationId(null);
        } else {
          console.error('Failed to remove default organization');
        }
      }
    } catch (error) {
      console.error('Error setting default organization:', error);
    } finally {
      setSettingDefault(false);
    }
  };

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
                {organizations.map(org => {
                  const isDefault = defaultOrganizationId === org.id;
                  return (
                    <MenuItem key={org.id} value={org.id}>
                      <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        width="100%"
                        onClick={e => e.stopPropagation()} // Prevent dropdown close on checkbox click
                      >
                        <Box display="flex" alignItems="center" gap={1}>
                          🏢 {org.name}
                        </Box>
                        <Tooltip
                          title={
                            isDefault ? 'Remove as default' : 'Set as default'
                          }
                        >
                          <Checkbox
                            size="small"
                            checked={isDefault}
                            disabled={settingDefault}
                            icon={<StarBorderIcon fontSize="small" />}
                            checkedIcon={<StarIcon fontSize="small" />}
                            onChange={e => {
                              e.stopPropagation(); // Prevent dropdown close
                              handleSetDefault(org.id, e.target.checked);
                            }}
                            sx={{
                              color: 'primary.main',
                              '&.Mui-checked': {
                                color: 'primary.main',
                              },
                            }}
                          />
                        </Tooltip>
                      </Box>
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Box>
        )}

        {/* User Info & Auth */}
        <Box display="flex" alignItems="center" gap={2}>
          {session ? (
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
                onClick={() => (window.location.href = '/api/auth/signout')}
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
