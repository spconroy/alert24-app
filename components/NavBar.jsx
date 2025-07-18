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
import BugIcon from '@mui/icons-material/Bug';
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
  const [anchorEl, setAnchorEl] = useState(null);
  const [incidentMenuAnchor, setIncidentMenuAnchor] = useState(null);
  const [monitoringMenuAnchor, setMonitoringMenuAnchor] = useState(null);

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

  const handleMobileMenuOpen = event => {
    setAnchorEl(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleIncidentMenuOpen = event => {
    setIncidentMenuAnchor(event.currentTarget);
  };

  const handleIncidentMenuClose = () => {
    setIncidentMenuAnchor(null);
  };

  const handleMonitoringMenuOpen = event => {
    setMonitoringMenuAnchor(event.currentTarget);
  };

  const handleMonitoringMenuClose = () => {
    setMonitoringMenuAnchor(null);
  };

  const navigationItems = [
    {
      label: 'Dashboard',
      href: '/',
      icon: <DashboardIcon />,
      standalone: true,
    },
  ];

  const incidentManagementItems = [
    {
      label: 'Incidents',
      href: '/incidents',
      icon: <WarningIcon />,
    },
    {
      label: 'Escalation Policies',
      href: '/escalation-policies',
      icon: <EscalatorWarningIcon />,
    },
    {
      label: 'On-Call Schedules',
      href: '/on-call',
      icon: <PeopleIcon />,
    },
  ];

  const monitoringItems = [
    {
      label: 'Monitoring',
      href: '/monitoring',
      icon: <MonitorIcon />,
    },
    {
      label: 'Status Pages',
      href: '/status-pages',
      icon: <PublicIcon />,
    },
  ];

  const settingsItems = [
    {
      label: 'Settings',
      href: '/settings',
      icon: <SettingsIcon />,
    },
    {
      label: 'Debug',
      href: '/debug',
      icon: <BugIcon />,
    },
    {
      label: 'Help',
      href: '/help',
      icon: <HelpIcon />,
    },
  ];

  const isActivePath = href => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const isActiveGroup = items => {
    return items.some(item => isActivePath(item.href));
  };

  const renderMobileMenu = () => (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={handleMobileMenuClose}
      keepMounted
    >
      {/* Dashboard */}
      <MenuItem
        component={Link}
        href="/"
        onClick={handleMobileMenuClose}
        selected={isActivePath('/')}
      >
        <ListItemIcon>
          <DashboardIcon />
        </ListItemIcon>
        <ListItemText>Dashboard</ListItemText>
      </MenuItem>

      <Divider />

      {/* Incident Management */}
      {incidentManagementItems.map(item => (
        <MenuItem
          key={item.href}
          component={Link}
          href={item.href}
          onClick={handleMobileMenuClose}
          selected={isActivePath(item.href)}
        >
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText>{item.label}</ListItemText>
        </MenuItem>
      ))}

      <Divider />

      {/* Monitoring */}
      {monitoringItems.map(item => (
        <MenuItem
          key={item.href}
          component={Link}
          href={item.href}
          onClick={handleMobileMenuClose}
          selected={isActivePath(item.href)}
        >
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText>{item.label}</ListItemText>
        </MenuItem>
      ))}

      <Divider />

      {/* Settings */}
      {settingsItems.map(item => (
        <MenuItem
          key={item.href}
          component={Link}
          href={item.href}
          onClick={handleMobileMenuClose}
          selected={isActivePath(item.href)}
        >
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText>{item.label}</ListItemText>
        </MenuItem>
      ))}
    </Menu>
  );

  const renderIncidentMenu = () => (
    <Menu
      anchorEl={incidentMenuAnchor}
      open={Boolean(incidentMenuAnchor)}
      onClose={handleIncidentMenuClose}
      keepMounted
    >
      {incidentManagementItems.map(item => (
        <MenuItem
          key={item.href}
          component={Link}
          href={item.href}
          onClick={handleIncidentMenuClose}
          selected={isActivePath(item.href)}
        >
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText>{item.label}</ListItemText>
        </MenuItem>
      ))}
    </Menu>
  );

  const renderMonitoringMenu = () => (
    <Menu
      anchorEl={monitoringMenuAnchor}
      open={Boolean(monitoringMenuAnchor)}
      onClose={handleMonitoringMenuClose}
      keepMounted
    >
      {monitoringItems.map(item => (
        <MenuItem
          key={item.href}
          component={Link}
          href={item.href}
          onClick={handleMonitoringMenuClose}
          selected={isActivePath(item.href)}
        >
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText>{item.label}</ListItemText>
        </MenuItem>
      ))}
    </Menu>
  );

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

        {/* Desktop Navigation - Only show when authenticated */}
        {session && (
          <Box
            display="flex"
            alignItems="center"
            gap={1}
            sx={{
              flexGrow: 1,
              justifyContent: 'center',
              display: { xs: 'none', md: 'flex' }, // Hide on mobile
            }}
          >
            {/* Dashboard */}
            <Button
              component={Link}
              href="/"
              variant={isActivePath('/') ? 'contained' : 'text'}
              color={isActivePath('/') ? 'primary' : 'inherit'}
              size="small"
              startIcon={<DashboardIcon />}
              sx={{
                minWidth: 'auto',
                px: 2,
                py: 1,
                fontSize: '0.75rem',
                fontWeight: isActivePath('/') ? 600 : 400,
              }}
            >
              Dashboard
            </Button>

            {/* Incident Management Dropdown */}
            <Button
              onClick={handleIncidentMenuOpen}
              variant={
                isActiveGroup(incidentManagementItems) ? 'contained' : 'text'
              }
              color={
                isActiveGroup(incidentManagementItems) ? 'primary' : 'inherit'
              }
              size="small"
              endIcon={<KeyboardArrowDownIcon />}
              sx={{
                minWidth: 'auto',
                px: 2,
                py: 1,
                fontSize: '0.75rem',
                fontWeight: isActiveGroup(incidentManagementItems) ? 600 : 400,
              }}
            >
              Incidents
            </Button>

            {/* Monitoring Dropdown */}
            <Button
              onClick={handleMonitoringMenuOpen}
              variant={isActiveGroup(monitoringItems) ? 'contained' : 'text'}
              color={isActiveGroup(monitoringItems) ? 'primary' : 'inherit'}
              size="small"
              endIcon={<KeyboardArrowDownIcon />}
              sx={{
                minWidth: 'auto',
                px: 2,
                py: 1,
                fontSize: '0.75rem',
                fontWeight: isActiveGroup(monitoringItems) ? 600 : 400,
              }}
            >
              Monitoring
            </Button>

            {/* Settings */}
            <Button
              component={Link}
              href="/settings"
              variant={isActivePath('/settings') ? 'contained' : 'text'}
              color={isActivePath('/settings') ? 'primary' : 'inherit'}
              size="small"
              startIcon={<SettingsIcon />}
              sx={{
                minWidth: 'auto',
                px: 2,
                py: 1,
                fontSize: '0.75rem',
                fontWeight: isActivePath('/settings') ? 600 : 400,
              }}
            >
              Settings
            </Button>

            {/* Help */}
            <Button
              component={Link}
              href="/help"
              variant={isActivePath('/help') ? 'contained' : 'text'}
              color={isActivePath('/help') ? 'primary' : 'inherit'}
              size="small"
              startIcon={<HelpIcon />}
              sx={{
                minWidth: 'auto',
                px: 2,
                py: 1,
                fontSize: '0.75rem',
                fontWeight: isActivePath('/help') ? 600 : 400,
              }}
            >
              Help
            </Button>
          </Box>
        )}

        {/* Mobile Menu Button */}
        {session && (
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={handleMobileMenuOpen}
            sx={{ display: { xs: 'flex', md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
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
                            onClick={e => {
                              e.stopPropagation(); // Prevent organization selection when clicking checkbox
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

      {/* Dropdown Menus */}
      {renderMobileMenu()}
      {renderIncidentMenu()}
      {renderMonitoringMenu()}
    </AppBar>
  );
}
