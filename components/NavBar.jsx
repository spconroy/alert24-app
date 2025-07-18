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
import Menu from '@mui/material/Menu';
import CircularProgress from '@mui/material/CircularProgress';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import WarningIcon from '@mui/icons-material/Warning';
import MonitorIcon from '@mui/icons-material/Monitor';
import PeopleIcon from '@mui/icons-material/People';
import PublicIcon from '@mui/icons-material/Public';
import EscalatorWarningIcon from '@mui/icons-material/EscalatorWarning';
import SettingsIcon from '@mui/icons-material/Settings';
import HelpIcon from '@mui/icons-material/Help';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import BugReportIcon from '@mui/icons-material/BugReport';
import PaymentIcon from '@mui/icons-material/Payment';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOrganization, useSession } from '@/contexts/OrganizationContext';

export default function NavBar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { currentOrganization, organizations, loading, switchOrganization } =
    useOrganization();

  const [defaultOrganizationId, setDefaultOrganizationId] = useState(null);
  const [settingDefault, setSettingDefault] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleOrganizationChange = organizationId => {
    switchOrganization(organizationId);
  };

  // Custom sign in function
  const handleSignIn = () => {
    window.location.href = '/api/auth/google/signin';
  };

  // Custom sign out function
  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      window.location.href = '/auth/signin';
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Navigation items
  const navigationItems = [
    { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
    { label: 'Incidents', path: '/incidents', icon: <WarningIcon /> },
    { label: 'Monitoring', path: '/monitoring', icon: <MonitorIcon /> },
    { label: 'On-Call', path: '/on-call', icon: <PeopleIcon /> },
    { label: 'Status Pages', path: '/status-pages', icon: <PublicIcon /> },
    {
      label: 'Escalation Policies',
      path: '/escalation-policies',
      icon: <EscalatorWarningIcon />,
    },
  ];

  // Show loading state only when session status is loading AND organizations are loading
  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Alert24
          </Typography>
          <CircularProgress size={24} color="inherit" />
          <Typography variant="body2" sx={{ ml: 2 }}>
            Loading...
          </Typography>
        </Toolbar>
      </AppBar>
    );
  }

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Alert24
        </Typography>

        {status === 'authenticated' && session ? (
          <>
            {/* Organization Selector */}
            {organizations.length > 0 && (
              <FormControl sx={{ mr: 2, minWidth: 200 }}>
                <Select
                  value={currentOrganization?.id || ''}
                  onChange={e => handleOrganizationChange(e.target.value)}
                  displayEmpty
                  size="small"
                  sx={{
                    color: 'white',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255,255,255,0.3)',
                    },
                    '& .MuiSvgIcon-root': { color: 'white' },
                  }}
                >
                  {organizations.map(org => (
                    <MenuItem key={org.id} value={org.id}>
                      {org.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Navigation Menu */}
            <Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
              {navigationItems.map(item => (
                <Button
                  key={item.path}
                  component={Link}
                  href={item.path}
                  color="inherit"
                  startIcon={item.icon}
                  sx={{
                    backgroundColor:
                      pathname === item.path
                        ? 'rgba(255,255,255,0.1)'
                        : 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(255,255,255,0.1)',
                    },
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Box>

            {/* User Menu */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar src={session.user?.image} sx={{ width: 32, height: 32 }}>
                {session.user?.name?.charAt(0)}
              </Avatar>
              <Typography variant="body2">{session.user?.name}</Typography>
              <Button
                color="inherit"
                variant="outlined"
                size="small"
                onClick={handleSignOut}
                sx={{
                  borderColor: 'rgba(255,255,255,0.3)',
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.5)',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                  },
                }}
              >
                Sign out
              </Button>
            </Box>
          </>
        ) : (
          <Button
            color="primary"
            variant="contained"
            size="small"
            onClick={handleSignIn}
          >
            Sign in
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
}
